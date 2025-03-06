import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
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

  useEffect(() => {
    if (caregiver) {
      setName(caregiver.name);
      setAvatar(caregiver.avatar);
      setEmail(caregiver.email);
      setPhone(caregiver.phone);
    }
  }, [caregiver]);

  const handleSave = () => {
    if (caregiver && caregiver.id) {
      const updatedCaregiver = {
        ...caregiver,
        name,
        email,
        phone,
      };
  
      if (avatar !== caregiver.avatar) {
        uploadAvatar({
          id: caregiver.id,
          avatar,
        });
        updatedCaregiver.avatar = avatar;
      }
  
      updateCaregiver({
        id: caregiver.id,
        caregiver: updatedCaregiver,
      });
    }
  };
  
  return (
    <ScrollView style={styles.container}>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
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