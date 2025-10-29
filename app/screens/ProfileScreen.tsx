import React, { useState, useEffect } from "react"
import {
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Alert,
} from "react-native"
import { useSelector, useDispatch } from "react-redux"
import AvatarPicker from "../components/AvatarPicker"
import { LegalLinks } from "app/components/LegalLinks"
import { LanguageSelector } from "app/components/LanguageSelector"
import { ThemeSelector } from "app/components/ThemeSelector"
import { useLanguage } from "app/hooks/useLanguage"
import { translate } from "app/i18n"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { getCaregiver } from "../store/caregiverSlice"
import { getInviteToken } from "../store/authSlice"
import { useUpdateCaregiverMutation, useUploadAvatarMutation } from "../services/api/caregiverApi"
import { LoadingScreen } from "./LoadingScreen"
import { colors } from "app/theme/colors"
import { navigationRef } from "app/navigators/navigationUtilities"

function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const dispatch = useDispatch()
  
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

  // When setting the avatar state in ProfileScreen
  useEffect(() => {
    if (currentUser) {
      console.log("Current user avatar:", currentUser.avatar)
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
      console.log("Redirecting invited user to signup screen")
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
        
        // Show alert to user
        Alert.alert(
          'Complete Your Profile',
          'Please complete your profile by adding a phone number before continuing.',
          [{ text: 'OK' }]
        )
      })

      return unsubscribe
    }
  }, [navigation, isUnverified])

  const handleSave = async () => {
    if (!currentUser || !currentUser.id) return

    try {
      // Create updated user object
      const updatedCaregiver = {
        ...currentUser,
        name,
        email,
        phone,
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
          console.error("Avatar upload error:", avatarError)
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

      // Navigate back after a brief delay to show the success message
      setTimeout(() => {
        navigation.goBack()
      }, 1000)
    } catch (error) {
      setSuccessMessage(translate("profileScreen.profileUpdateFailed"))
      setTimeout(() => setSuccessMessage(""), 2000)
    }
  }

  if (isUpdating || isUploading) {
    return <LoadingScreen />
  }

  // If user is not authenticated and has no invite token, show error
  if (!currentUser && !inviteToken) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} accessibilityLabel="profile-screen">
        <Text style={styles.error} accessibilityLabel="error-message">
          Error: Please authenticate. Please log in to access your profile.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate("Login")}
          accessibilityLabel="go-to-login-button"
          accessible={true}
        >
          <Text style={styles.buttonText}>Go to Login</Text>
        </Pressable>
      </ScrollView>
    )
  }

  return (
    <TouchableWithoutFeedback>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} accessibilityLabel="profile-screen">
        {(updateError || uploadError) && (
          <Text style={styles.error}>
            {updateError && "data" in updateError
              ? `Error: ${(updateError.data as { message: string }).message}`
              : uploadError && "data" in uploadError
              ? `Error uploading avatar: ${(uploadError.data as { message: string }).message}`
              : "An error occurred"}
          </Text>
        )}

        {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

        {isUnverified && (
          <View style={styles.unverifiedBanner}>
            <Text style={styles.unverifiedTitle}>Complete Your Profile</Text>
            <Text style={styles.unverifiedText}>
              Please add your phone number to complete your profile and access all features.
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

          <TextInput
            style={styles.input}
            placeholder={translate("profileScreen.namePlaceholder")}
            placeholderTextColor={colors.palette.neutral600}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder={translate("profileScreen.emailPlaceholder")}
            placeholderTextColor={colors.palette.neutral600}
            value={email}
            onChangeText={validateEmail}
          />
          {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder={translate("profileScreen.phonePlaceholder")}
            placeholderTextColor={colors.palette.neutral600}
            value={phone}
            onChangeText={validatePhone}
          />
          {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

          <LanguageSelector testID="language-selector" />
          <ThemeSelector testID="theme-selector" />

          <Pressable
            style={[
              styles.button,
              (!email || !phone || emailError || phoneError) ? styles.buttonDisabled : undefined,
            ]}
            onPress={handleSave}
            disabled={!email || !phone || !!emailError || !!phoneError}
          >
            <Text style={styles.buttonText}>{translate("profileScreen.updateProfile")}</Text>
          </Pressable>

          <Pressable style={styles.logoutButton} onPress={handleLogout} testID="profile-logout-button" accessibilityLabel="profile-logout-button" accessible={true}>
            <Text style={styles.buttonText}>{translate("profileScreen.logout")}</Text>
          </Pressable>

          {/* Legal Links */}
          <LegalLinks style={styles.legalLinks} />
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    marginBottom: 15,
    paddingVertical: 15,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.palette.neutral100, fontSize: 18, fontWeight: "600" },
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
  input: {
    borderColor: colors.palette.neutral300,
    borderRadius: 5,
    borderWidth: 1,
    color: colors.palette.biancaHeader,
    fontSize: 16,
    height: 45,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  logoutButton: {
    alignItems: "center",
    backgroundColor: colors.palette.secondary500,
    borderRadius: 5,
    paddingVertical: 15,
  },
  success: { color: colors.palette.biancaSuccess, fontSize: 16, marginBottom: 10, textAlign: "center" },
  unverifiedBanner: {
    backgroundColor: colors.palette.biancaWarning || '#ffa500',
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
