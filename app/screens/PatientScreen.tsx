import React, { useState, useEffect } from "react"
import { useSelector } from "react-redux"
import {
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
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
import { LoadingScreen } from "./LoadingScreen" // import the LoadingScreen component

export function PatientScreen() {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>()
  const patient = useSelector(getPatient)
  //const [uploadAvatar] = patient ? useUploadPatientAvatarMutation() : [() => {}];
  const [updatePatient, { isLoading: isUpdating, error: updateError }] = useUpdatePatientMutation()
  const [createPatient, { isLoading: isCreating, error: createError }] = useCreatePatientMutation()
  const [deletePatient, { isLoading: isDeleting, error: deleteError }] = useDeletePatientMutation()
  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState('');
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
    const phoneRegex = /^\d{10}$/ // Adjust this regex to match the phone number format you want
    if (!phoneRegex.test(phone)) {
      setPhoneError("Invalid phone format")
    } else {
      setPhoneError("")
    }
  }

  const handleManageSchedules = () => {
    navigation.navigate('Schedule');
  };

  const handleManageConversations = () => {
    navigation.navigate("Conversations");
  };

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
        }
      })
        .unwrap()
        .then(() => navigation.navigate("Home"))
      // if (avatar !== patient.avatar) {
      //   console.log('avatar', avatar);
      //   await uploadAvatar({
      //     id: patient.id,
      //     avatar,
      //   })
      //   patient.avatar = avatar;
      //}
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
        .then((newPatient) => {
          // if (avatar && newPatient && newPatient.id) {
          //   uploadAvatar({
          //     id: newPatient.id,
          //     avatar,
          //   })
          //   newPatient.avatar = avatar;
          // }
          navigation.navigate("Home")
        })
    }
  }

  if (isCreating || isUpdating || isDeleting) {
    return <LoadingScreen /> // use the LoadingScreen component
  }

  return (
    <TouchableWithoutFeedback onPress={handleCancelDelete}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Patient Information</Text>
        {createError && "data" in createError && (
          <Text style={styles.error}>
            Error: {(createError.data as { message: string }).message}
          </Text>
        )}
        {updateError && "data" in updateError && (
          <Text style={styles.error}>
            Error: {(updateError.data as { message: string }).message}
          </Text>
        )}
        {deleteError && "data" in deleteError && (
          <Text style={styles.error}>
            Error: {(deleteError.data as { message: string }).message}
          </Text>
        )}
        <AvatarPicker initialAvatar={avatar} onAvatarChanged={setAvatar} />
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={validateEmail}
        />
        {emailError && <Text style={styles.error}>{emailError}</Text>}
        <TextInput
          style={styles.input}
          placeholder="Phone"
          value={phone}
          onChangeText={validatePhone}
        />
        {phoneError && <Text style={styles.error}>{phoneError}</Text>}
        <Pressable
          style={[
            styles.button,
            (!email || !phone || !!emailError || !!phoneError) && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={!email || !phone || !!emailError || !!phoneError}
        >
          <Text style={styles.buttonText}>SAVE</Text>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            (!email || !phone || !!emailError || !!phoneError) && styles.buttonDisabled,
          ]}
          onPress={handleDelete}
          disabled={!patient || !patient.id}
        >
          <Text style={styles.buttonText}>{confirmDelete ? "CONFIRM DELETE" : "DELETE"}</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={handleManageSchedules}
        >
          <Text style={styles.buttonText}>Manage Schedules</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={handleManageConversations}>
          <Text style={styles.buttonText}>Manage Conversations</Text>
        </Pressable>
      </ScrollView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  button: {
    backgroundColor: "#3498db",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: "#3498db",
    opacity: 0.5,
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  error: {
    color: "red",
    // Add any other styles you want
  },
})
