import React, { useState, useEffect, useRef } from "react"
import {
  ScrollView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Switch,
} from "react-native"
import { useToast } from "../hooks/useToast"
import Toast from "../components/Toast"
import { Text, TextField } from "app/components"
import { useSelector, useDispatch } from "react-redux"
import AvatarPicker from "../components/AvatarPicker"
import { LegalLinks } from "app/components/LegalLinks"
import { LanguageSelector } from "app/components/LanguageSelector"
import { ThemeSelector } from "app/components/ThemeSelector"
import { useLanguage } from "app/hooks/useLanguage"
import { translate } from "app/i18n"
import i18n from "i18n-js"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { logger } from "../utils/logger"
import { TIMEOUTS } from "../constants"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { getCaregiver } from "../store/caregiverSlice"
import { getInviteToken } from "../store/authSlice"
import { useUpdateCaregiverMutation, useUploadAvatarMutation } from "../services/api/caregiverApi"
import { useGetMFAStatusQuery } from "../services/api/mfaApi"
import { useUpdateTelemetryOptInMutation } from "../services/api/telemetryApi"
import { LoadingScreen } from "./LoadingScreen"
import telemetry from "../services/telemetry/telemetry.service"
import { useTheme } from "app/theme/ThemeContext"
import { navigationRef } from "app/navigators/navigationUtilities"
import { Button } from "app/components"

function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const dispatch = useDispatch()
  const { toast, showInfo, hideToast } = useToast()
  const { colors, isLoading: themeLoading } = useTheme()
  
  // Use language hook to trigger re-renders on language change
  useLanguage()

  // Get the current user (who is a caregiver)
  const currentUser = useSelector(getCaregiver)
  const inviteToken = useSelector(getInviteToken)
  
  // Check if user is unverified and needs to complete profile
  const isUnverified = currentUser?.role === 'unverified'

  // Mutations for editing profile
  const [updateCaregiver, { isLoading: isUpdating, error: updateError }] =
    useUpdateCaregiverMutation()
  const [uploadAvatar, { isLoading: isUploading, error: uploadError }] = useUploadAvatarMutation()
  
  // MFA status
  const { data: mfaStatus } = useGetMFAStatusQuery()
  
  // Telemetry opt-in
  const [updateTelemetryOptIn] = useUpdateTelemetryOptInMutation()
  const [telemetryOptIn, setTelemetryOptIn] = useState<boolean | null>(null)

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
  
  // Timeout ref for navigation delay
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load telemetry opt-in status
  useEffect(() => {
    const loadTelemetryOptIn = async () => {
      const optIn = await telemetry.getOptIn()
      setTelemetryOptIn(optIn)
    }
    loadTelemetryOptIn()
  }, [])

  // When setting the avatar state in ProfileScreen
  useEffect(() => {
    if (currentUser) {
      logger.debug("Current user avatar:", currentUser.avatar)
      setName(currentUser.name || "")
      setAvatar(currentUser.avatar || "")
      setEmail(currentUser.email || "")
      setPhone(currentUser.phone || "")
    }
  }, [currentUser])

  // Handle invited users who got stuck on profile screen
  useEffect(() => {
    if (!currentUser && inviteToken) {
      // User has invite token but no current user - redirect to signup
      logger.debug("Redirecting invited user to signup screen")
      navigation.navigate("Signup", { token: inviteToken })
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

  // Prevent navigation away from profile screen for unverified users (except logout)
  useEffect(() => {
    if (isUnverified) {
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        // Allow logout navigation
        if (e.data.action.type === 'NAVIGATE' && e.data.action.payload?.name === 'Logout') {
          return // Allow the navigation
        }
        
        // Prevent default behavior of leaving the screen for other navigations
        e.preventDefault()
        
        // Show info toast to user
        showInfo(translate("profileScreen.completeProfileMessage"))
      })

      return unsubscribe
    }
  }, [navigation, isUnverified])

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
      
      // Create updated user object
      const updatedCaregiver = {
        ...currentUser,
        name,
        email,
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

  if (isUpdating || isUploading) {
    return <LoadingScreen />
  }

  if (themeLoading) {
    return <LoadingScreen />
  }

  const styles = createStyles(colors)

  return (
    <>
      <TouchableWithoutFeedback>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} accessibilityLabel="profile-screen">
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

          {isUnverified && (
            <View style={styles.unverifiedBanner}>
              <Text style={styles.unverifiedTitle}>{translate("profileScreen.completeProfileTitle")}</Text>
              <Text style={styles.unverifiedText}>
                {translate("profileScreen.completeProfileMessageUnverified")}
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
                containerStyle={styles.inputContainer}
                inputWrapperStyle={styles.inputWrapper}
                style={styles.input}
                status={emailError ? "error" : undefined}
                helper={emailError || undefined}
              />
              {currentUser?.isEmailVerified ? (
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
                </View>
              )}
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
                    preset="link"
                    style={styles.verifyButton}
                    testID="verify-phone-button"
                    accessibilityLabel="Verify phone button"
                  />
                </View>
              )}
            </View>

            <LanguageSelector testID="language-selector" />
            <ThemeSelector testID="theme-selector" />

            {/* Telemetry Opt-in Toggle */}
            <View style={styles.telemetryContainer}>
              <View style={styles.telemetryLabelContainer}>
                <Text style={styles.telemetryLabel}>
                  {translate("profileScreen.telemetryOptIn") || "Share anonymous usage data"}
                </Text>
                <Text style={styles.telemetryDescription}>
                  {translate("profileScreen.telemetryDescription") || "Help us improve the app by sharing anonymous usage data. No personal information is collected."}
                </Text>
              </View>
              <Switch
                value={telemetryOptIn === true}
                onValueChange={async (value) => {
                  setTelemetryOptIn(value)
                  try {
                    await updateTelemetryOptIn({ optIn: value }).unwrap()
                    await telemetry.setOptIn(value)
                    if (value) {
                      showInfo(translate("profileScreen.telemetryEnabled") || "Telemetry enabled")
                    } else {
                      showInfo(translate("profileScreen.telemetryDisabled") || "Telemetry disabled")
                    }
                  } catch (error) {
                    logger.error("Failed to update telemetry opt-in:", error)
                    // Revert on error
                    setTelemetryOptIn(!value)
                  }
                }}
                testID="telemetry-opt-in-switch"
                accessibilityLabel="telemetry-opt-in-switch"
              />
            </View>

            <Button
              text={mfaStatus?.mfaEnabled 
                ? (translate("mfa.manageMFA") || "Manage Multi-Factor Authentication")
                : (translate("mfa.enableMFA") || "Enable Multi-Factor Authentication")
              }
              onPress={() => navigation.navigate("MFASetup" as never)}
              preset="default"
              testID="mfa-setup-button"
              accessibilityLabel="mfa-setup-button"
              style={styles.mfaButton}
            />

            <Button
              text={translate("profileScreen.updateProfile")}
              onPress={handleSave}
              preset="primary"
              disabled={!email || !phone || !!emailError || !!phoneError}
              testID="profile-update-button"
              accessibilityLabel="profile-update-button"
              style={styles.updateButton}
            />

            <Pressable style={styles.logoutButton} onPress={handleLogout} testID="profile-logout-button" accessibilityLabel="profile-logout-button" accessible={true}>
              <Text style={styles.buttonText}>{translate("profileScreen.logout")}</Text>
            </Pressable>

            {/* Legal Links */}
            <LegalLinks style={styles.legalLinks} />
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

const createStyles = (colors: any) => StyleSheet.create({
  updateButton: {
    marginBottom: 15,
  },
  container: { backgroundColor: colors.palette.biancaBackground, flex: 1 },
  contentContainer: { padding: 20 },
  error: { color: colors.palette.biancaError, marginBottom: 10, textAlign: "center" },
  fieldError: {
    color: colors.palette.biancaError,
    fontSize: 14,
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
    fontSize: 20,
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
  logoutButton: {
    alignItems: "center",
    backgroundColor: colors.palette.secondary500,
    borderRadius: 5,
    paddingVertical: 15,
  },
  mfaButton: {
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
    fontSize: 14,
    fontWeight: "500",
  },
  verificationWarning: {
    color: colors.palette.biancaWarning || colors.palette.warning500 || "#f59e0b",
    fontSize: 14,
    fontWeight: "500",
    marginRight: 8,
  },
  verifyButton: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 0,
  },
  telemetryContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
    paddingVertical: 10,
  },
  telemetryLabelContainer: {
    flex: 1,
    marginRight: 15,
  },
  telemetryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  telemetryDescription: {
    fontSize: 14,
    color: colors.palette.neutral600,
    lineHeight: 20,
  },
  success: { color: colors.palette.biancaSuccess, fontSize: 16, marginBottom: 10, textAlign: "center" },
  unverifiedBanner: {
    backgroundColor: colors.palette.warning500 || colors.palette.biancaWarning,
    borderRadius: 8,
    marginBottom: 20,
    padding: 16,
  },
  unverifiedTitle: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  unverifiedText: {
    color: colors.palette.neutral100,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  legalLinks: {
    marginTop: 20,
    alignSelf: "center",
  },
})

export { ProfileScreen }
