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
import { API_BASE_URL } from "app/config"; // Ensure you have this defined

function PatientScreen() {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>();
  const dispatch = useDispatch();
  const patient = useSelector(getPatient);

  // Local form data state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    avatar: "",
  });
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync local form data with Redux patient whenever it changes
  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        avatar: patient.avatar,
      });
    }
  }, [patient]);

  const validateEmail = (email: string) => {
    setFormData(prev => ({ ...prev, email }));
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError(emailRegex.test(email) ? "" : "Invalid email format");
  };

  const validatePhone = (phone: string) => {
    setFormData(prev => ({ ...prev, phone }));
    const phoneRegex = /^\d{10}$/;
    setPhoneError(phoneRegex.test(phone) ? "" : "Invalid phone format");
  };

  const handleFieldChange = (field: "name" | "email" | "phone", value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const [updatePatient, { isLoading: isUpdating, error: updateError }] = useUpdatePatientMutation();
  const [createPatient, { isLoading: isCreating, error: createError }] = useCreatePatientMutation();
  const [deletePatient, { isLoading: isDeleting, error: deleteError }] = useDeletePatientMutation();
  const [uploadAvatar, { isLoading: isUploading, error: uploadError }] = useUploadPatientAvatarMutation();

  const handleDelete = () => {
    if (confirmDelete && patient && patient.id) {
      deletePatient({ id: patient.id })
        .unwrap()
        .then(() => navigation.navigate("Home"));
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
      let updatedPatient = { ...patient, ...formData };

      // If the avatar has changed and we have a new blob, upload it first.
      if (formData.avatar !== patient.avatar && avatarBlob) {
        try {
          const uploadResult = await uploadAvatar({ id: patient.id, avatar: avatarBlob }).unwrap();
          if (uploadResult && uploadResult.avatar) {
            // If the returned URL is relative, you can prepend your API base URL:
            const newAvatar =
              uploadResult.avatar.startsWith("http")
                ? uploadResult.avatar
                : `${API_BASE_URL}${uploadResult.avatar}`;
            updatedPatient.avatar = newAvatar;
            setFormData(prev => ({ ...prev, avatar: newAvatar }));
          }
        } catch (err) {
          console.error("Avatar upload error:", err);
        }
      }

      const result = await updatePatient({ id: patient.id, patient: updatedPatient }).unwrap();
      dispatch(setPatient(result));
      navigation.goBack();
    } else {
      // New patient creation flow
      try {
        const createdPatient = await createPatient({ patient: { ...formData } }).unwrap();
        let finalPatient = createdPatient;

        if (avatarBlob) {
          try {
            const uploadResult = await uploadAvatar({ id: createdPatient.id, avatar: avatarBlob }).unwrap();
            if (uploadResult && uploadResult.avatar) {
              const newAvatar =
                uploadResult.avatar.startsWith("http")
                  ? uploadResult.avatar
                  : `${API_BASE_URL}${uploadResult.avatar}`;
              finalPatient = { ...createdPatient, avatar: newAvatar };
              finalPatient = await updatePatient({ id: createdPatient.id, patient: finalPatient }).unwrap();
            }
          } catch (err) {
            console.error("Avatar upload error:", err);
          }
        }
        dispatch(setPatient(finalPatient));
        navigation.goBack();
      } catch (error) {
        console.error("Error creating patient:", error);
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

        <View style={styles.formCard}>
          <AvatarPicker 
            initialAvatar={formData.avatar} 
            onAvatarChanged={({ uri, blob }) => {
              setFormData(prev => ({ ...prev, avatar: uri }));
              if (blob) setAvatarBlob(blob);
            }} 
          />

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#7f8c8d"
            value={formData.name}
            onChangeText={(value) => handleFieldChange("name", value)}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#7f8c8d"
            value={formData.email}
            onChangeText={validateEmail}
          />
          {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Phone"
            placeholderTextColor="#7f8c8d"
            value={formData.phone}
            onChangeText={validatePhone}
          />
          {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

          <Pressable
            style={[styles.button, (!formData.email || !formData.phone || emailError || phoneError) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!formData.email || !formData.phone || !!emailError || !!phoneError}
          >
            <Text style={styles.buttonText}>SAVE</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.deleteButton, (!patient || !patient.id) && styles.buttonDisabled]}
            onPress={handleDelete}
            disabled={!patient || !patient.id}
          >
            <Text style={styles.buttonText}>{confirmDelete ? "CONFIRM DELETE" : "DELETE"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ecf0f1" },
  contentContainer: { padding: 20 },
  error: { color: "red", textAlign: "center", marginBottom: 10 },
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
