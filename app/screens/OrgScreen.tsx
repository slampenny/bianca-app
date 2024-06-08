import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { getOrg } from '../store/orgSlice';
import { useUpdateOrgMutation } from '../services/api/orgApi';

export function OrgScreen() {
  const currentOrg = useSelector(getOrg);
  const [updateOrg] = currentOrg ? useUpdateOrgMutation() : [() => {}];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name);
      setEmail(currentOrg.email);
      setPhone(currentOrg.phone);
    }
  }, [currentOrg]);

  const handleSave = () => {
    if (currentOrg && currentOrg.id) {
      updateOrg({
        orgId: currentOrg.id,
        org: {
          ...currentOrg,
          name,
          email,
          phone,
        },
      });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Org Information</Text>
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