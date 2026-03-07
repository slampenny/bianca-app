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
import { getClient, setClient, setClientsForCaregiver, getClientsForCaregiver } from "../store/clientSlice"
import { getCurrentUser } from "../store/authSlice"
import { store } from "../store/store"
import {
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
  useUploadClientAvatarMutation,
} from "../services/api/clientApi"
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

function ClientScreen() {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>()
  const dispatch = useDispatch()
  const client = useSelector(getClient)
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
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  // Get current user for role-based access control
  const currentUser = useSelector(getCurrentUser)
  
  // Check if user has permission to create or edit clients
  const canCreateOrEditClient = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'
  const canManageCaregivers = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'

  const [updateClient, { isLoading: isUpdating, error: updateError }] = useUpdateClientMutation()
  const [createClient, { isLoading: isCreating, error: createError }] = useCreateClientMutation()
  const [deleteClient, { isLoading: isDeleting, error: deleteError }] = useDeleteClientMutation()
  const [uploadAvatar, { isLoading: isUploading, error: uploadError }] =
    useUploadClientAvatarMutation()

  // --- Effects ---

  // Sync local form data with Redux client whenever it changes
  useEffect(() => {
    if (client) {
      setName(client.name)
      setEmail(client.email)
      // Format phone number for display (remove +1 country code if present)
      const formattedPhone = client.phone?.replace(/^\+1/, '').replace(/\D/g, '')
      setPhone(formattedPhone || '')
      setAvatar(client.avatar || defaultAvatarUrl) // Ensure default if avatar is null/empty
      setPreferredLanguage(client.preferredLanguage || DEFAULT_LANGUAGE)
      // Reset errors and success message when client changes
      setEmailError("")
      setPhoneError("")
      setApiError("")
      setSuccessMessage("")
      setAvatarBlob(undefined) // Clear any previously selected blob
      setConfirmDelete(false) // Reset delete confirmation
    } else {
      // Reset form for new client
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
  }, [client])

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
    if (confirmDelete && client && client.id) {
      // Use async/await to avoid race conditions
      void deleteClient({ id: client.id })
        .unwrap()
        .then(() => {
          // Check if component is still mounted before updating state
          if (isMountedRef.current) {
            dispatch(setClient(null))
            ;(navigation as { navigate: (name: string) => void }).navigate("Home") // Navigate away on delete
          }
        })
        .catch((err: unknown) => {
          if (isMountedRef.current) {
            logger.error("Delete Client Error", err)
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
      if (client && client.id) {
        // --- Existing client update flow ---
        const updatedClientData = {
          id: client.id,
          client: {
            ...client,
            name,
            email,
            phone,
            preferredLanguage,
            avatar: client.avatar,
          },
        }

        // 1. Upload Avatar if changed
        let uploadedAvatarUrl = client.avatar // Keep track of the potentially new URL
        if (avatar !== client.avatar && avatarBlob) {
          try {
            const uploadResult = await uploadAvatar({ id: client.id, avatar: avatarBlob }).unwrap()
            uploadedAvatarUrl = uploadResult.avatar // Get the new URL from backend
            updatedClientData.client.avatar = uploadedAvatarUrl // Update payload
            setAvatarBlob(undefined) // Clear the blob after successful upload
          } catch (err) {
            logger.error("Avatar upload error during update:", err)
            // Error is captured by uploadError state and handled by useEffect
            // Optionally set a specific message: setApiError(`Avatar upload failed: ${extractErrorMessage(err)}`);
            return // Stop the save process if avatar upload fails
          }
        } else if (avatar !== client.avatar && !avatarBlob) {
          // Handle case where user picked a new avatar from gallery *then* maybe cleared it or encountered an issue getting blob
          // This might mean reverting to the default or previous avatar depending on UX choice
          // For now, let's assume if URI changed but no blob, we keep the *original* avatar from redux state
          updatedClientData.client.avatar = client.avatar
          // Optionally, reset the displayed avatar URI back to original
          // setAvatar(client.avatar);
        }

        // 2. Update Client Data (including potentially new avatar URL)
        const result = await updateClient(updatedClientData).unwrap()
        dispatch(setClient(result))
        setSuccessMessage("Client updated successfully!")
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current)
        }
        
        // Navigate back to home screen after successful update
        successTimeoutRef.current = setTimeout(() => {
          (navigation.navigate as (name: string) => void)("Home")
          successTimeoutRef.current = null
        }, TIMEOUTS.NAVIGATION_DELAY)
      } else {
        // --- New client creation flow ---
        console.log('[CLIENT SCREEN] Creating client with data:', { name, email, phone, preferredLanguage })
        const createdClient = await createClient({
          client: {
            name,
            email,
            phone,
            preferredLanguage,
            avatar: undefined,
          },
        }).unwrap()
        console.log('[CLIENT SCREEN] Client created, response:', JSON.stringify(createdClient, null, 2))
        console.log('[CLIENT SCREEN] Created client caregivers array:', createdClient.caregivers)
        let finalClient = createdClient

        // 2. Upload Avatar if selected for the new client
        if (avatarBlob && createdClient.id) {
          try {
            const uploadResult = await uploadAvatar({
              id: createdClient.id,
              avatar: avatarBlob,
            }).unwrap()
            if (uploadResult && uploadResult.avatar) {
              // 3. Update the newly created client record with the final avatar URL
              finalClient = await updateClient({
                id: createdClient.id,
                client: { ...createdClient, avatar: uploadResult.avatar }, // Update only avatar field
              }).unwrap()
              setAvatarBlob(undefined) // Clear blob after successful upload and final update
            }
          } catch (err) {
            logger.error("Avatar upload/update error during create:", err)
            setApiError(`Client created, but avatar upload failed: ${extractErrorMessage(err)}`)
            dispatch(setClient(finalClient))
            // Still show partial success, but with error context
            return // Stop further processing in this block
          }
        }

        console.log('[CLIENT SCREEN] Dispatching setClient with:', JSON.stringify(finalClient, null, 2))
        dispatch(setClient(finalClient))
        // The reducer and onQueryStarted callback should handle this via the caregivers array
        // But as a fallback, we'll also add it here if the caregivers array includes the current user
        console.log('[CLIENT SCREEN] Current user:', currentUser?.id, currentUser?.name)
        console.log('[CLIENT SCREEN] Final client caregivers:', finalClient.caregivers)
        if (currentUser && currentUser.id && finalClient) {
          // Get current state from store
          const state = store.getState()
          const userClients = getClientsForCaregiver(state, currentUser.id)
          console.log(`[CLIENT SCREEN] Current user ${currentUser.id} has ${userClients.length} clients in Redux`)
          const existingIndex = userClients.findIndex((p) => p.id === finalClient.id)
          if (existingIndex === -1) {
            dispatch(setClientsForCaregiver({
              caregiverId: currentUser.id,
              clients: [...userClients, finalClient],
            }))
            // Check state after dispatch
            const newState = store.getState()
            const newUserClients = getClientsForCaregiver(newState, currentUser.id)
            console.log(`[CLIENT SCREEN] After dispatch, user ${currentUser.id} has ${newUserClients.length} clients`)
          }
        }
        
        setSuccessMessage("Client created successfully!")
        
        // Clear any existing timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current)
        }
        
        // Navigate to schedule screen after successful creation (immediately, no delay)
        navigation.navigate("Schedule", { isNewClient: true })
      }
    } catch (error) {
      // Errors from createClient or updateClient are caught here
      // These are already handled by the RTK Query error states and the useEffect hook
      console.error("Overall Save/Create Error", error)
      // setApiError is handled by the useEffect listening to mutation errors
    }
  }

  // --- Navigation Handlers ---
  const handleManageSchedules = () => {
    if (client && client.id) {
      navigation.navigate("Schedule") // Assuming "Schedule" is a valid route name
    }
  }

  const handleManageConversations = () => {
    if (client && client.id) {
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
            ? "Creating Client..."
            : isUploading
            ? "Uploading Avatar..."
            : isUpdating
            ? "Saving Changes..."
            : isDeleting
            ? "Deleting Client..."
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
        accessibilityLabel="client-screen"
        testID="client-screen"
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
            label={translate("clientScreen.nameLabel")}
            placeholder={translate("clientScreen.namePlaceholder")}
            value={name}
            onChangeText={handleNameChange}
            onFocus={clearMessages}
            testID="client-name-input"
            containerStyle={styles.inputContainer}
            inputWrapperStyle={styles.inputWrapper}
            style={styles.input}
          />

          <TextField
            label={translate("clientScreen.emailLabel")}
            placeholder={translate("clientScreen.emailPlaceholder")}
            value={email}
            onChangeText={validateEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            onFocus={clearMessages}
            testID="client-email-input"
            status={emailError ? "error" : undefined}
            helper={emailError || undefined}
            containerStyle={styles.inputContainer}
            inputWrapperStyle={styles.inputWrapper}
            style={styles.input}
          />
          
          {/* Display API Errors under email field */}
          {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

          <PhoneInputWeb
            label={translate("clientScreen.phoneLabel")}
            placeholder={translate("clientScreen.phonePlaceholder")}
            value={phone}
            onChangeText={validatePhone}
            onFocus={clearMessages}
            testID="client-phone-input"
            status={phoneError ? "error" : undefined}
            helper={phoneError || undefined}
            containerStyle={styles.inputContainer}
            inputWrapperStyle={styles.inputWrapper}
            style={styles.input}
          />

          {/* Language Picker Field */}
          <View style={styles.inputContainer}>
            <Text style={styles.fieldLabel}>{translate("clientScreen.preferredLanguageLabel")}</Text>
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
            text={client && client.id ? translate("clientScreen.updateClient") : translate("clientScreen.createClient")}
            onPress={handleSave}
            accessibilityHint={client && client.id ? "Saves changes to this client" : "Creates a new client"}
            disabled={
              !canCreateOrEditClient ||
              !name ||
              !email ||
              !phone ||
              !!emailError ||
              !!phoneError ||
              isLoading
            }
            testID="save-client-button"
            preset="primary"
            style={[styles.button, styles.saveButton, (!canCreateOrEditClient || !name || !email || !phone || !!emailError || !!phoneError) ? styles.buttonDisabled : undefined]}
            textStyle={styles.buttonText}
          />

          {/* Show Delete, Schedules, Conversations only for existing clients */}
          {client && client.id && (
            <>
              <Button
                text={translate("clientScreen.manageSchedules")}
                onPress={handleManageSchedules}
                disabled={isLoading}
                testID="manage-schedules-button"
                accessibilityHint="Opens screen to manage client schedules"
                preset="default"
                style={[styles.button, styles.manageButton]}
                textStyle={styles.buttonText}
              />

              <Button
                text={translate("clientScreen.manageConversations")}
                onPress={handleManageConversations}
                disabled={isLoading}
                testID="manage-conversations-button"
                accessibilityLabel={translate("clientScreen.manageConversations") || "Manage conversations"}
                accessibilityHint="Opens screen to view and manage client conversations"
                preset="default"
                style={[styles.button, styles.manageButton]}
                textStyle={styles.buttonText}
              />

              {canManageCaregivers && (
                <Button
                  text={translate("clientScreen.manageCaregivers")}
                  onPress={() => setShowCaregiverModal(true)}
                  disabled={isLoading}
                  testID="manage-caregivers-button"
                  preset="default"
                  style={[styles.button, styles.manageButton]}
                  textStyle={styles.buttonText}
                />
              )}

              <Button
                text={confirmDelete ? translate("clientScreen.confirmDelete") : translate("clientScreen.deleteClient")}
                onPress={handleDelete}
                disabled={isLoading}
                testID="delete-client-button"
                accessibilityHint={confirmDelete ? "Permanently deletes this client. This action cannot be undone." : "Tap once to confirm deletion, tap again to permanently delete this client"}
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
      {client && client.id && (
        <CaregiverAssignmentModal
          client={client}
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

export { ClientScreen }
