import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { getCurrentUser } from '../store/authSlice';
import { useUpdateAlertMutation } from '../services/api/alertApi';

export function AlertScreen() {
  const currentUser = useSelector(getCurrentUser);
  const [updateAlert] = currentUser ? useUpdateAlertMutation() : [() => {}];
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
      updateAlert({
        id: currentUser.id,
        alert: {
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
      <Text style={styles.title}>Alert Information</Text>
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