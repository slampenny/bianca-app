import React, { useState, useEffect } from "react";
import {
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
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

    // Sync local form data with Redux patient whenever it changes
    useEffect(() => {
        if (patient) {
            setName(patient.name);
            setEmail(patient.email);
            setPhone(patient.phone);
            setAvatar(patient.avatar);
        } else {
            setName("");
            setEmail("");
            setPhone("");
            setAvatar("");
        }
    }, [patient]);

    const validateEmail = (email: string) => {
        setEmail(email);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        setEmailError(emailRegex.test(email) ? "" : "Invalid email format");
    };

    const validatePhone = (phone: string) => {
        setPhone(phone);
        const phoneRegex = /^\d{10}$/;
        setPhoneError(phoneRegex.test(phone) ? "" : "Invalid phone format");
    };

    const [updatePatient, { isLoading: isUpdating, error: updateError }] = useUpdatePatientMutation();
    const [createPatient, { isLoading: isCreating, error: createError }] = useCreatePatientMutation();
    const [deletePatient, { isLoading: isDeleting, error: deleteError }] = useDeletePatientMutation();
    const [uploadAvatar, { isLoading: isUploading, error: uploadError }] = useUploadPatientAvatarMutation();

    const handleDelete = () => {
        if (confirmDelete && patient && patient.id) {
            deletePatient({ id: patient.id })
                .unwrap()
                .then(() => {
                    dispatch(setPatient(null)); // Clear patient from Redux
                    navigation.navigate("Home")
                });
        } else {
            setConfirmDelete(true);
        }
    };

    const handleCancelDelete = () => {
        setConfirmDelete(false);
    };

    const handleSave = async () => {
        if (patient && patient.id) {
            // Existing patient update flow
            let updatedPatient = {
                ...patient,
                name,
                email,
                phone,
            };

            // If the avatar has changed and we have a new blob, upload it first.
            if (avatar !== patient.avatar && avatarBlob) {
                try {
                    const uploadResult = await uploadAvatar({ id: patient.id, avatar: avatarBlob }).unwrap();
                    updatedPatient.avatar = uploadResult.avatar;
                } catch (err) {
                    console.error("Avatar upload error:", err);
                }
            }
            try {
                const result = await updatePatient({ id: patient.id, patient: updatedPatient }).unwrap();
                dispatch(setPatient(result));
                navigation.goBack();
            } catch (error) {
                console.error("Update Patient Error", error)
            }

        } else {
            // New patient creation flow
            try {
                const createdPatient = await createPatient({
                    patient: {
                        name,
                        email,
                        phone,
                        avatar
                    }
                }).unwrap();

                let finalPatient = createdPatient;

                if (avatarBlob && createdPatient.id) {
                    try {
                        const uploadResult = await uploadAvatar({ id: createdPatient.id, avatar: avatarBlob }).unwrap();
                        if (uploadResult && uploadResult.avatar) {
                            finalPatient = { ...createdPatient, avatar: uploadResult.avatar };
                            finalPatient = await updatePatient({ id: createdPatient.id, patient: finalPatient }).unwrap();
                        }
                    } catch (error) {
                        console.error("Avatar upload error", error)
                    }
                }
                dispatch(setPatient(finalPatient));
                navigation.goBack();
            } catch (error) {
                console.error("Create Patient Error", error)
            }
        }
    };

    if (isCreating || isUpdating || isDeleting || isUploading) {
        return <LoadingScreen />;
    }

    return (
        <TouchableWithoutFeedback onPress={handleCancelDelete}>
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                {(createError || updateError || deleteError || uploadError) && (
                    <Text style={styles.error}>
                        {createError && "data" in createError
                            ? `Error: ${(createError.data as { message: string }).message}`
                            : updateError && "data" in updateError
                                ? `Error: ${(updateError.data as { message: string }).message}`
                                : deleteError && "data" in deleteError
                                    ? `Error: ${(deleteError.data as { message: string }).message}`
                                    : uploadError && "data" in uploadError
                                        ? `Error uploading avatar: ${(uploadError.data as { message: string }).message}`
                                        : "An error occurred"}
                    </Text>
                )}

                {successMessage ? (
                    <Text style={styles.success}>{successMessage}</Text>
                ) : null}

                <View style={styles.formCard}>
                    <AvatarPicker
                        initialAvatar={avatar || defaultAvatarUrl}
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
                        style={[styles.button, (!email || !phone || emailError || phoneError) && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={!email || !phone || !!emailError || !!phoneError}
                    >
                        <Text style={styles.buttonText}>SAVE</Text>
                    </Pressable>

                    {patient && patient.id && (
                        <Pressable
                            style={[styles.button, styles.deleteButton, (!patient || !patient.id) && styles.buttonDisabled]}
                            onPress={handleDelete}
                            disabled={!patient || !patient.id}
                        >
                            <Text style={styles.buttonText}>{confirmDelete ? "CONFIRM DELETE" : "DELETE"}</Text>
                        </Pressable>
                    )}
                </View>
            </ScrollView>
        </TouchableWithoutFeedback>
    );
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
});

export { PatientScreen };
