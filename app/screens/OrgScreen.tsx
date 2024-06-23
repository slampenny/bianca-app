import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { getOrg } from '../store/orgSlice';
import { useUpdateOrgMutation } from '../services/api/orgApi';
import { Caregiver } from 'app/services/api/api.types';
import { LoadingScreen } from './LoadingScreen';
import { AutoImage, Card, ListItem, ListView } from 'app/components';
import { useGetAllCaregiversQuery } from 'app/services/api';
import { setCaregiver, setCaregivers, getCaregivers } from 'app/store/caregiverSlice';
import { navigate, goBack } from 'app/navigators';


export function OrgScreen() {
  const dispatch = useDispatch();
  const currentOrg = useSelector(getOrg);
  const caregivers = useSelector(getCaregivers);
  const [updateOrg, { isError, error }] = useUpdateOrgMutation();
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const { data: caregiverData, isFetching: isFetchingCaregivers } = useGetAllCaregiversQuery(
    { org: currentOrg?.id },
    { skip: !currentOrg?.id }
  );  

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name);
      setEmail(currentOrg.email);
      setPhone(currentOrg.phone);
      setIsLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    if (caregiverData && !isFetchingCaregivers) {
      dispatch(setCaregivers(caregiverData.results));
    }
  }, [caregiverData, isFetchingCaregivers, dispatch]);

  const handleSave = async () => {
    if (currentOrg && currentOrg.id) {
      await updateOrg({
        orgId: currentOrg.id,
        org: {
          ...currentOrg,
          name,
          email,
          phone,
        },
      });
    }

    if (!isError) {
      goBack();
    }
  };

  const handleCaregiverPress = async (caregiver: Caregiver) => {
    dispatch(setCaregiver(caregiver));
    navigate("Caregiver");
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

  if (isLoading || isFetchingCaregivers) {
    return <LoadingScreen />; // Return a loading screen while the data is being fetched
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Org Information</Text>
      {isError && <Text style={styles.errorText}>
      {
        'status' in error && 'data' in error 
          ? `Status: ${error.status}, Data: ${JSON.stringify(error.data)}`
          : 'error' in error 
            ? error.error
            : 'Unknown error'
      }
      </Text>}
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
        data={caregivers || []}
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
  errorText: {
    color: 'red',
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