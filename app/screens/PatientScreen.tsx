import React, { useState, useEffect } from "react"
import { useSelector } from "react-redux"
import {
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native"
import AvatarPicker from "../components/AvatarPicker"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { HomeStackParamList } from "app/navigators/navigationTypes"
import { getPatient } from "../store/patientSlice"
import {
  useCreatePatientMutation,
  useUpdatePatientMutation,
  useDeletePatientMutation,
} from "../services/api/patientApi"
import { LoadingScreen } from "./LoadingScreen"

function PatientScreen() {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>()
  const patient = useSelector(getPatient)
  const [updatePatient, { isLoading: isUpdating, error: updateError }] = useUpdatePatientMutation()
  const [createPatient, { isLoading: isCreating, error: createError }] = useCreatePatientMutation()
  const [deletePatient, { isLoading: isDeleting, error: deleteError }] = useDeletePatientMutation()

  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [emailError, setEmailError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (patient) {
      setName(patient.name)
      setAvatar(patient.avatar)
      setEmail(patient.email)
      setPhone(patient.phone)
    }
  }, [patient])

  const handleDelete = () => {
    if (confirmDelete && patient && patient.id) {
      deletePatient({ id: patient.id })
        .unwrap()
        .then(() => navigation.navigate("Home"))
    } else {
      setConfirmDelete(true)
    }
  }

  const handleCancelDelete = () => {
    setConfirmDelete(false)
  }

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

  const handleManageSchedules = () => {
    navigation.navigate("Schedule")
  }

  const handleManageConversations = () => {
    navigation.navigate("Conversations")
  }

  const handleSave = async () => {
    if (patient && patient.id) {
      await updatePatient({
        id: patient.id,
        patient: {
          ...patient,
          name,
          avatar,
          email,
          phone,
        },
      })
        .unwrap()
        .then(() => navigation.navigate("Home"))
    } else {
      createPatient({
        patient: {
          name,
          avatar,
          email,
          phone,
        },
      })
        .unwrap()
        .then(() => navigation.navigate("Home"))
    }
  }

  if (isCreating || isUpdating || isDeleting) {
    return <LoadingScreen />
  }

  return (
    <TouchableWithoutFeedback onPress={handleCancelDelete}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {(createError || updateError || deleteError) && (
          <Text style={styles.error}>
            {createError && "data" in createError
              ? `Error: ${(createError.data as { message: string }).message}`
              : updateError && "data" in updateError
              ? `Error: ${(updateError.data as { message: string }).message}`
              : deleteError && "data" in deleteError
              ? `Error: ${(deleteError.data as { message: string }).message}`
              : "An error occurred"}
          </Text>
        )}

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
            <Text style={styles.buttonText}>SAVE</Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              styles.deleteButton,
              (!patient || !patient.id) && styles.buttonDisabled,
            ]}
            onPress={handleDelete}
            disabled={!patient || !patient.id}
          >
            <Text style={styles.buttonText}>
              {confirmDelete ? "CONFIRM DELETE" : "DELETE"}
            </Text>
          </Pressable>

          <Pressable style={styles.button} onPress={handleManageSchedules}>
            <Text style={styles.buttonText}>Manage Schedules</Text>
          </Pressable>

          <Pressable style={styles.button} onPress={handleManageConversations}>
            <Text style={styles.buttonText}>Manage Conversations</Text>
          </Pressable>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ecf0f1",
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#ddd",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#2c3e50",
  },
  error: {
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
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
  fieldError: {
    color: "red",
    fontSize: 14,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#3498db",
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 15,
  },
  deleteButton: {
    backgroundColor: "#e74c3c",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
})

export { PatientScreen }
