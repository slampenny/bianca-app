import React, { useState, useEffect } from "react"
import {
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native"
import { useSelector } from "react-redux"
import AvatarPicker from "../components/AvatarPicker"
import { LegalLinks } from "app/components/LegalLinks"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { getCaregiver } from "../store/caregiverSlice"
import { useUpdateCaregiverMutation, useUploadAvatarMutation } from "../services/api/caregiverApi"
import { LoadingScreen } from "./LoadingScreen"
import { colors } from "app/theme/colors"
import { navigationRef } from "app/navigators/navigationUtilities"

function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()

  // Get the current user (who is a caregiver)
  const currentUser = useSelector(getCaregiver)

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

  const validateEmail = (email: string) => {
    setEmail(email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEmailError("Invalid email format")
    } else {
      setEmailError("")
    }
  }

  const validatePhone = (phone: string) => {
    setPhone(phone)
    const phoneRegex = /^\d{10}$/
    if (!phoneRegex.test(phone)) {
      setPhoneError("Invalid phone format")
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
      setSuccessMessage("Your profile was updated successfully!")

      // Navigate back after a brief delay to show the success message
      setTimeout(() => {
        navigation.goBack()
      }, 1000)
    } catch (error) {
      setSuccessMessage("Failed to update profile. Please try again.")
      setTimeout(() => setSuccessMessage(""), 2000)
    }
  }

  if (isUpdating || isUploading) {
    return <LoadingScreen />
  }

  return (
    <TouchableWithoutFeedback>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Your Profile</Text>

          <AvatarPicker
            initialAvatar={avatar}
            onAvatarChanged={({ uri, blob }) => {
              setAvatar(uri)
              if (blob) setAvatarBlob(blob)
            }}
          />

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={colors.palette.neutral600}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.palette.neutral600}
            value={email}
            onChangeText={validateEmail}
          />
          {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Phone"
            placeholderTextColor={colors.palette.neutral600}
            value={phone}
            onChangeText={validatePhone}
          />
          {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

          <Pressable
            style={[
              styles.button,
              (!email || !phone || emailError || phoneError) ? styles.buttonDisabled : undefined,
            ]}
            onPress={handleSave}
            disabled={!email || !phone || !!emailError || !!phoneError}
          >
            <Text style={styles.buttonText}>UPDATE PROFILE</Text>
          </Pressable>

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.buttonText}>LOGOUT</Text>
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
  legalLinks: {
    marginTop: 20,
    alignSelf: "center",
  },
})

export { ProfileScreen }
