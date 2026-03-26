import React, { useState, useEffect, useRef, useMemo } from "react"
import {
  ScrollView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Switch,
  Platform,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useToast } from "../hooks/useToast"
import Toast from "../components/Toast"
import { Text, TextField, Icon } from "app/components"
import { useSelector, useDispatch } from "react-redux"
import AvatarPicker from "../components/AvatarPicker"
import { LegalLinks } from "app/components/LegalLinks"
import { LanguageSelector } from "app/components/LanguageSelector"
import { ThemeSelector } from "app/components/ThemeSelector"
import { FontScaleSelector } from "app/components/FontScaleSelector"
import { useLanguage } from "app/hooks/useLanguage"
import { translate } from "app/i18n"
import i18n from "i18n-js"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { logger } from "../utils/logger"
import { TIMEOUTS } from "../constants"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { getCaregiver, setCaregiver } from "../store/caregiverSlice"
import { getCurrentUser, getInviteToken, getAuthTokens, setCurrentUser } from "../store/authSlice"
import type { RootState } from "../store/store"
import { useUpdateCaregiverMutation, useUploadAvatarMutation, useGetCaregiverQuery } from "../services/api/caregiverApi"
import { useResendVerificationEmailMutation } from "../services/api/authApi"
import { useGetMFAStatusQuery } from "../services/api/mfaApi"
import { LoadingScreen } from "./LoadingScreen"
import { useTheme } from "app/theme/ThemeContext"
import { navigationRef } from "app/navigators/navigationUtilities"
import { Button } from "app/components"
import { useFontScale } from "app/hooks/useFontScale"
import { testingProps } from "../utils/testingProps"
import { jwtDecode } from "jwt-decode"

function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const dispatch = useDispatch()
  const { toast, showInfo, hideToast } = useToast()
  const { colors, isLoading: themeLoading, fontScale } = useTheme()
  const { scale } = useFontScale()
  const insets = useSafeAreaInsets()
  const headerColor = (colors.palette as any)?.biancaHeader || colors.text
  
  // Use language hook to trigger re-renders on language change
  useLanguage()

  // Use caregiver from slice; fall back to auth currentUser so profile is filled after SSO even if caregiver slice lags
  const caregiverFromSlice = useSelector(getCaregiver)
  const currentUserFromAuth = useSelector(getCurrentUser)
  const tokens = useSelector(getAuthTokens)
  const inviteToken = useSelector(getInviteToken)
  const currentUser = caregiverFromSlice ?? currentUserFromAuth

  // When we have tokens but no user (e.g. after deploy/reload or race), fetch current user from token sub
  const caregiverIdFromToken = useMemo(() => {
    if (!tokens?.access?.token || currentUser) return null
    try {
      const decoded = jwtDecode<{ sub?: string }>(tokens.access.token)
      logger.debug("ProfileScreen: decoded token sub:", decoded?.sub)
      return decoded?.sub ?? null
    } catch (error) {
      logger.error("ProfileScreen: failed to decode JWT:", error)
      return null
    }
  }, [tokens?.access?.token, currentUser])
  
  const { data: fetchedCaregiver, isLoading: isLoadingCaregiver, error: fetchError } = useGetCaregiverQuery(
    { id: caregiverIdFromToken! },
    { skip: !caregiverIdFromToken }
  )
  
  useEffect(() => {
    if (fetchedCaregiver && !currentUser) {
      logger.debug("ProfileScreen: restoring user from API fetch:", fetchedCaregiver.id, fetchedCaregiver.email)
      dispatch(setCurrentUser(fetchedCaregiver))
      dispatch(setCaregiver(fetchedCaregiver))
    }
    if (fetchError) {
      logger.error("ProfileScreen: failed to fetch caregiver from token:", fetchError)
    }
  }, [fetchedCaregiver, currentUser, fetchError, dispatch])

  // Fallback: if we have tokens but no user, try to restore from latest SSO login result in API cache (handles race after modal close)
  const ssoLoginUserFromCache = useSelector((state: RootState) => {
    const api = (state as RootState & { ssoApi?: { mutations?: Record<string, { status: string; data?: { caregiver?: unknown } }> } }).ssoApi
    if (!api?.mutations) {
      logger.debug("ProfileScreen: no SSO API mutations in cache")
      return null
    }
    const entry = Object.entries(api.mutations).find(
      ([k, v]) => k.startsWith("ssoLogin") && v?.status === "fulfilled" && v?.data?.caregiver
    )
    if (entry) {
      logger.debug("ProfileScreen: found SSO caregiver in cache from key:", entry[0])
    } else {
      logger.debug("ProfileScreen: no fulfilled SSO login found in cache")
    }
    return entry?.[1]?.data?.caregiver ?? null
  })
  
  useEffect(() => {
    if (!tokens?.access?.token || currentUser || !ssoLoginUserFromCache) return
    const caregiver = ssoLoginUserFromCache as Parameters<typeof setCurrentUser>[0]
    // Validate caregiver has required fields before using cache
    if (caregiver?.id && caregiver?.email && caregiver?.name) {
      logger.debug("ProfileScreen: restoring caregiver from SSO cache:", caregiver.id, caregiver.email)
      dispatch(setCurrentUser(caregiver))
      dispatch(setCaregiver(caregiver))
    } else {
      logger.warn("ProfileScreen: SSO cache caregiver incomplete, skipping:", {
        hasId: !!caregiver?.id,
        hasEmail: !!caregiver?.email,
        hasName: !!caregiver?.name
      })
    }
  }, [tokens?.access?.token, currentUser, ssoLoginUserFromCache, dispatch])

  // Show loading when we have tokens but no user and we're fetching by id (avoids flashing empty profile after SSO)
  const isRestoringUser = Boolean(tokens?.access?.token && !currentUser && caregiverIdFromToken && isLoadingCaregiver)
  
  const isSsoUser = Boolean(currentUser?.ssoProvider)
  const isEmailVerified = Boolean(currentUser?.isEmailVerified || isSsoUser)

  // Check if user needs to complete profile
  // Profile is incomplete if email is not verified OR phone is missing (not just unverified)
  // Users can continue with unverified phone, but need verified email and a phone number present
  const hasMissingPhone = !currentUser?.phone || (typeof currentUser.phone === 'string' && currentUser.phone.trim() === '')
  const isUnverified = !isEmailVerified || hasMissingPhone
  const hasUnverifiedPhone = currentUser?.phone && typeof currentUser.phone === 'string' && currentUser.phone.trim() !== '' && !currentUser?.isPhoneVerified

  // Mutations for editing profile
  const [updateCaregiver, { isLoading: isUpdating, error: updateError }] =
    useUpdateCaregiverMutation()
  const [uploadAvatar, { isLoading: isUploading, error: uploadError }] = useUploadAvatarMutation()
  const [resendVerificationEmail, { isLoading: isResendingEmail }] = useResendVerificationEmailMutation()
  
  // MFA status
  const { data: mfaStatus } = useGetMFAStatusQuery()

  // Form state
  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState("")
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  // Validation state
  const [emailError, setEmailError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [emailSentMessage, setEmailSentMessage] = useState("")
  
  // Timeout ref for navigation delay
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync form from current user (caregiver or auth fallback) so SSO users see name/email/avatar pre-filled
  useEffect(() => {
    if (currentUser) {
      logger.debug("ProfileScreen syncing form from user:", currentUser.id, currentUser.name, currentUser.avatar)
      setName(currentUser.name ?? "")
      setAvatar(currentUser.avatar ?? "")
      setEmail(currentUser.email ?? "")
      setPhone(currentUser.phone ?? "")
    }
  }, [currentUser])

  // Keep caregiver slice in sync when auth has user but caregiver slice doesn't (e.g. after SSO)
  useEffect(() => {
    if (currentUserFromAuth && !caregiverFromSlice) {
      logger.debug("ProfileScreen: syncing caregiver slice from auth currentUser")
      dispatch(setCaregiver(currentUserFromAuth))
    }
  }, [currentUserFromAuth, caregiverFromSlice, dispatch])

  // Handle invited users who got stuck on profile screen
  useEffect(() => {
    if (!currentUser && inviteToken) {
      // User has invite token but no current user - redirect to signup
      logger.debug("Redirecting invited user to signup screen")
      ;(navigation as { navigate: (name: string, params?: object) => void }).navigate("Signup", { token: inviteToken })
    }
  }, [currentUser, inviteToken, navigation])

  const validateEmail = (email: string) => {
    setEmail(email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEmailError(translate("errors.invalidEmail"))
    } else {
      setEmailError("")
    }
  }

  const validatePhone = (phone: string) => {
    setPhone(phone)
    // Accept international format with +1 country code or 10 digits
    const phoneRegex = /^(\+1\d{10}|\d{10})$/
    if (!phoneRegex.test(phone)) {
      setPhoneError(translate("profileScreen.invalidPhoneFormat"))
    } else {
      setPhoneError("")
    }
  }

  const handleLogout = () => {
    if (navigationRef.isReady()) {
      // @ts-expect-error: cross-stack navigation, Logout is a valid route in DrawerParamList/HomeStack
      navigationRef.navigate("Logout")
    }
  }

  // Only prevent navigation if email is not verified OR phone is missing
  // Users can continue with unverified phone number (phone exists but not verified)
  // Do NOT block if only phone is unverified (hasUnverifiedPhone but email is verified and phone exists)
  useEffect(() => {
    // Only block if email is unverified OR phone is missing
    // Don't block if phone exists but is just unverified
    const shouldBlock = !isEmailVerified || hasMissingPhone
    
    if (shouldBlock) {
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        // Allow logout navigation
        if (e.data.action.type === 'NAVIGATE' && (e.data.action.payload as { name?: string })?.name === 'Logout') {
          return // Allow the navigation
        }
        
        // Prevent default behavior of leaving the screen for other navigations
        e.preventDefault()
        
        // Show appropriate message based on what's missing
        const message = hasMissingPhone 
          ? translate("profileScreen.completeProfileMessage")
          : translate("profileScreen.completeProfileMessageUnverified")
        showInfo(message)
      })

      return unsubscribe
    }
  }, [navigation, isEmailVerified, hasMissingPhone, showInfo])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  const handleSave = async () => {
    if (!currentUser || !currentUser.id) return

    try {
      // Get current language preference from i18n
      const currentLanguage = i18n.locale || 'en'
      
      // Create updated user object (SSO users cannot change email - it must match their provider)
      const updatedCaregiver = {
        ...currentUser,
        name,
        email: isSsoUser ? (currentUser.email ?? email) : email,
        phone,
        preferredLanguage: currentLanguage,
      }

      // Upload avatar if changed
      if (avatar !== currentUser.avatar && avatarBlob) {
        try {
          // Use the updated uploadAvatar mutation
          const result = await uploadAvatar({
            id: currentUser.id,
            avatar: avatarBlob,
          }).unwrap()

          // If the API returns the updated caregiver with avatar
          if (result && result.avatar) {
            updatedCaregiver.avatar = result.avatar
          }
        } catch (avatarError) {
          logger.error("Avatar upload error:", avatarError)
          // Continue with profile update even if avatar upload fails
        }
      }

      // Update profile
      await updateCaregiver({
        id: currentUser.id,
        caregiver: updatedCaregiver,
      }).unwrap()

      // Show success message
      setSuccessMessage(translate("profileScreen.profileUpdatedSuccess"))

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Navigate back after a brief delay to show the success message
      timeoutRef.current = setTimeout(() => {
        navigation.goBack()
        timeoutRef.current = null
      }, 1000)
    } catch (error) {
      setSuccessMessage(translate("profileScreen.profileUpdateFailed"))
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        setSuccessMessage("")
        timeoutRef.current = null
      }, TIMEOUTS.SUCCESS_MESSAGE_DISPLAY)
    }
  }

  if (isUpdating || isUploading || isRestoringUser) {
    return <LoadingScreen />
  }

  if (themeLoading) {
    return <LoadingScreen />
  }

  const styles = createStyles(colors, fontScale)

  return (
    <>
      <TouchableWithoutFeedback>
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.contentContainer} 
          testID="profile-screen"
          {...testingProps("profile-screen")}
          accessibilityLabel="Profile"
        >
          {/* In-screen top bar (no nav header): back + title */}
          <View style={[styles.inScreenHeader, { paddingTop: Math.max(insets.top, 12), paddingLeft: 12 + (Platform.OS === 'ios' ? 0 : insets.left), paddingRight: 12 + (Platform.OS === 'ios' ? 0 : insets.right) }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={12}
              testID="profile-back-button"
              accessibilityLabel={translate("common.back") || "Back"}
              accessibilityRole="button"
            >
              <Icon icon="caretLeft" size={28} color={headerColor} />
            </Pressable>
            <Text weight="semiBold" size="lg" text={translate("headers.profile") || "Profile"} style={[styles.inScreenTitle, { color: headerColor }]} />
            <View style={styles.backButton} />
          </View>
          {(updateError || uploadError) && (
            <Text style={styles.error}>
              {updateError && "data" in updateError
                ? `${translate("common.error")}: ${(updateError.data as { message: string }).message}`
                : uploadError && "data" in uploadError
                ? `${translate("profileScreen.errorUploadingAvatar")}: ${(uploadError.data as { message: string }).message}`
                : translate("common.anErrorOccurred")}
            </Text>
          )}

          {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

          {/* Show banner for missing phone or unverified phone */}
          {hasMissingPhone && (
            <View style={styles.unverifiedBanner}>
              <Text style={styles.unverifiedTitle}>{translate("profileScreen.completeProfileTitle")}</Text>
              <Text style={styles.unverifiedText}>
                {translate("profileScreen.completeProfileMessageUnverified")}
              </Text>
            </View>
          )}
          
          {/* Show different banner for unverified phone (phone exists but not verified) */}
          {hasUnverifiedPhone && (
            <View style={styles.unverifiedBanner}>
              <Text style={styles.unverifiedTitle}>{translate("profileScreen.completeProfileTitle")}</Text>
              <Text style={styles.unverifiedText}>
                {translate("profileScreen.verifyPhoneBannerMessage")}
              </Text>
            </View>
          )}

          <View style={styles.formCard}>

            <AvatarPicker
              initialAvatar={avatar}
              onAvatarChanged={({ uri, blob }) => {
                setAvatar(uri)
                if (blob) setAvatarBlob(blob)
              }}
            />

            <TextField
              placeholderTx="profileScreen.namePlaceholder"
              value={name}
              onChangeText={setName}
              containerStyle={styles.inputContainer}
              inputWrapperStyle={styles.inputWrapper}
              style={styles.input}
            />
            <View style={styles.inputContainer}>
              <TextField
                placeholderTx="profileScreen.emailPlaceholder"
                value={email}
                onChangeText={validateEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSsoUser}
                containerStyle={styles.inputContainer}
                inputWrapperStyle={isSsoUser ? styles.readonlyInputWrapper : styles.inputWrapper}
                style={isSsoUser ? styles.readonlyInput : styles.input}
                status={emailError ? "error" : undefined}
                helper={emailError || (isSsoUser ? translate("profileScreen.emailManagedBySSO") : undefined)}
              />
              {isEmailVerified ? (
                <View style={styles.verificationStatus}>
                  <Text style={styles.verificationText}>
                    ✓ {translate("profileScreen.emailVerified") || "Email Verified"}
                  </Text>
                </View>
              ) : (
                <View style={styles.verificationStatus}>
                  <Text style={styles.verificationWarning}>
                    ⏳ {translate("profileScreen.emailNotVerified") || "Email Not Verified"}
                  </Text>
                  <Button
                    text={translate("profileScreen.verifyEmail") || "Verify Email"}
                    onPress={async () => {
                      try {
                        await resendVerificationEmail({ email: email || currentUser?.email || "" }).unwrap()
                        setEmailSentMessage(translate("profileScreen.verificationEmailSent") || "Verification email sent! Please check your inbox.")
                        // Clear message after 5 seconds
                        setTimeout(() => {
                          setEmailSentMessage("")
                        }, 5000)
                      } catch (error) {
                        logger.error("Failed to resend verification email:", error)
                        setEmailSentMessage(translate("profileScreen.verificationEmailFailed") || "Failed to send verification email. Please try again.")
                        setTimeout(() => {
                          setEmailSentMessage("")
                        }, 5000)
                      }
                    }}
                    preset="default"
                    style={styles.verifyButton}
                    disabled={isResendingEmail}
                    loading={isResendingEmail}
                    testID="verify-email-button"
                    accessibilityLabel="Verify email button"
                  />
                </View>
              )}
              {emailSentMessage ? (
                <Text style={emailSentMessage.includes("Failed") ? styles.error : styles.success}>
                  {emailSentMessage}
                </Text>
              ) : null}
            </View>
            <View style={styles.inputContainer}>
              <TextField
                placeholderTx="profileScreen.phonePlaceholder"
                value={phone}
                onChangeText={validatePhone}
                keyboardType="phone-pad"
                containerStyle={styles.inputContainer}
                inputWrapperStyle={styles.inputWrapper}
                style={styles.input}
                status={phoneError ? "error" : undefined}
                helper={phoneError || undefined}
              />
              {currentUser?.isPhoneVerified ? (
                <View style={styles.verificationStatus}>
                  <Text style={styles.verificationText}>
                    ✓ {translate("profileScreen.phoneVerified") || "Phone Verified"}
                  </Text>
                </View>
              ) : (
                <View style={styles.verificationStatus}>
                  <Text style={styles.verificationWarning}>
                    ⏳ {translate("profileScreen.phoneNotVerified") || "Phone Not Verified"}
                  </Text>
                  <Button
                    text={translate("profileScreen.verifyPhone") || "Verify Phone"}
                    onPress={() => navigation.navigate("VerifyPhone" as never)}
                    preset="default"
                    style={styles.verifyButton}
                    testID="verify-phone-button"
                    accessibilityLabel="Verify phone button"
                  />
                </View>
              )}
            </View>

            <LanguageSelector testID="language-selector" />
            <ThemeSelector testID="theme-selector" />
            <FontScaleSelector testID="font-scale-selector" />

            <Button
              text={mfaStatus?.mfaEnabled 
                ? (translate("mfa.manageMFA") || "Manage Multi-Factor Authentication")
                : (translate("mfa.enableMFA") || "Enable Multi-Factor Authentication")
              }
              onPress={() => navigation.navigate("MFASetup" as never)}
              preset="default"
              testID="mfa-setup-button"
              accessibilityLabel={mfaStatus?.mfaEnabled 
                ? (translate("mfa.manageMFA") || "Manage Multi-Factor Authentication")
                : (translate("mfa.enableMFA") || "Enable Multi-Factor Authentication")
              }
              accessibilityHint="Opens multi-factor authentication setup screen"
              style={styles.mfaButton}
            />

            <Button
              text={translate("profileScreen.requestMyData") || "Request My Data"}
              onPress={() => navigation.navigate("PrivacyRequest" as never)}
              preset="default"
              testID="request-my-data-button"
              accessibilityLabel={translate("profileScreen.requestMyData") || "Request my data"}
              accessibilityHint="Opens screen to request your personal data"
              style={styles.requestDataButton}
            />

            {(currentUser?.role === "orgAdmin" || currentUser?.role === "superAdmin") && (
              <Button
                text={translate("profileScreen.consentCenter")}
                onPress={() => navigation.navigate("ConsentCenter" as never)}
                preset="default"
                testID="consent-center-button"
                accessibilityLabel={translate("profileScreen.consentCenter")}
                accessibilityHint="Opens organization consent audit"
                style={styles.requestDataButton}
              />
            )}

            <Button
              text={translate("profileScreen.updateProfile")}
              onPress={handleSave}
              preset="primary"
              disabled={!email || !phone || !!emailError || !!phoneError}
              testID="profile-update-button"
              accessibilityLabel={translate("profileScreen.updateProfile") || "Update profile"}
              accessibilityHint="Saves your profile changes"
              style={styles.updateButton}
            />

            <Pressable 
              style={styles.logoutButton} 
              onPress={handleLogout} 
              testID="profile-logout-button"
              {...testingProps("profile-logout-button")}
              accessibilityLabel={translate("profileScreen.logout") || "Logout"}
              accessibilityRole="button"
              accessible={true}
            >
              <Text style={styles.buttonText} testID="profile-logout-button-text">{translate("profileScreen.logout")}</Text>
            </Pressable>

            {/* Legal Links */}
            <LegalLinks style={styles.legalLinks} />
            
            {/* Version Number - Auto-generated from build-time environment variable
                This changes on every build, allowing us to verify frontend container updates */}
            <View style={styles.versionContainer}>
              <Text style={styles.versionText}>
                Version: {process.env.EXPO_PUBLIC_BUILD_VERSION || '0.00.0001'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        testID="profile-toast"
      />
    </>
  )
}

const createStyles = (colors: any, fontScale: number) => StyleSheet.create({
  inScreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: (colors.palette as any)?.neutral300 || "#e5e7eb",
  },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  inScreenTitle: { flex: 1, textAlign: "center" },
  updateButton: {
    marginBottom: 15,
  },
  container: { backgroundColor: colors.palette.biancaBackground, flex: 1 },
  contentContainer: { padding: 20 },
  error: { color: colors.palette.biancaError, marginBottom: 10, textAlign: "center" },
  fieldError: {
    color: colors.palette.biancaError,
    fontSize: 14 * fontScale,
    marginBottom: 10,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 6,
    elevation: 2,
    marginBottom: 20,
    padding: 20,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  formTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 20 * fontScale,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputWrapper: {
    // TextField handles most styling automatically
  },
  input: {
    // TextField handles text color automatically via theme
  },
  readonlyInputWrapper: {
    backgroundColor: (colors.palette as any)?.neutral200 || "#e5e7eb",
  },
  readonlyInput: {
    opacity: 0.7,
  },
  logoutButton: {
    alignItems: "center",
    backgroundColor: colors.palette.secondary500,
    borderRadius: 5,
    paddingVertical: 15,
  },
  buttonText: {
    color: colors.palette.neutral100 || "#fff",
    fontSize: 16 * fontScale,
    fontWeight: "600",
  },
  mfaButton: {
    marginBottom: 15,
  },
  requestDataButton: {
    marginBottom: 15,
  },
  verificationStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  verificationText: {
    color: colors.palette.biancaSuccess || colors.palette.success500 || "#10b981",
    fontSize: 14 * fontScale,
    fontWeight: "500",
  },
  verificationWarning: {
    color: colors.palette.biancaWarning || colors.palette.warning500 || "#f59e0b",
    fontSize: 14 * fontScale,
    fontWeight: "500",
    marginRight: 8,
  },
  verifyButton: {
    // Match the verify phone button default preset styling
    alignSelf: "flex-start", // Align to left like a link button
    marginTop: 4,
  },
  success: { color: colors.palette.biancaSuccess, fontSize: 16 * fontScale, marginBottom: 10, textAlign: "center" },
  unverifiedBanner: {
    backgroundColor: colors.palette.warning500 || colors.palette.biancaWarning,
    borderRadius: 8,
    marginBottom: 20,
    padding: 16,
  },
  unverifiedTitle: {
    color: colors.palette.neutral100,
    fontSize: 18 * fontScale,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  unverifiedText: {
    color: colors.palette.neutral100,
    fontSize: 14 * fontScale,
    textAlign: 'center',
    lineHeight: 20 * fontScale,
  },
  legalLinks: {
    marginTop: 20,
    alignSelf: "center",
  },
  versionContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.palette.neutral300 || "#d1d5db",
    alignItems: "center",
  },
  versionText: {
    color: colors.palette.neutral600 || "#6b7280",
    fontSize: 12 * fontScale,
    fontFamily: "monospace",
  },
})

export { ProfileScreen }
