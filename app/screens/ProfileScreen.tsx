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
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { getCaregiver } from "../store/caregiverSlice"
import { useUpdateCaregiverMutation, useUploadAvatarMutation } from "../services/api/caregiverApi"
import { LoadingScreen } from "./LoadingScreen"

function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  
  // Get the current user (who is a caregiver)
  const currentUser = useSelector(getCaregiver)

  // Mutations for editing profile
  const [updateCaregiver, { isLoading: isUpdating, error: updateError }] = useUpdateCaregiverMutation()
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
      console.log('Current user avatar:', currentUser.avatar);
      setName(currentUser.name || "");
      setAvatar(currentUser.avatar || "");
      setEmail(currentUser.email || "");
      setPhone(currentUser.phone || "");
    }
  }, [currentUser]);

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
    navigation.navigate("Logout")
  }

  const handleSave = async () => {
    if (!currentUser || !currentUser.id) return;
    
    try {
      // Create updated user object
      const updatedCaregiver = {
        ...currentUser,
        name,
        email,
        phone,
      };
      
      // Upload avatar if changed
      if (avatar !== currentUser.avatar && avatarBlob) {
        try {
          // Use the updated uploadAvatar mutation
          const result = await uploadAvatar({ 
            id: currentUser.id, 
            avatar: avatarBlob 
          }).unwrap();
          
          // If the API returns the updated caregiver with avatar
          if (result && result.avatar) {
            updatedCaregiver.avatar = result.avatar;
          }
        } catch (avatarError) {
          console.error('Avatar upload error:', avatarError);
          // Continue with profile update even if avatar upload fails
        }
      }
      
      // Update profile
      await updateCaregiver({ 
        id: currentUser.id, 
        caregiver: updatedCaregiver 
      }).unwrap();
      
      // Show success message
      setSuccessMessage("Your profile was updated successfully!");
      
      // Navigate back after a brief delay to show the success message
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
    } catch (error) {
      setSuccessMessage("Failed to update profile. Please try again.");
      setTimeout(() => setSuccessMessage(""), 2000);
    }
  };

  if (isUpdating || isUploading) {
    return <LoadingScreen />
  }

  return (
    <TouchableWithoutFeedback>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {(updateError || uploadError) && (
          <Text style={styles.error}>
            {(updateError && "data" in updateError) 
              ? `Error: ${(updateError.data as { message: string }).message}`
              : (uploadError && "data" in uploadError)
              ? `Error uploading avatar: ${(uploadError.data as { message: string }).message}`
              : "An error occurred"}
          </Text>
        )}

        {successMessage ? (
          <Text style={styles.success}>{successMessage}</Text>
        ) : null}

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Your Profile</Text>
          
          <AvatarPicker 
            initialAvatar={avatar} 
            onAvatarChanged={({ uri, blob }) => {
              setAvatar(uri);
              if (blob) setAvatarBlob(blob);
            }} 
          />

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#7f8c8d"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#7f8c8d"
            value={email}
            onChangeText={validateEmail}
          />
          {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Phone"
            placeholderTextColor="#7f8c8d"
            value={phone}
            onChangeText={validatePhone}
          />
          {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

          <Pressable
            style={[
              styles.button,
              (!email || !phone || emailError || phoneError) && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={!email || !phone || !!emailError || !!phoneError}
          >
            <Text style={styles.buttonText}>UPDATE PROFILE</Text>
          </Pressable>

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.buttonText}>LOGOUT</Text>
          </Pressable>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ecf0f1" },
  contentContainer: { padding: 20 },
  error: { color: "red", textAlign: "center", marginBottom: 10 },
  success: { color: "green", textAlign: "center", marginBottom: 10, fontSize: 16 },
  formCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 6,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    height: 45,
    borderColor: "#bdc3c7",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontSize: 16,
    color: "#2c3e50",
  },
  fieldError: { 
    color: "red", 
    fontSize: 14, 
    marginBottom: 10,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#3498db",
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 15,
  },
  logoutButton: {
    backgroundColor: "#9b59b6", // Purple color for logout
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
})

export { ProfileScreen }