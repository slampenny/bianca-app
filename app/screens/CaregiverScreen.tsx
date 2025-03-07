import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Text, TextInput, ScrollView, Pressable, StyleSheet, View } from 'react-native';
import { getCaregiver } from '../store/caregiverSlice';
import { useUpdateCaregiverMutation, useUploadAvatarMutation } from '../services/api/caregiverApi';
import AvatarPicker from 'app/components/AvatarPicker';

export function CaregiverScreen() {
  const caregiver = useSelector(getCaregiver);
  const [updateCaregiver] = caregiver ? useUpdateCaregiverMutation() : [() => {}];
  const [uploadAvatar] = caregiver ? useUploadAvatarMutation() : [() => {}];
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (caregiver) {
      setName(caregiver.name);
      setAvatar(caregiver.avatar);
      setEmail(caregiver.email);
      setPhone(caregiver.phone);
    }
  }, [caregiver]);

  const handleSave = async () => {
    if (caregiver && caregiver.id) {
      const updatedCaregiver = {
        ...caregiver,
        name,
        email,
        phone,
      };

      try {
        if (avatar !== caregiver.avatar) {
          await uploadAvatar({ id: caregiver.id, avatar }).unwrap();
          updatedCaregiver.avatar = avatar;
        }
        await updateCaregiver({ id: caregiver.id, caregiver: updatedCaregiver }).unwrap();
        setSuccessMessage('Your profile has been updated successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        setSuccessMessage('Failed to update your profile. Please try again.');
        setTimeout(() => setSuccessMessage(null), 3000);
        console.error('Failed to update caregiver:', error);
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      {successMessage && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>{successMessage}</Text>
        </View>
      )}
      <AvatarPicker initialAvatar={avatar} onAvatarChanged={setAvatar} />
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone"
        value={phone}
        onChangeText={setPhone}
      />
      <Pressable style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>SAVE</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  messageContainer: {
    backgroundColor: '#d4edda',
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
  messageText: {
    color: '#155724',
    fontSize: 16,
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
