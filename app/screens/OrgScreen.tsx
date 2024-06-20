import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { getOrg } from '../store/orgSlice';
import { useUpdateOrgMutation } from '../services/api/orgApi';
import { LoadingScreen } from './LoadingScreen';
import { AutoImage, Card, ListItem, ListView } from 'app/components';
import { Caregiver } from 'app/services/api';
import { setCaregiver, getCaregivers } from 'app/store/caregiverSlice';

export function OrgScreen() {
  const currentOrg = useSelector(getOrg);
  const [updateOrg] = currentOrg ? useUpdateOrgMutation() : [() => {}];
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name);
      setEmail(currentOrg.email);
      setPhone(currentOrg.phone);
      setIsLoading(false);
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

  const handleCaregiverPress = async (caregiver: Caregiver) => {
    setCaregiver(caregiver);
  };

  const renderItem = ({ item }: { item: Caregiver }) => (
    <ListItem onPress={() => handleCaregiverPress(item)}>
      <Card
          LeftComponent={<AutoImage source={{ uri: item.avatar }} style={{width: 50, height: 50}} />}
          RightComponent={
            <Pressable style={styles.userButton} onPress={() => handleCaregiverPress(item)}>
              <Text style={styles.userButtonText}>Edit</Text>
            </Pressable>
          }
          content={item.name}
        >
        </Card>
    </ListItem>
  );

  if (isLoading) {
    return <LoadingScreen />; // Return a loading screen while the data is being fetched
  }

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
      <ListView
        data={currentOrg?.caregivers || []}
        renderItem={renderItem}
        keyExtractor={item => item.id || ''}
      >
      </ListView>
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
  userButton: {
    backgroundColor: '#3498DB',
    padding: 15,
    borderRadius: 5,
    marginVertical: 10,
  },
  userButtonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
});