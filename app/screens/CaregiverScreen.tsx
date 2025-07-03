import React, { useState, useEffect } from "react"
import {
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  FlatList,
  Modal,
} from "react-native"
import { useSelector, useDispatch } from "react-redux"
import AvatarPicker from "../components/AvatarPicker"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { getCaregiver, getCurrentOrg, clearCaregiver } from "../store/caregiverSlice"
import { getCurrentUser } from "../store/authSlice"
import {
  useUpdateCaregiverMutation,
  useUploadAvatarMutation,
  useDeleteCaregiverMutation,
} from "../services/api/caregiverApi"
import { useSendInviteMutation } from "../services/api/orgApi"
import { useGetUnassignedPatientsQuery, useAssignUnassignedPatientsMutation } from "../services/api/patientApi"
import { LoadingScreen } from "./LoadingScreen"
import { colors } from "app/theme/colors"

// Remote default image URL (Gravatar "mystery person")
const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp"

function CaregiverScreen() {
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const dispatch = useDispatch()
  const caregiver = useSelector(getCaregiver)
  const currentOrg = useSelector(getCurrentOrg)
  const currentUser = useSelector(getCurrentUser)

  // Mutations for editing/deleting
  const [updateCaregiver, { isLoading: isUpdating, error: updateError }] =
    useUpdateCaregiverMutation()
  const [uploadAvatar] = useUploadAvatarMutation()
  const [deleteCaregiver, { isLoading: isDeleting, error: deleteError }] =
    useDeleteCaregiverMutation()

  // Mutation for inviting a new caregiver
  const [sendInvite, { isLoading: isInviting, error: inviteError }] = useSendInviteMutation()

  // Queries and mutations for unassigned patients
  const { data: unassignedPatients, isLoading: isLoadingUnassigned } = useGetUnassignedPatientsQuery()
  const [assignUnassignedPatients, { isLoading: isAssigning }] = useAssignUnassignedPatientsMutation()

  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState("")
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [emailError, setEmailError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  
  // State for unassigned patients modal
  const [showUnassignedModal, setShowUnassignedModal] = useState(false)
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])

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

  // Functions for unassigned patients assignment
  const handleAssignUnassignedPatients = () => {
    setShowUnassignedModal(true)
    setSelectedPatients([])
  }

  const handlePatientSelection = (patientId: string) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    )
  }

  const handleAssignSelectedPatients = async () => {
    if (selectedPatients.length === 0 || !caregiver?.id) return

    try {
      await assignUnassignedPatients({
        caregiverId: caregiver.id,
        patientIds: selectedPatients
      }).unwrap()
      
      setSuccessMessage(`${selectedPatients.length} patient(s) assigned successfully!`)
      setShowUnassignedModal(false)
      setSelectedPatients([])
      
      setTimeout(() => {
        setSuccessMessage("")
      }, 3000)
    } catch (error) {
      setSuccessMessage("Failed to assign patients. Please try again.")
      setTimeout(() => {
        setSuccessMessage("")
      }, 3000)
    }
  }

  const handleSave = async () => {
    if (caregiver && caregiver.id) {
      // Update branch for an existing caregiver
      const updatedCaregiver = {
        ...caregiver,
        name,
        avatar,
        email,
        phone,
      }
      try {
        // If the avatar has changed and there's a new blob, upload it first.
        if (avatar !== caregiver.avatar && avatarBlob) {
          await uploadAvatar({ id: caregiver.id, avatar: avatarBlob }).unwrap()
          updatedCaregiver.avatar = avatar
        }
        await updateCaregiver({ id: caregiver.id, caregiver: updatedCaregiver }).unwrap()
        navigation.navigate("Caregivers")
      } catch (error) {
        // Handle update error as needed
      }
    } else {
      // Invite branch for new caregiver
      try {
        if (currentOrg) {
          const { caregiver: invitedCaregiver } = await sendInvite({
            orgId: currentOrg,
            name,
            email,
            phone,
          }).unwrap()
          setSuccessMessage(`Invitation sent to ${invitedCaregiver.name}!`)
          dispatch(clearCaregiver())
          setTimeout(() => {
            setSuccessMessage("")
            navigation.navigate("Caregivers")
          }, 2000)
        }
      } catch (error: any) {
        if (error?.data?.message === "Caregiver already invited") {
          setSuccessMessage("This email is already invited.")
          setTimeout(() => {
            setSuccessMessage("")
          }, 2000)
        } else {
          setSuccessMessage("An error occurred while sending the invite.")
          setTimeout(() => {
            setSuccessMessage("")
          }, 2000)
        }
      }
    }
  }

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

        {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

        <View style={styles.formCard}>
          <AvatarPicker
            initialAvatar={avatar || defaultAvatarUrl}
            onAvatarChanged={({ uri, blob }) => {
              setAvatar(uri)
              if (blob) setAvatarBlob(blob)
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
              (!email || !phone || emailError || phoneError) ? styles.buttonDisabled : undefined,
            ]}
            onPress={handleSave}
            disabled={!email || !phone || !!emailError || !!phoneError}
          >
            <Text style={styles.buttonText}>{caregiver && caregiver.id ? "SAVE" : "INVITE"}</Text>
          </Pressable>

          {caregiver && caregiver.id && (
            <Pressable
              style={[
                styles.button,
                styles.deleteButton,
                (!caregiver || !caregiver.id) ? styles.buttonDisabled : undefined,
              ]}
              onPress={handleDelete}
              disabled={!caregiver || !caregiver.id}
            >
              <Text style={styles.buttonText}>{confirmDelete ? "CONFIRM DELETE" : "DELETE"}</Text>
            </Pressable>
          )}

          {/* Assign Unassigned Patients Button - Only show for orgAdmins */}
          {caregiver && caregiver.id && currentUser?.role === 'orgAdmin' && (
            <Pressable
              style={[styles.button, styles.assignButton]}
              onPress={handleAssignUnassignedPatients}
              disabled={isLoadingUnassigned}
            >
              <Text style={styles.buttonText}>
                {isLoadingUnassigned ? "Loading..." : "Assign Unassigned Patients"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Unassigned Patients Modal */}
        <Modal
          visible={showUnassignedModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowUnassignedModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Assign Unassigned Patients</Text>
              
              {isLoadingUnassigned ? (
                <Text style={styles.loadingText}>Loading unassigned patients...</Text>
              ) : unassignedPatients && unassignedPatients.length > 0 ? (
                <>
                  <FlatList
                    data={unassignedPatients}
                    keyExtractor={(item) => item.id || ''}
                    renderItem={({ item }) => (
                      <Pressable
                        style={[
                          styles.patientItem,
                          selectedPatients.includes(item.id || '') && styles.selectedPatientItem
                        ]}
                        onPress={() => handlePatientSelection(item.id || '')}
                      >
                        <Text style={styles.patientName}>{item.name}</Text>
                        <Text style={styles.patientEmail}>{item.email}</Text>
                        {selectedPatients.includes(item.id || '') && (
                          <Text style={styles.selectedIndicator}>✓</Text>
                        )}
                      </Pressable>
                    )}
                    style={styles.patientList}
                  />
                  
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[
                        styles.modalButton,
                        styles.cancelButton,
                        selectedPatients.length === 0 && styles.buttonDisabled
                      ]}
                      onPress={handleAssignSelectedPatients}
                      disabled={selectedPatients.length === 0 || isAssigning}
                    >
                      <Text style={styles.modalButtonText}>
                        {isAssigning ? "Assigning..." : `Assign Selected (${selectedPatients.length})`}
                      </Text>
                    </Pressable>
                    
                    <Pressable
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setShowUnassignedModal(false)}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={styles.noPatientsText}>No unassigned patients found.</Text>
              )}
            </View>
          </View>
        </Modal>
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
  deleteButton: { backgroundColor: colors.palette.angry500 },
  error: { color: colors.palette.biancaError, marginBottom: 10, textAlign: "center" },
  fieldError: { color: colors.palette.biancaError, fontSize: 14, marginBottom: 10 },
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
  success: { color: colors.palette.biancaSuccess, fontSize: 16, marginBottom: 10, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: colors.palette.neutral100,
    padding: 20,
    borderRadius: 10,
    width: "80%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  loadingText: {
    marginBottom: 10,
  },
  patientItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.neutral300,
  },
  selectedPatientItem: {
    backgroundColor: colors.palette.biancaSuccessBackground,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  patientEmail: {
    fontSize: 14,
  },
  selectedIndicator: {
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 10,
  },
  patientList: {
    flex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: colors.palette.biancaButtonSelected,
  },
  cancelButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: colors.palette.neutral400,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.palette.neutral100,
  },
  noPatientsText: {
    fontSize: 16,
    textAlign: "center",
  },
  assignButton: {
    backgroundColor: colors.palette.biancaSuccess,
  },
})

export { CaregiverScreen }
