import React, { useState, useEffect, useRef } from "react"; // Added useRef
import {
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
    Keyboard // Added Keyboard
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import AvatarPicker from "../components/AvatarPicker";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { HomeStackParamList } from "app/navigators/navigationTypes";
import { getPatient, setPatient } from "../store/patientSlice";
import {
    useCreatePatientMutation,
    useUpdatePatientMutation,
    useDeletePatientMutation,
    useUploadPatientAvatarMutation,
} from "../services/api/patientApi";
import { LoadingScreen } from "./LoadingScreen";

// Remote default image URL (Gravatar "mystery person")
const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp";

function PatientScreen() {
    const navigation = useNavigation<NavigationProp<HomeStackParamList>>();
    const dispatch = useDispatch();
    const patient = useSelector(getPatient);

    // Local form data state
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [avatar, setAvatar] = useState("");
    const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
    const [emailError, setEmailError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [apiError, setApiError] = useState(""); // Consolidated API error state

    // Ref to store the timeout ID
    const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- RTK Query Hooks ---
    const [updatePatient, { isLoading: isUpdating, error: updateError }] = useUpdatePatientMutation();
    const [createPatient, { isLoading: isCreating, error: createError }] = useCreatePatientMutation();
    const [deletePatient, { isLoading: isDeleting, error: deleteError }] = useDeletePatientMutation();
    const [uploadAvatar, { isLoading: isUploading, error: uploadError }] = useUploadPatientAvatarMutation();

    // --- Effects ---

    // Sync local form data with Redux patient whenever it changes
    useEffect(() => {
        if (patient) {
            setName(patient.name);
            setEmail(patient.email);
            setPhone(patient.phone);
            setAvatar(patient.avatar || defaultAvatarUrl); // Ensure default if avatar is null/empty
            // Reset errors and success message when patient changes
            setEmailError("");
            setPhoneError("");
            setApiError("");
            setSuccessMessage("");
            setAvatarBlob(null); // Clear any previously selected blob
            setConfirmDelete(false); // Reset delete confirmation
        } else {
            // Reset form for new patient
            setName("");
            setEmail("");
            setPhone("");
            setAvatar(defaultAvatarUrl);
            setEmailError("");
            setPhoneError("");
            setApiError("");
            setSuccessMessage("");
            setAvatarBlob(null);
            setConfirmDelete(false);
        }
    }, [patient]);

    // Effect to clear the success message after a delay
    useEffect(() => {
        if (successMessage) {
            // Clear previous timeout if it exists
            if (successTimeoutRef.current) {
                clearTimeout(successTimeoutRef.current);
            }
            // Set a new timeout
            successTimeoutRef.current = setTimeout(() => {
                setSuccessMessage("");
            }, 3000); // Clear after 3 seconds
        }

        // Cleanup function to clear timeout if component unmounts
        return () => {
            if (successTimeoutRef.current) {
                clearTimeout(successTimeoutRef.current);
            }
        };
    }, [successMessage]);

     // Effect to consolidate API errors
    useEffect(() => {
        let errorMsg = "";
        const extractErrorMessage = (error: any): string => {
            if (error && "data" in error && typeof error.data === "object" && error.data && "message" in error.data) {
                return (error.data as { message: string }).message;
            }
            if (error && "error" in error) {
                 return String(error.error);
            }
            return "An unknown error occurred.";
        };

        if (createError) errorMsg = `Error creating: ${extractErrorMessage(createError)}`;
        else if (updateError) errorMsg = `Error updating: ${extractErrorMessage(updateError)}`;
        else if (deleteError) errorMsg = `Error deleting: ${extractErrorMessage(deleteError)}`;
        else if (uploadError) errorMsg = `Error uploading avatar: ${extractErrorMessage(uploadError)}`;

        setApiError(errorMsg);

    }, [createError, updateError, deleteError, uploadError]);


    // --- Validation ---
    const validateEmail = (input: string) => {
        setEmail(input);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        setEmailError(emailRegex.test(input) ? "" : "Invalid email format");
        clearMessages(); // Clear success/api errors on input change
    };

    const validatePhone = (input: string) => {
        setPhone(input);
        const phoneRegex = /^\d{10}$/; // Assuming 10 digit US/Canada format
        setPhoneError(phoneRegex.test(input) ? "" : "Invalid phone format (10 digits)");
         clearMessages(); // Clear success/api errors on input change
    };

    const handleNameChange = (input: string) => {
        setName(input);
        clearMessages(); // Clear success/api errors on input change
    }

    const handleAvatarChange = ({ uri, blob }: { uri: string, blob: Blob | null }) => {
        setAvatar(uri);
        if (blob) setAvatarBlob(blob);
         clearMessages(); // Clear success/api errors on input change
    }

    // --- Handlers ---
    const clearMessages = () => {
        setSuccessMessage("");
        setApiError("");
    }

    const handleDelete = () => {
        if (confirmDelete && patient && patient.id) {
            deletePatient({ id: patient.id })
                .unwrap()
                .then(() => {
                    dispatch(setPatient(null)); // Clear patient from Redux
                    navigation.navigate("Home"); // Navigate away on delete
                })
                .catch(err => {
                     console.error("Delete Patient Error", err);
                     // Error handled by the useEffect hook for deleteError
                });
        } else {
            setConfirmDelete(true);
            // Clear success message when delete is initiated
            setSuccessMessage("");
            setApiError(""); // Clear API error too
        }
    };

    const handleCancelDelete = () => {
        setConfirmDelete(false);
    };

    const handleSave = async () => {
        Keyboard.dismiss(); // Dismiss keyboard on save
        setSuccessMessage(""); // Clear previous success message
        setApiError(""); // Clear previous errors
        setConfirmDelete(false); // Cancel delete confirmation if pending

        // Basic frontend validation check
        if (!name || !email || !phone || emailError || phoneError) {
            setApiError("Please fix errors or fill all required fields (Name, Email, Phone).");
            return;
        }

        try {
            if (patient && patient.id) {
                // --- Existing patient update flow ---
                let updatedPatientData = {
                    id: patient.id, // Keep the ID separate for the update mutation argument
                    patient: { // Patient data object for the payload
                        ...patient, // Spread existing patient data first
                        name,
                        email,
                        phone,
                        avatar: patient.avatar, // Start with the current avatar
                    }
                };

                // 1. Upload Avatar if changed
                let uploadedAvatarUrl = patient.avatar; // Keep track of the potentially new URL
                if (avatar !== patient.avatar && avatarBlob) {
                     try {
                         const uploadResult = await uploadAvatar({ id: patient.id, avatar: avatarBlob }).unwrap();
                         uploadedAvatarUrl = uploadResult.avatar; // Get the new URL from backend
                         updatedPatientData.patient.avatar = uploadedAvatarUrl; // Update payload
                         setAvatarBlob(null); // Clear the blob after successful upload
                     } catch (err) {
                         console.error("Avatar upload error during update:", err);
                         // Error is captured by uploadError state and handled by useEffect
                         // Optionally set a specific message: setApiError(`Avatar upload failed: ${extractErrorMessage(err)}`);
                         return; // Stop the save process if avatar upload fails
                     }
                } else if (avatar !== patient.avatar && !avatarBlob) {
                    // Handle case where user picked a new avatar from gallery *then* maybe cleared it or encountered an issue getting blob
                    // This might mean reverting to the default or previous avatar depending on UX choice
                    // For now, let's assume if URI changed but no blob, we keep the *original* avatar from redux state
                    updatedPatientData.patient.avatar = patient.avatar;
                    // Optionally, reset the displayed avatar URI back to original
                    // setAvatar(patient.avatar);
                }


                // 2. Update Patient Data (including potentially new avatar URL)
                const result = await updatePatient(updatedPatientData).unwrap();
                dispatch(setPatient(result)); // Update Redux with the final patient data
                setSuccessMessage("Patient updated successfully!"); // Show success message
                // DO NOT NAVIGATE AWAY

            } else {
                // --- New patient creation flow ---

                 // 1. Create Patient record (potentially without final avatar URL yet)
                 const createdPatient = await createPatient({
                     patient: {
                         // id is assigned by backend
                         name,
                         email,
                         phone,
                         // Send the initial avatar URI (might be default or a temp one if selected)
                         // Backend might ignore this or use it temporarily.
                         // Or, send null/empty initially if avatar is handled entirely in step 2. Let's send null.
                         avatar: null // Or defaultAvatarUrl - depends on backend logic
                     }
                 }).unwrap();


                 let finalPatient = createdPatient; // This holds the patient data *after* creation

                 // 2. Upload Avatar if selected for the new patient
                 if (avatarBlob && createdPatient.id) {
                     try {
                         const uploadResult = await uploadAvatar({ id: createdPatient.id, avatar: avatarBlob }).unwrap();
                         if (uploadResult && uploadResult.avatar) {
                             // 3. Update the newly created patient record with the final avatar URL
                             finalPatient = await updatePatient({
                                 id: createdPatient.id,
                                 patient: { ...createdPatient, avatar: uploadResult.avatar } // Update only avatar field
                             }).unwrap();
                             setAvatarBlob(null); // Clear blob after successful upload and final update
                         }
                     } catch (err) {
                         console.error("Avatar upload/update error during create:", err);
                         // Error captured by hooks. Patient *might* be created without avatar.
                         // Inform the user the main record was created but avatar failed.
                         setApiError(`Patient created, but avatar upload failed: ${extractErrorMessage(err)}`);
                         // Dispatch the patient *without* the failed avatar
                         dispatch(setPatient(finalPatient));
                         // Still show partial success, but with error context
                         return; // Stop further processing in this block
                     }
                 }

                 // 4. Update Redux with the final patient data (either with or without uploaded avatar)
                 dispatch(setPatient(finalPatient));
                 setSuccessMessage("Patient created successfully!"); // Show success message
                 // DO NOT NAVIGATE AWAY
            }
        } catch (error) {
            // Errors from createPatient or updatePatient are caught here
            // These are already handled by the RTK Query error states and the useEffect hook
            console.error("Overall Save/Create Error", error);
            // setApiError is handled by the useEffect listening to mutation errors
        }
    };

    // --- Navigation Handlers ---
    const handleManageSchedules = () => {
        if (patient && patient.id) {
            navigation.navigate("Schedule"); // Assuming "Schedule" is a valid route name
        }
    };

    const handleManageConversations = () => {
         if (patient && patient.id) {
            navigation.navigate("Conversations"); // Assuming "Conversations" is a valid route name
         }
    };

    // --- Render Logic ---
    const isLoading = isCreating || isUpdating || isDeleting || isUploading;
    if (isLoading) {
        return <LoadingScreen message={
            isCreating ? "Creating Patient..." :
            isUploading ? "Uploading Avatar..." :
            isUpdating ? "Saving Changes..." :
            isDeleting ? "Deleting Patient..." : "Loading..."
        } />;
    }

    return (
        // Wrap with TouchableWithoutFeedback to dismiss keyboard and cancel delete confirm
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); handleCancelDelete(); }}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled" // Helps with pressing buttons while keyboard is up
            >
                {/* Display API Errors */}
                {apiError ? <Text style={styles.error}>{apiError}</Text> : null}

                {/* Display Success Message */}
                {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

                <View style={styles.formCard}>
                    <AvatarPicker
                        // Use local avatar state which defaults correctly
                        initialAvatar={avatar}
                        onAvatarChanged={handleAvatarChange}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Name *"
                        placeholderTextColor="#7f8c8d"
                        value={name}
                        onChangeText={handleNameChange} // Use specific handler
                        onFocus={clearMessages} // Clear messages on focus
                    />
                    {/* Consider adding a Name validation error if needed */}

                    <TextInput
                        style={styles.input}
                        placeholder="Email *"
                        placeholderTextColor="#7f8c8d"
                        value={email}
                        onChangeText={validateEmail} // Validation sets error state
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={clearMessages}
                    />
                    {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}

                    <TextInput
                        style={styles.input}
                        placeholder="Phone *"
                        placeholderTextColor="#7f8c8d"
                        value={phone}
                        onChangeText={validatePhone} // Validation sets error state
                        keyboardType="phone-pad" // Use phone pad
                        onFocus={clearMessages}
                    />
                    {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

                    {/* --- Action Buttons --- */}
                    <Pressable
                        style={[styles.button, styles.saveButton, (!name || !email || !phone || !!emailError || !!phoneError) && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={!name || !email || !phone || !!emailError || !!phoneError || isLoading} // Also disable while loading
                    >
                        <Text style={styles.buttonText}>{patient && patient.id ? "UPDATE PATIENT" : "CREATE PATIENT"}</Text>
                    </Pressable>

                    {/* Show Delete, Schedules, Conversations only for existing patients */}
                    {patient && patient.id && (
                        <>
                             <Pressable
                                style={[styles.button, styles.manageButton]}
                                onPress={handleManageSchedules}
                                disabled={isLoading} // Disable while loading
                            >
                                <Text style={styles.buttonText}>MANAGE SCHEDULES</Text>
                            </Pressable>

                            <Pressable
                                style={[styles.button, styles.manageButton]}
                                onPress={handleManageConversations}
                                disabled={isLoading} // Disable while loading
                            >
                                <Text style={styles.buttonText}>MANAGE CONVERSATIONS</Text>
                            </Pressable>

                            <Pressable
                                style={[styles.button, styles.deleteButton, isLoading && styles.buttonDisabled]}
                                onPress={handleDelete}
                                disabled={isLoading} // Disable while loading
                            >
                                <Text style={styles.buttonText}>{confirmDelete ? "CONFIRM DELETE" : "DELETE PATIENT"}</Text>
                            </Pressable>
                        </>
                    )}
                </View>
            </ScrollView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#ecf0f1"
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40 // Add padding at the bottom
    },
    error: { // General API error style
        color: "#e74c3c", // Red
        textAlign: "center",
        marginBottom: 15,
        fontSize: 15,
        fontWeight: '500',
        backgroundColor: 'rgba(231, 76, 60, 0.1)', // Light red background
        padding: 10,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.3)',
    },
    success: { // Success message style
        color: "#27ae60", // Green
        textAlign: "center",
        marginBottom: 15,
        fontSize: 15,
        fontWeight: '500',
        backgroundColor: 'rgba(39, 174, 96, 0.1)', // Light green background
        padding: 10,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(39, 174, 96, 0.3)',
    },
    formCard: {
        backgroundColor: "#fff",
        padding: 20,
        borderRadius: 8, // Slightly larger radius
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4, // Slightly larger shadow
        elevation: 3,
    },
    input: {
        height: 50, // Slightly taller input
        borderColor: "#bdc3c7",
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 15, // More padding
        marginBottom: 5, // Reduce margin slightly before error
        fontSize: 16,
        color: "#2c3e50",
        backgroundColor: '#f8f9f9' // Very light background for input
    },
    fieldError: { // Field-specific validation error
        color: "#c0392b", // Darker red for field errors
        fontSize: 13,
        marginBottom: 10, // Space after error before next input
        paddingLeft: 5,
    },
    button: {
        paddingVertical: 16, // Consistent padding
        borderRadius: 5,
        alignItems: "center",
        marginBottom: 15, // Spacing between buttons
        justifyContent: 'center',
        minHeight: 50, // Ensure buttons have a good tap height
    },
    saveButton: {
         backgroundColor: "#2980b9", // Slightly darker blue for save/update
    },
     manageButton: {
        backgroundColor: "#8e44ad", // Purple for manage buttons
    },
    deleteButton: {
        backgroundColor: "#e74c3c", // Red for delete
    },
    buttonDisabled: {
        opacity: 0.5, // Standard disabled look
        backgroundColor: '#bdc3c7' // Grey out background when disabled
    },
    buttonText: {
        color: "#fff",
        fontSize: 16, // Slightly smaller font for more text
        fontWeight: "600",
        textAlign: 'center',
    },
});

export { PatientScreen };