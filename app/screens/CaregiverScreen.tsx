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
import { useSelector, useDispatch } from "react-redux"
import AvatarPicker from "../components/AvatarPicker"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { getCaregiver, getCurrentOrg, clearCaregiver } from "../store/caregiverSlice"
import { useUpdateCaregiverMutation, useUploadAvatarMutation, useDeleteCaregiverMutation } from "../services/api/caregiverApi"
import { useSendInviteMutation } from "../services/api/orgApi"
import { LoadingScreen } from "./LoadingScreen"

function CaregiverScreen() {
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const dispatch = useDispatch()
  const caregiver = useSelector(getCaregiver)
  const currentOrg = useSelector(getCurrentOrg)

  // Mutations for editing/deleting
  const [updateCaregiver, { isLoading: isUpdating, error: updateError }] = useUpdateCaregiverMutation()
  const [uploadAvatar] = useUploadAvatarMutation()
  const [deleteCaregiver, { isLoading: isDeleting, error: deleteError }] = useDeleteCaregiverMutation()

  // Mutation for inviting a new caregiver
  const [sendInvite, { isLoading: isInviting, error: inviteError }] = useSendInviteMutation()

  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [emailError, setEmailError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    if (caregiver) {
      // Editing mode: pre-fill the fields
      setName(caregiver.name)
      setAvatar(caregiver.avatar)
      setEmail(caregiver.email)
      setPhone(caregiver.phone)
    } else {
      // Invite mode: clear fields
      setName("")
      setAvatar("")
      setEmail("")
      setPhone("")
    }
  }, [caregiver])

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

  const handleDelete = () => {
    if (confirmDelete && caregiver && caregiver.id) {
      deleteCaregiver({ id: caregiver.id })
        .unwrap()
        .then(() => {
          dispatch(clearCaregiver())
          navigation.navigate("Caregivers")
        })
    } else {
      setConfirmDelete(true)
    }
  }

  const handleCancelDelete = () => {
    setConfirmDelete(false)
  }

  const handleSave = async () => {
    if (caregiver && caregiver.id) {
      // Update existing caregiver branch remains the same...
      const updatedCaregiver = {
        ...caregiver,
        name,
        avatar,
        email,
        phone,
      };
      try {
        if (avatar !== caregiver.avatar) {
          await uploadAvatar({ id: caregiver.id, avatar }).unwrap();
          updatedCaregiver.avatar = avatar;
        }
        await updateCaregiver({ id: caregiver.id, caregiver: updatedCaregiver }).unwrap();
        navigation.navigate("Caregivers");
      } catch (error) {
        // Handle update error as needed
      }
    } else {
      // Invite branch
      try {
        if (currentOrg) {
          const {caregiver: invitedCaregiver} = await sendInvite({
            orgId: currentOrg,
            name,
            email,
            phone,
          }).unwrap();
          setSuccessMessage(`Invitation sent to ${invitedCaregiver.name}!`);
          dispatch(clearCaregiver());
          setTimeout(() => {
            setSuccessMessage("");
            navigation.navigate("Caregivers");
          }, 2000);
        }
      } catch (error: any) {
        // Check if the error message indicates the caregiver was already invited.
        if (error?.data?.message === "Caregiver already invited") {
          setSuccessMessage("This email is already invited.");
          // Optionally, clear the form or perform other UI updates.
          setTimeout(() => {
            setSuccessMessage("");
          }, 2000);
        } else {
          // Display a generic error
          setSuccessMessage("An error occurred while sending the invite.");
          setTimeout(() => {
            setSuccessMessage("");
          }, 2000);
        }
      }
    }
  };  

  if (isUpdating || isDeleting || isInviting) {
    return <LoadingScreen />
  }

  return (
    <TouchableWithoutFeedback onPress={handleCancelDelete}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {(updateError || deleteError || inviteError) && (
          <Text style={styles.error}>
            {updateError && "data" in updateError
              ? `Error: ${(updateError.data as { message: string }).message}`
              : deleteError && "data" in deleteError
              ? `Error: ${(deleteError.data as { message: string }).message}`
              : inviteError && "data" in inviteError
              ? `Error: ${(inviteError.data as { message: string }).message}`
              : "An error occurred"}
          </Text>
        )}

        {successMessage ? (
          <Text style={styles.success}>{successMessage}</Text>
        ) : null}

        <View style={styles.formCard}>
          <AvatarPicker initialAvatar={avatar} onAvatarChanged={setAvatar} />

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
            <Text style={styles.buttonText}>
              {caregiver && caregiver.id ? "SAVE" : "INVITE"}
            </Text>
          </Pressable>

          {caregiver && caregiver.id && (
            <Pressable
              style={[
                styles.button,
                styles.deleteButton,
                (!caregiver || !caregiver.id) && styles.buttonDisabled,
              ]}
              onPress={handleDelete}
              disabled={!caregiver || !caregiver.id}
            >
              <Text style={styles.buttonText}>
                {confirmDelete ? "CONFIRM DELETE" : "DELETE"}
              </Text>
            </Pressable>
          )}
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
  fieldError: { color: "red", fontSize: 14, marginBottom: 10 },
  button: {
    backgroundColor: "#3498db",
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 15,
  },
  deleteButton: { backgroundColor: "#e74c3c" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
})

export { CaregiverScreen }
