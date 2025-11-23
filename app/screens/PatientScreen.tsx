import React, { useState, useEffect, useRef } from "react" // Added useRef
import {
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Keyboard, // Added Keyboard
  Modal,
  FlatList,
} from "react-native"
import { useSelector, useDispatch } from "react-redux"
import AvatarPicker from "../components/AvatarPicker"
import { CaregiverAssignmentModal } from "../components/CaregiverAssignmentModal"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { HomeStackParamList } from "app/navigators/navigationTypes"
import { getPatient, setPatient } from "../store/patientSlice"
import { getCurrentUser } from "../store/authSlice"
import {
  useCreatePatientMutation,
  useUpdatePatientMutation,
  useDeletePatientMutation,
  useUploadPatientAvatarMutation,
} from "../services/api/patientApi"
import { LoadingScreen } from "./LoadingScreen"
import { useTheme } from "app/theme/ThemeContext"
import { Button, TextField, PhoneInputWeb } from "app/components"
import { LANGUAGE_OPTIONS, getLanguageByCode, DEFAULT_LANGUAGE, LanguageOption } from "../constants/languages"
import { translate } from "../i18n"
import { logger } from "../utils/logger"
import type { ThemeColors } from "../types"
import { TIMEOUTS } from "../constants"

// Remote default image URL (Gravatar "mystery person")
const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp"

// Helper to extract error messages from API errors
const extractErrorMessage = (error: any): string => {
  if (
    error &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data &&
    "message" in error.data
  ) {
    return (error.data as { message: string }).message
  }
  if (error && "error" in error) {
    return String(error.error)
  }
  return "An unknown error occurred."
}

function PatientScreen() {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>()
  const dispatch = useDispatch()
  const patient = useSelector(getPatient)
  const { colors, isLoading: themeLoading } = useTheme()

  // Local form data state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [avatar, setAvatar] = useState("")
  const [avatarBlob, setAvatarBlob] = useState<Blob | undefined>(undefined)
  const [preferredLanguage, setPreferredLanguage] = useState(DEFAULT_LANGUAGE)
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [apiError, setApiError] = useState("") // Consolidated API error state
  const [showCaregiverModal, setShowCaregiverModal] = useState(false)

  // Ref to store the timeout ID
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Get current user for role-based access control
  const currentUser = useSelector(getCurrentUser)
  
  // Check if user has permission to create or edit patients
  const canCreateOrEditPatient = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'
  
  // Check if user has permission to manage caregivers
  const canManageCaregivers = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'

  // --- RTK Query Hooks ---
  const [updatePatient, { isLoading: isUpdating, error: updateError }] = useUpdatePatientMutation()
  const [createPatient, { isLoading: isCreating, error: createError }] = useCreatePatientMutation()
  const [deletePatient, { isLoading: isDeleting, error: deleteError }] = useDeletePatientMutation()
  const [uploadAvatar, { isLoading: isUploading, error: uploadError }] =
    useUploadPatientAvatarMutation()

  // --- Effects ---

  // Sync local form data with Redux patient whenever it changes
  useEffect(() => {
    if (patient) {
      setName(patient.name)
      setEmail(patient.email)
      // Format phone number for display (remove +1 country code if present)
      const formattedPhone = patient.phone?.replace(/^\+1/, '').replace(/\D/g, '')
      setPhone(formattedPhone || '')
      setAvatar(patient.avatar || defaultAvatarUrl) // Ensure default if avatar is null/empty
      setPreferredLanguage(patient.preferredLanguage || DEFAULT_LANGUAGE)
      // Reset errors and success message when patient changes
      setEmailError("")
      setPhoneError("")
      setApiError("")
      setSuccessMessage("")
      setAvatarBlob(undefined) // Clear any previously selected blob
      setConfirmDelete(false) // Reset delete confirmation
    } else {
      // Reset form for new patient
      setName("")
      setEmail("")
      setPhone("")
      setAvatar(defaultAvatarUrl)
      setPreferredLanguage(DEFAULT_LANGUAGE)
      setEmailError("")
      setPhoneError("")
      setApiError("")
      setSuccessMessage("")
      setAvatarBlob(undefined)
      setConfirmDelete(false)
    }
  }, [patient])

  // Effect to clear the success message after a delay
  useEffect(() => {
    if (successMessage) {
      // Clear previous timeout if it exists
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
      // Set a new timeout
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage("")
      }, 3000) // Clear after 3 seconds
    }

    // Cleanup function to clear timeout if component unmounts
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [successMessage])

  // Effect to consolidate API errors
  useEffect(() => {
    let errorMsg = ""

    if (createError) errorMsg = `Error creating: ${extractErrorMessage(createError)}`
    else if (updateError) errorMsg = `Error updating: ${extractErrorMessage(updateError)}`
    else if (deleteError) errorMsg = `Error deleting: ${extractErrorMessage(deleteError)}`
    else if (uploadError) errorMsg = `Error uploading avatar: ${extractErrorMessage(uploadError)}`

    setApiError(errorMsg)
  }, [createError, updateError, deleteError, uploadError])

  // --- Validation ---
  const validateEmail = (input: string) => {
    setEmail(input)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    setEmailError(emailRegex.test(input) ? "" : translate("errors.invalidEmail"))
    clearMessages() // Clear success/api errors on input change
  }

  const validatePhone = (input: string) => {
    setPhone(input)
    // Accept international format with +1 country code and 10 digits, or just 10 digits
    const phoneRegex = /^(\+1\d{10}|\d{10})$/
    setPhoneError(phoneRegex.test(input) ? "" : "Invalid phone format (10 digits or +1XXXXXXXXXX)")
    clearMessages() // Clear success/api errors on input change
  }

  const handleNameChange = (input: string) => {
    setName(input)
    clearMessages() // Clear success/api errors on input change
  }

  const handleAvatarChange = ({ uri, blob }: { uri: string; blob?: Blob }) => {
    setAvatar(uri)
    if (blob) setAvatarBlob(blob)
    clearMessages() // Clear success/api errors on input change
  }

  // --- Handlers ---
  const clearMessages = () => {
    setSuccessMessage("")
    setApiError("")
  }

  const handleDelete = () => {
    if (confirmDelete && patient && patient.id) {
      // Use async/await to avoid race conditions
      deletePatient({ id: patient.id })
        .unwrap()
        .then(() => {
          // Check if component is still mounted before updating state
          if (isMounted()) {
            dispatch(setPatient(null)) // Clear patient from Redux
            navigation.navigate("Home") // Navigate away on delete
          }
        })
        .catch((err) => {
          if (isMounted()) {
            logger.error("Delete Patient Error", err)
            // Error handled by the useEffect hook for deleteError
          }
        })
    } else {
      setConfirmDelete(true)
      // Clear success message when delete is initiated
      setSuccessMessage("")
      setApiError("") // Clear API error too
    }
  }

  const handleCancelDelete = () => {
    setConfirmDelete(false)
  }

  const handleSave = async () => {
    Keyboard.dismiss() // Dismiss keyboard on save
    setSuccessMessage("") // Clear previous success message
    setApiError("") // Clear previous errors
    setConfirmDelete(false) // Cancel delete confirmation if pending

    // Basic frontend validation check
    if (!name || !email || !phone || emailError || phoneError) {
      setApiError("Please fix errors or fill all required fields (Name, Email, Phone).")
      return
    }

    try {
      if (patient && patient.id) {
        // --- Existing patient update flow ---
        const updatedPatientData = {
          id: patient.id, // Keep the ID separate for the update mutation argument
          patient: {
            // Patient data object for the payload
            ...patient, // Spread existing patient data first
            name,
            email,
            phone,
            preferredLanguage,
            avatar: patient.avatar, // Start with the current avatar
          },
        }

        // 1. Upload Avatar if changed
        let uploadedAvatarUrl = patient.avatar // Keep track of the potentially new URL
        if (avatar !== patient.avatar && avatarBlob) {
          try {
            const uploadResult = await uploadAvatar({ id: patient.id, avatar: avatarBlob }).unwrap()
            uploadedAvatarUrl = uploadResult.avatar // Get the new URL from backend
            updatedPatientData.patient.avatar = uploadedAvatarUrl // Update payload
            setAvatarBlob(undefined) // Clear the blob after successful upload
          } catch (err) {
            logger.error("Avatar upload error during update:", err)
            // Error is captured by uploadError state and handled by useEffect
            // Optionally set a specific message: setApiError(`Avatar upload failed: ${extractErrorMessage(err)}`);
            return // Stop the save process if avatar upload fails
          }
        } else if (avatar !== patient.avatar && !avatarBlob) {
          // Handle case where user picked a new avatar from gallery *then* maybe cleared it or encountered an issue getting blob
          // This might mean reverting to the default or previous avatar depending on UX choice
          // For now, let's assume if URI changed but no blob, we keep the *original* avatar from redux state
          updatedPatientData.patient.avatar = patient.avatar
          // Optionally, reset the displayed avatar URI back to original
          // setAvatar(patient.avatar);
        }

        // 2. Update Patient Data (including potentially new avatar URL)
        const result = await updatePatient(updatedPatientData).unwrap()
        dispatch(setPatient(result)) // Update Redux with the final patient data
        setSuccessMessage("Patient updated successfully!") // Show success message
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current)
        }
        
        // Navigate back to home screen after successful update
        successTimeoutRef.current = setTimeout(() => {
          navigation.navigate("Home")
          successTimeoutRef.current = null
        }, TIMEOUTS.NAVIGATION_DELAY)
      } else {
        // --- New patient creation flow ---

        // 1. Create Patient record (potentially without final avatar URL yet)
        const createdPatient = await createPatient({
          patient: {
            // id is assigned by backend
            name,
            email,
            phone,
            preferredLanguage,
            // Send undefined for avatar if not set, to match type expectations
            avatar: undefined, // Or defaultAvatarUrl - depends on backend logic
          },
        }).unwrap()

        let finalPatient = createdPatient // This holds the patient data *after* creation

        // 2. Upload Avatar if selected for the new patient
        if (avatarBlob && createdPatient.id) {
          try {
            const uploadResult = await uploadAvatar({
              id: createdPatient.id,
              avatar: avatarBlob,
            }).unwrap()
            if (uploadResult && uploadResult.avatar) {
              // 3. Update the newly created patient record with the final avatar URL
              finalPatient = await updatePatient({
                id: createdPatient.id,
                patient: { ...createdPatient, avatar: uploadResult.avatar }, // Update only avatar field
              }).unwrap()
              setAvatarBlob(undefined) // Clear blob after successful upload and final update
            }
          } catch (err) {
            logger.error("Avatar upload/update error during create:", err)
            // Error captured by hooks. Patient *might* be created without avatar.
            // Inform the user the main record was created but avatar failed.
            setApiError(`Patient created, but avatar upload failed: ${extractErrorMessage(err)}`)
            // Dispatch the patient *without* the failed avatar
            dispatch(setPatient(finalPatient))
            // Still show partial success, but with error context
            return // Stop further processing in this block
          }
        }

        // 4. Update Redux with the final patient data (either with or without uploaded avatar)
        dispatch(setPatient(finalPatient))
        setSuccessMessage("Patient created successfully!") // Show success message
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current)
        }
        
        // Navigate to schedule screen after successful creation (immediately, no delay)
        navigation.navigate("Schedule", { isNewPatient: true })
      }
    } catch (error) {
      // Errors from createPatient or updatePatient are caught here
      // These are already handled by the RTK Query error states and the useEffect hook
      console.error("Overall Save/Create Error", error)
      // setApiError is handled by the useEffect listening to mutation errors
    }
  }

  // --- Navigation Handlers ---
  const handleManageSchedules = () => {
    if (patient && patient.id) {
      navigation.navigate("Schedule") // Assuming "Schedule" is a valid route name
    }
  }

  const handleManageConversations = () => {
    if (patient && patient.id) {
      navigation.navigate("Conversations") // Assuming "Conversations" is a valid route name
    }
  }

  if (themeLoading) {
    return <LoadingScreen />
  }

  const styles = createStyles(colors)

  // --- Render Logic ---
  const isLoading = isCreating || isUpdating || isDeleting || isUploading
  if (isLoading) {
    return (
      <LoadingScreen
        message={
          isCreating
            ? "Creating Patient..."
            : isUploading
            ? "Uploading Avatar..."
            : isUpdating
            ? "Saving Changes..."
            : isDeleting
            ? "Deleting Patient..."
            : "Loading..."
        }
      />
    )
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="patient-screen"
        testID="patient-screen"
      >
        {/* Display Success Message */}
        {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

        <View style={styles.formCard}>
          <AvatarPicker
            // Use local avatar state which defaults correctly
            initialAvatar={avatar}
            onAvatarChanged={handleAvatarChange}
          />

          <TextField
            label={translate("patientScreen.nameLabel")}
            placeholder={translate("patientScreen.namePlaceholder")}
            value={name}
            onChangeText={handleNameChange}
            onFocus={clearMessages}
            testID="patient-name-input"
            containerStyle={styles.inputContainer}
            inputWrapperStyle={styles.inputWrapper}
            style={styles.input}
          />

          <TextField
            label={translate("patientScreen.emailLabel")}
            placeholder={translate("patientScreen.emailPlaceholder")}
            value={email}
            onChangeText={validateEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            onFocus={clearMessages}
            testID="patient-email-input"
            status={emailError ? "error" : undefined}
            helper={emailError || undefined}
            containerStyle={styles.inputContainer}
            inputWrapperStyle={styles.inputWrapper}
            style={styles.input}
          />
          
          {/* Display API Errors under email field */}
          {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

          <PhoneInputWeb
            label={translate("patientScreen.phoneLabel")}
            placeholder={translate("patientScreen.phonePlaceholder")}
            value={phone}
            onChangeText={validatePhone}
            onFocus={clearMessages}
            testID="patient-phone-input"
            status={phoneError ? "error" : undefined}
            helper={phoneError || undefined}
            containerStyle={styles.inputContainer}
            inputWrapperStyle={styles.inputWrapper}
            style={styles.input}
          />

          {/* Language Picker Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.fieldLabel}>{translate("patientScreen.preferredLanguageLabel")}</Text>
            <Pressable
              style={styles.languagePicker}
              onPress={() => setShowLanguagePicker(true)}
              testID="language-picker-button"
              accessibilityRole="button"
              accessibilityLabel={`Preferred language: ${getLanguageByCode(preferredLanguage).label}`}
              accessibilityHint="Opens language selection dialog"
            >
              <Text style={styles.languagePickerText}>
                {getLanguageByCode(preferredLanguage).label} ({getLanguageByCode(preferredLanguage).nativeName})
              </Text>
              <Text style={styles.languagePickerArrow}>▼</Text>
            </Pressable>
          </View>

          {/* --- Action Buttons --- */}
          <Button
            text={patient && patient.id ? translate("patientScreen.updatePatient") : translate("patientScreen.createPatient")}
            onPress={handleSave}
            accessibilityHint={patient && patient.id ? "Saves changes to this patient" : "Creates a new patient"}
            disabled={
              !canCreateOrEditPatient ||
              !name ||
              !email ||
              !phone ||
              !!emailError ||
              !!phoneError ||
              isLoading
            }
            testID="save-patient-button"
            preset="primary"
            style={[styles.button, styles.saveButton, (!canCreateOrEditPatient || !name || !email || !phone || !!emailError || !!phoneError) ? styles.buttonDisabled : undefined]}
            textStyle={styles.buttonText}
          />

          {/* Show Delete, Schedules, Conversations only for existing patients */}
          {patient && patient.id && (
            <>
              <Button
                text={translate("patientScreen.manageSchedules")}
                onPress={handleManageSchedules}
                disabled={isLoading}
                testID="manage-schedules-button"
                accessibilityHint="Opens screen to manage patient schedules"
                preset="default"
                style={[styles.button, styles.manageButton]}
                textStyle={styles.buttonText}
              />

              <Button
                text={translate("patientScreen.manageConversations")}
                onPress={handleManageConversations}
                disabled={isLoading}
                testID="manage-conversations-button"
                accessibilityLabel={translate("patientScreen.manageConversations") || "Manage conversations"}
                accessibilityHint="Opens screen to view and manage patient conversations"
                preset="default"
                style={[styles.button, styles.manageButton]}
                textStyle={styles.buttonText}
              />

              <Button
                text={translate("patientScreen.viewSentimentAnalysis")}
                onPress={() => navigation.navigate("SentimentAnalysis", {
                  patientId: patient.id!,
                  patientName: patient.name,
                })}
                disabled={isLoading}
                testID="view-sentiment-analysis-button"
                accessibilityHint="Opens sentiment analysis report for this patient"
                preset="default"
                style={[styles.button, styles.manageButton]}
                textStyle={styles.buttonText}
              />

              {canManageCaregivers && (
                <Button
                  text={translate("patientScreen.manageCaregivers")}
                  onPress={() => setShowCaregiverModal(true)}
                  disabled={isLoading}
                  testID="manage-caregivers-button"
                  preset="default"
                  style={[styles.button, styles.manageButton]}
                  textStyle={styles.buttonText}
                />
              )}

              <Button
                text={confirmDelete ? translate("patientScreen.confirmDelete") : translate("patientScreen.deletePatient")}
                onPress={handleDelete}
                disabled={isLoading}
                testID="delete-patient-button"
                accessibilityHint={confirmDelete ? "Permanently deletes this patient. This action cannot be undone." : "Tap once to confirm deletion, tap again to permanently delete this patient"}
                preset="danger"
                style={[styles.button, styles.deleteButton, isLoading ? styles.buttonDisabled : undefined]}
                textStyle={styles.buttonText}
              />
            </>
          )}
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLanguagePicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Language</Text>
                <FlatList
                  data={LANGUAGE_OPTIONS}
                  keyExtractor={(item) => item.code}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.languageOption,
                        item.code === preferredLanguage && styles.languageOptionSelected,
                      ]}
                      onPress={() => {
                        setPreferredLanguage(item.code)
                        setShowLanguagePicker(false)
                      }}
                      testID={`language-option-${item.code}`}
                    >
                      <Text style={[
                        styles.languageOptionText,
                        item.code === preferredLanguage && styles.languageOptionTextSelected,
                      ]}>
                        {item.label}
                      </Text>
                      <Text style={[
                        styles.languageOptionNative,
                        item.code === preferredLanguage && styles.languageOptionNativeSelected,
                      ]}>
                        {item.nativeName}
                      </Text>
                    </Pressable>
                  )}
                  style={styles.languageList}
                />
                <Button
                  text={translate("common.cancel")}
                  onPress={() => setShowLanguagePicker(false)}
                  style={styles.modalCancelButton}
                  preset="default"
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Caregiver Assignment Modal */}
      {patient && patient.id && (
        <CaregiverAssignmentModal
          patient={patient}
          isVisible={showCaregiverModal}
          onClose={() => setShowCaregiverModal(false)}
        />
      )}
    </>
  )
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    paddingVertical: 16, // Consistent padding
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 15, // Spacing between buttons
    justifyContent: "center",
    minHeight: 50, // Ensure buttons have a good tap height
  },
  buttonDisabled: {
    opacity: 0.5, // Standard disabled look
    backgroundColor: colors.palette.neutral300, // Grey out background when disabled
  },
  buttonText: {
    // Use neutral900 for colored buttons (same as Button component presets)
    // This ensures white/light text on colored backgrounds in both light and dark mode
    color: colors.palette?.neutral900 || colors.palette?.neutral100 || "#FFFFFF",
    fontSize: 16, // Slightly smaller font for more text
    fontWeight: "600",
    textAlign: "center",
  },
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40, // Add padding at the bottom
  },
  deleteButton: {
    backgroundColor: colors.palette.angry500, // Red for delete
  },
  error: {
    // General API error style (deprecated - use apiError instead)
    color: colors.palette.angry500, // Red
    textAlign: "center",
    marginBottom: 15,
    fontSize: 15,
    fontWeight: "500",
    backgroundColor: colors.palette.angry100, // Light red background
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.palette.overlay20,
  },
  apiError: {
    // API error style positioned under email field - visible in both light and dark modes
    color: colors.palette.angry500 || "#FF4444", // Bright red for visibility
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 4, // Align with input field
    fontWeight: "500",
    // Add background for better contrast in dark mode
    backgroundColor: colors.palette.angry100 || "rgba(255, 68, 68, 0.15)", // Light red background with opacity
    padding: 8,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.palette.angry500 || "#FF4444",
  },
  fieldError: {
    // Field-specific validation error
    color: colors.palette.angry500, // Darker red for field errors
    fontSize: 13,
    marginBottom: 10, // Space after error before next input
    paddingLeft: 5,
  },
  formCard: {
    backgroundColor: colors.palette.neutral100,
    padding: 20,
    borderRadius: 8, // Slightly larger radius
    marginBottom: 20,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4, // Slightly larger shadow
    elevation: 3,
  },
  input: {
    // TextField component handles all theming internally
    // Only override if absolutely necessary - let TextField manage colors
    fontSize: 16,
    // TextField already sets color: themeColors.palette.biancaHeader
    // TextField already sets backgroundColor on inputWrapper, not on input itself
  },
  inputContainer: {
    marginBottom: 15, // Increased margin between fields
  },
  inputWrapper: {
    // TextField component handles inputWrapper styling automatically
    // Only override if absolutely necessary
  },
  manageButton: {
    backgroundColor: colors.palette.secondary500, // Muted purple for manage buttons
  },
  saveButton: {
    backgroundColor: colors.palette.biancaButtonSelected, // Muted blue for save/update
  },
  success: {
    // Success message style
    color: colors.palette.biancaSuccess, // Green
    textAlign: "center",
    marginBottom: 15,
    fontSize: 15,
    fontWeight: "500",
    backgroundColor: colors.palette.biancaSuccessBackground, // Light green background
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.palette.overlay20,
  },

  // Language picker styles
  fieldLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text || colors.palette.biancaHeader || colors.palette.neutral800,
    marginBottom: 8,
  },
  languagePicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 50,
    borderColor: colors.palette.neutral300,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    backgroundColor: colors.palette.neutral100,
  },
  languagePickerText: {
    fontSize: 16,
    color: colors.text || colors.palette.biancaHeader || colors.palette.neutral800,
    flex: 1,
  },
  languagePickerArrow: {
    fontSize: 12,
    color: colors.palette.neutral500,
    marginLeft: 10,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.palette.overlay50 || colors.palette.overlay || 'rgba(0, 0, 0, 0.5)',
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: 20,
    maxHeight: "80%",
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.palette.biancaHeader,
    textAlign: "center",
    marginBottom: 20,
  },
  languageList: {
    maxHeight: 300,
  },
  languageOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 5,
    backgroundColor: colors.palette.neutral200,
  },
  languageOptionSelected: {
    backgroundColor: colors.palette.biancaButtonSelected,
  },
  languageOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.palette.biancaHeader,
    flex: 1,
  },
  languageOptionTextSelected: {
    color: colors.palette.neutral100,
  },
  languageOptionNative: {
    fontSize: 14,
    color: colors.palette.neutral600,
    marginLeft: 10,
  },
  languageOptionNativeSelected: {
    color: colors.palette.neutral200,
  },
  modalCancelButton: {
    marginTop: 15,
    backgroundColor: colors.palette.neutral300,
  },
})

export { PatientScreen }
