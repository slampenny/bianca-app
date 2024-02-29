import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { getCurrentUser } from '../store/authSlice';
import { useUpdateUserMutation } from '../services/api/userApi';

export function PaymentInfoScreen() {
  const currentUser = useSelector(getCurrentUser);
  const [updateUser] = currentUser ? useUpdateUserMutation() : [() => {}];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setEmail(currentUser.email);
      setPhone(currentUser.phone);
    }
  }, [currentUser]);

  const handleSave = () => {
    if (currentUser && currentUser.id) {
      updateUser({
        id: currentUser.id,
        user: {
          ...currentUser,
          name,
          email,
          phone,
        },
      });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Caregiver Information</Text>
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
      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>SAVE</Text>
      </TouchableOpacity>
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