import React, { useState, useEffect, useRef } from "react"
import {
  ScrollView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  FlatList,
  Modal,
  Animated,
  Dimensions,
} from "react-native"
import { Text, TextField } from "app/components"
import { useSelector, useDispatch } from "react-redux"
import { store } from "../store/store"
import AvatarPicker from "../components/AvatarPicker"
import { translate } from "../i18n"
import { LoadingButton, Button, PhoneInputWeb } from "app/components"
import { PatientReassignmentModal } from "../components/PatientReassignmentModal"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { getCaregiver, clearCaregiver } from "../store/caregiverSlice"
import { getOrg } from "../store/orgSlice"
import { getCurrentUser } from "../store/authSlice"
import { logger } from "../utils/logger"
import {
  useUpdateCaregiverMutation,
  useUploadAvatarMutation,
  useDeleteCaregiverMutation,
  caregiverApi,
} from "../services/api/caregiverApi"
import { useSendInviteMutation } from "../services/api/orgApi"
import { useGetUnassignedPatientsQuery, useAssignUnassignedPatientsMutation } from "../services/api/patientApi"
import { LoadingScreen } from "./LoadingScreen"
import { useTheme } from "app/theme/ThemeContext"

// Remote default image URL (Gravatar "mystery person")
const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp"

function CaregiverScreen() {
  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  const dispatch = useDispatch()
  const caregiver = useSelector(getCaregiver)
  const currentOrg = useSelector(getOrg)
  const currentUser = useSelector(getCurrentUser)
  const { colors, isLoading: themeLoading } = useTheme()
  
  // Debug logging
  logger.debug('CaregiverScreen Debug:', {
    caregiver: caregiver?.id,
    currentOrg: currentOrg?.id,
    currentUser: currentUser?.id,
    isInviteMode: !caregiver
  })

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
  const [errorMessage, setErrorMessage] = useState("")
  
  // State for unassigned patients panel
  const [showUnassignedPanel, setShowUnassignedPanel] = useState(false)
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])
  const [assignmentSuccess, setAssignmentSuccess] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])
  
  // State for patient reassignment modal
  const [showReassignmentModal, setShowReassignmentModal] = useState(false)
  const [patientsToReassign, setPatientsToReassign] = useState<any[]>([])
  
  // Animation for the panel
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current

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
    // Accept international format with +1 country code or 10 digits
    const phoneRegex = /^(\+1\d{10}|\d{10})$/
    if (!phoneRegex.test(phone)) {
      setPhoneError("Invalid phone format (10 digits or +1XXXXXXXXXX)")
    } else {
      setPhoneError("")
    }
  }

  const handleDelete = () => {
    if (confirmDelete && caregiver && caregiver.id) {
      // Check if the caregiver has patients
      if (caregiver.patients && caregiver.patients.length > 0) {
        // Show reassignment modal
        setPatientsToReassign(caregiver.patients)
        setShowReassignmentModal(true)
        setConfirmDelete(false)
      } else {
        // No patients to reassign, proceed with deletion
        deleteCaregiver({ id: caregiver.id })
          .unwrap()
          .then(() => {
            dispatch(clearCaregiver())
            navigation.navigate("Caregivers")
          })
      }
    } else {
      setConfirmDelete(true)
    }
  }

  const handleCancelDelete = () => {
    setConfirmDelete(false)
  }

  const handleReassignmentComplete = () => {
    // Close the reassignment modal
    setShowReassignmentModal(false)
    setPatientsToReassign([])
    
    // Now proceed with caregiver deletion
    if (caregiver && caregiver.id) {
      deleteCaregiver({ id: caregiver.id })
        .unwrap()
        .then(() => {
          dispatch(clearCaregiver())
          navigation.navigate("Caregivers")
        })
    }
  }

  const handleReassignmentCancel = () => {
    setShowReassignmentModal(false)
    setPatientsToReassign([])
    setConfirmDelete(false)
  }

  // Functions for unassigned patients assignment
  const handleAssignUnassignedPatients = () => {
    setShowUnassignedPanel(true)
    setSelectedPatients([])
    setAssignmentSuccess(false)
    // Animate panel in
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }

  const handlePatientSelection = (patientId: string) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    )
  }

  const handleSelectAll = () => {
    if (unassignedPatients) {
      const allPatientIds = unassignedPatients.map(patient => patient.id || '').filter(id => id)
      setSelectedPatients(allPatientIds)
    }
  }

  const handleDeselectAll = () => {
    setSelectedPatients([])
  }

  const closeUnassignedPanel = () => {
    Animated.timing(slideAnim, {
      toValue: Dimensions.get('window').height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowUnassignedPanel(false)
      setSelectedPatients([])
      setAssignmentSuccess(false)
    })
  }

  const handleAssignSelectedPatients = async () => {
    if (selectedPatients.length === 0 || !caregiver?.id) return

    try {
      await assignUnassignedPatients({
        caregiverId: caregiver.id,
        patientIds: selectedPatients
      }).unwrap()
      
      setAssignmentSuccess(true)
      setSuccessMessage(`${selectedPatients.length} patient(s) assigned successfully!`)
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Close panel after a short delay to show success message
      timeoutRef.current = setTimeout(() => {
        closeUnassignedPanel()
        setSuccessMessage("")
        timeoutRef.current = null
      }, 2000)
    } catch (error: unknown) {
      console.error('Assignment error:', error)
      const errorMessage = error?.data?.message || "Failed to assign patients. Please try again."
      setSuccessMessage(`Error: ${errorMessage}`)
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        setSuccessMessage("")
        timeoutRef.current = null
      }, 5000)
    }
  }

  const handleSave = async () => {
    logger.debug('handleSave called', { caregiver, name, email, phone, emailError, phoneError })
    
    if (caregiver && caregiver.id) {
      // Update branch for an existing caregiver
      logger.debug('Updating existing caregiver')
      const updatedCaregiver = {
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
        console.error('Update error:', error)
        // Handle update error as needed
      }
    } else {
      // Invite branch for new caregiver
      logger.debug('Inviting new caregiver', { currentOrg, name, email, phone })
      
      // Check form validation
      if (!email || !phone || emailError || phoneError) {
        logger.debug('Form validation failed:', { email, phone, emailError, phoneError })
        return
      }
      
              try {
          if (currentOrg?.id) {
            logger.debug('Sending invite to backend...')
            const { caregiver: invitedCaregiver } = await sendInvite({
              orgId: currentOrg.id,
              name,
              email,
              phone,
            }).unwrap()
          
          logger.debug('Invite successful:', invitedCaregiver)
          
          // Invalidate caregiver list cache so the new invite appears immediately
          store.dispatch(
            caregiverApi.util.invalidateTags([{ type: "Caregiver", id: "LIST" }])
          )
          
          // Clear caregiver state and navigate to success screen
          dispatch(clearCaregiver())
          
          // Log navigation attempt for debugging
          logger.debug('Attempting navigation to CaregiverInvited screen', {
            caregiverId: invitedCaregiver.id,
            caregiverName: invitedCaregiver.name,
            caregiverEmail: invitedCaregiver.email
          })
          
          try {
            // Use CommonActions to ensure navigation works
            const { CommonActions } = require('@react-navigation/native')
            navigation.dispatch(
              CommonActions.navigate({
                name: "CaregiverInvited",
                params: {
                  caregiver: {
                    id: invitedCaregiver.id || "",
                    name: invitedCaregiver.name,
                    email: invitedCaregiver.email,
                  }
                }
              })
            )
            logger.debug('Navigation to CaregiverInvited called successfully via CommonActions')
          } catch (navError) {
            logger.error('Navigation to CaregiverInvited failed:', navError)
            // Fallback: try direct navigation
            try {
              navigation.navigate("CaregiverInvited" as never, {
                caregiver: {
                  id: invitedCaregiver.id || "",
                  name: invitedCaregiver.name,
                  email: invitedCaregiver.email,
                }
              } as never)
              logger.debug('Fallback navigation to CaregiverInvited called')
            } catch (fallbackError) {
              logger.error('Fallback navigation also failed:', fallbackError)
              // Final fallback: show success message on current screen
              setSuccessMessage(`Invitation sent to ${invitedCaregiver.name} at ${invitedCaregiver.email}`)
              // Clear timeout
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
              }
              timeoutRef.current = setTimeout(() => {
                setSuccessMessage("")
                timeoutRef.current = null
              }, 5000)
            }
          }
        } else {
          console.error('No currentOrg available')
          setErrorMessage("Error: No organization found.")
          
          // Clear any existing timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          
          timeoutRef.current = setTimeout(() => {
            setErrorMessage("")
            timeoutRef.current = null
          }, 5000)
        }
      } catch (error: unknown) {
        logger.error('Invite error:', error)
        logger.error('Invite error details:', {
          message: error?.message,
          data: error?.data,
          status: error?.status,
          originalStatus: error?.originalStatus
        })
        
        // Reset RTK Query error state to prevent duplicate error display
        sendInvite.reset()
        
        if (error?.data?.message === "Caregiver already invited") {
          setErrorMessage("This email is already invited.")
        } else if (error?.data?.message) {
          setErrorMessage(`Error: ${error.data.message}`)
        } else {
          setErrorMessage("An error occurred while sending the invite.")
        }
        
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        timeoutRef.current = setTimeout(() => {
          setErrorMessage("")
          timeoutRef.current = null
        }, 5000)
      }
    }
  }

  if (themeLoading) {
    return <LoadingScreen />
  }

  const styles = createStyles(colors)

  if (isUpdating || isDeleting || isInviting) {
    return <LoadingScreen />
  }

  return (
    <TouchableWithoutFeedback onPress={handleCancelDelete}>
      <View style={styles.container} testID="caregiver-screen">
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Only show RTK Query errors if we don't have a manual errorMessage set (to avoid duplicates) */}
        {(updateError || deleteError || (inviteError && !errorMessage)) && (
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
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <View style={styles.formCard}>
          <AvatarPicker
            initialAvatar={avatar || defaultAvatarUrl}
            onAvatarChanged={({ uri, blob }) => {
              setAvatar(uri)
              if (blob) setAvatarBlob(blob)
            }}
          />

          <TextField
            placeholderTx="caregiverScreen.namePlaceholder"
            value={name}
            onChangeText={setName}
            testID="caregiver-name-input"
            containerStyle={styles.inputContainer}
            inputWrapperStyle={styles.inputWrapper}
            style={styles.input}
          />
          <TextField
            placeholderTx="caregiverScreen.emailPlaceholder"
            value={email}
            onChangeText={validateEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            testID="caregiver-email-input"
            containerStyle={styles.inputContainer}
            inputWrapperStyle={styles.inputWrapper}
            style={styles.input}
            status={emailError ? "error" : undefined}
            helper={emailError || undefined}
          />
          <PhoneInputWeb
            style={styles.input}
            label={translate("caregiverScreen.phoneLabel")}
            placeholder={translate("caregiverScreen.phonePlaceholder")}
            value={phone}
            onChangeText={validatePhone}
            testID="caregiver-phone-input"
            containerStyle={styles.inputContainer}
            inputWrapperStyle={styles.inputWrapper}
            status={phoneError ? "error" : undefined}
            helper={phoneError || undefined}
          />

          <Button
            text={caregiver && caregiver.id ? translate("caregiverScreen.save") : translate("caregiverScreen.invite")}
            onPress={handleSave}
            accessibilityHint={caregiver && caregiver.id ? "Saves changes to this caregiver" : "Sends an invitation email to this caregiver"}
            disabled={!email || !phone || !!emailError || !!phoneError || isUpdating || isInviting}
            testID="caregiver-save-button"
            preset="primary"
            style={[
              styles.button,
              (!email || !phone || emailError || phoneError || isUpdating || isInviting) ? styles.buttonDisabled : undefined
            ]}
            textStyle={styles.buttonText}
          />

          {caregiver && caregiver.id && (
            <Button
              text={confirmDelete ? translate("caregiverScreen.confirmDelete") : translate("caregiverScreen.deleteCaregiver")}
              onPress={handleDelete}
              disabled={isDeleting}
              testID="delete-caregiver-button"
              accessibilityHint={confirmDelete ? "Permanently deletes this caregiver. This action cannot be undone." : "Tap once to confirm deletion, tap again to permanently delete this caregiver"}
              preset="danger"
              style={[
                styles.button,
                styles.deleteButton,
                isDeleting ? styles.buttonDisabled : undefined
              ]}
              textStyle={styles.buttonText}
            />
          )}

          {/* Assign Unassigned Patients Button - Only show for orgAdmins */}
          {caregiver && caregiver.id && currentUser?.role === 'orgAdmin' && (
            <Button
              text={translate("caregiverScreen.assignUnassignedPatients")}
              onPress={handleAssignUnassignedPatients}
              disabled={isLoadingUnassigned}
              testID="assign-unassigned-patients-button"
              preset="success"
              style={[
                styles.button,
                styles.assignButton,
                isLoadingUnassigned ? styles.buttonDisabled : undefined
              ]}
              textStyle={styles.buttonText}
            />
          )}
        </View>

        {/* Unassigned Patients Panel */}
        {showUnassignedPanel && (
          <Animated.View 
            style={[
              styles.panelOverlay,
              {
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Pressable 
              style={styles.panelBackdrop} 
              onPress={closeUnassignedPanel}
            />
            <View style={styles.panelContent} testID="assign-unassigned-patients-modal">
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>{translate("caregiverScreen.assignUnassignedPatientsTitle")}</Text>
                <Pressable
                  style={styles.panelCloseButton}
                  onPress={closeUnassignedPanel}
                >
                  <Text style={styles.panelCloseButtonText}>✕</Text>
                </Pressable>
              </View>
              
              {isLoadingUnassigned ? (
                <Text style={styles.loadingText} testID="unassigned-patients-loading">{translate("caregiverScreen.loadingUnassignedPatients")}</Text>
              ) : isAssigning ? (
                <Text style={styles.loadingText}>{translate("caregiverScreen.assigningPatients")}</Text>
              ) : assignmentSuccess ? (
                <Text style={styles.successText} testID="patients-assigned-success-message">{translate("caregiverScreen.patientsAssignedSuccess")}</Text>
              ) : unassignedPatients && unassignedPatients.length > 0 ? (
                <>
                  <View style={styles.selectionControls}>
                    <Button
                      text={translate("caregiverScreen.selectAll")}
                      onPress={handleSelectAll}
                      testID="select-all-patients-button"
                      style={styles.selectionButton}
                      textStyle={styles.selectionButtonText}
                      preset="default"
                    />
                    <Button
                      text={translate("caregiverScreen.deselectAll")}
                      onPress={handleDeselectAll}
                      testID="deselect-all-patients-button"
                      style={styles.selectionButton}
                      textStyle={styles.selectionButtonText}
                      preset="default"
                    />
                  </View>
                  
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
                        testID={`unassigned-patient-item-${item.name}`}
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
                  
                  <View style={styles.panelButtons}>
                    <Button
                      text={translate("caregiverScreen.assignSelected")}
                      onPress={handleAssignSelectedPatients}
                      disabled={selectedPatients.length === 0 || isAssigning}
                      testID="assign-selected-patients-button"
                      preset="success"
                      style={[
                        styles.panelButton,
                        styles.assignButton,
                        (selectedPatients.length === 0 || isAssigning) ? styles.buttonDisabled : undefined
                      ]}
                      textStyle={styles.panelButtonText}
                    />
                    
                    <Button
                      text={translate("common.cancel")}
                      onPress={closeUnassignedPanel}
                      testID="cancel-unassigned-panel-button"
                      preset="default"
                      style={[styles.panelButton, styles.cancelButton]}
                      textStyle={styles.panelButtonText}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.noPatientsText} testID="no-unassigned-patients-message">{translate("caregiverScreen.noUnassignedPatientsFound")}</Text>
              )}
            </View>
          </Animated.View>
        )}
        </ScrollView>

        {/* Patient Reassignment Modal */}
        {currentOrg && (
          <PatientReassignmentModal
            patients={patientsToReassign}
            isVisible={showReassignmentModal}
            onClose={handleReassignmentCancel}
            onComplete={handleReassignmentComplete}
            orgId={currentOrg.id!}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  assignButton: {
    // success preset handles background - only override if needed
  },
  button: {
    alignItems: "center",
    borderRadius: 5,
    marginBottom: 15,
    paddingVertical: 15,
    // Button preset handles background color - only override if needed
  },
  buttonDisabled: { opacity: 0.6 },
  // CRITICAL: Button text must always be white for colored button presets
  // The Button component's preset handles text color automatically
  // But we override to ensure white text on all colored backgrounds
  buttonText: { 
    fontSize: 18, 
    fontWeight: "600",
    // Always use white text for colored buttons (primary, danger, success presets)
    color: "#FFFFFF",
  },
  cancelButton: {
    // Default preset handles background automatically
    borderRadius: 5,
    padding: 10,
  },
  container: { backgroundColor: colors.palette.biancaBackground, flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { padding: 20 },
  deleteButton: {
    // danger preset handles background - only override if needed
  },
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
  inputContainer: {
    marginBottom: 15,
  },
  inputWrapper: {
    // TextField handles most styling automatically
  },
  input: {
    // TextField handles text color automatically via theme
  },
  loadingText: {
    marginBottom: 10,
  },
  panelButton: {
    // Button preset handles background automatically
    borderRadius: 5,
    padding: 10,
  },
  panelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    // Button preset handles text color automatically
    // Success preset = white text
    // Default preset = theme-aware text
  },
  panelButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  panelCloseButton: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral300,
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    padding: 5,
    width: 30,
  },
  panelCloseButtonText: {
    color: colors.palette.neutral600,
    fontSize: 16,
    fontWeight: "bold",
  },
  panelContent: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 10,
    maxHeight: "80%",
    padding: 20,
    width: "100%",
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  panelBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  panelOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.palette.overlay50 || "rgba(0, 0, 0, 0.5)",
    height: "100%",
    justifyContent: "flex-end",
  },
  panelTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "bold",
  },
  noPatientsText: {
    fontSize: 16,
    textAlign: "center",
  },
  patientEmail: {
    fontSize: 14,
  },
  patientItem: {
    borderBottomColor: colors.palette.neutral300,
    borderBottomWidth: 1,
    padding: 10,
  },
  patientList: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  selectedIndicator: {
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 10,
  },
  selectedPatientItem: {
    backgroundColor: colors.palette.biancaSuccessBackground,
  },
  selectionButton: {
    backgroundColor: colors.palette.neutral300,
    borderRadius: 5,
    flex: 0.48,
    padding: 8,
  },
  selectionButtonText: {
    color: colors.palette.neutral700,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  selectionControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  success: { color: colors.palette.biancaSuccess, fontSize: 16, marginBottom: 10, textAlign: "center" },
  successText: {
    color: colors.palette.biancaSuccess,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
})

export { CaregiverScreen }
