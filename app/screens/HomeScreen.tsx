import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useGetPatientsForCaregiverQuery } from '../services/api/caregiverApi';
import { getCurrentUser } from '../store/authSlice';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { setSelectedUser } from '../store/userSlice'; // import the action
import { Caregiver, Patient } from '../services/api/api.types';
import { MainTabsParamList } from 'app/navigators/navigationTypes';
import { useAssignCaregiverMutation } from '../services/api/patientApi'; // adjust the path as necessary
import { ScrollView } from 'react-native-gesture-handler';

export function HomeScreen() {
  const dispatch = useDispatch(); // get the dispatch function
  const currentUser : Caregiver | null = useSelector(getCurrentUser);
  const { data: patients = [] } = (currentUser && currentUser.id) ? useGetPatientsForCaregiverQuery(currentUser.id) : { data: [] };
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();
  const [assignCaregiver] = useAssignCaregiverMutation(); // use the hook at the top level

  const handlePatientPress = (user: Patient) => { // assuming User is the type of your user objects
    dispatch(setSelectedUser(user)); // dispatch the action to set the selected user
    navigation.navigate('CaregiverScreen');
  };

  const handleAddUser = () => {
    navigation.navigate('CaregiverScreen');
  };

  const handleSignUp = () => {
    if (currentUser && currentUser.id) {
      assignCaregiver({ patientId: currentUser.id, caregiverId: currentUser.id });
    } else {
      console.error('Current user is null');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.welcomeText}>Welcome, {currentUser ? currentUser.name : 'Guest'}</Text>
      <View style={styles.body}>
        {patients.length === 0 ? (
          <Text style={styles.noUsersText}>
            No users found. Please add new users or sign up for the service.
          </Text>
        ) : (
          <FlatList
            data={patients}
            keyExtractor={(item : Patient, index) => item.id || String(index)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userButton} onPress={() => handlePatientPress(item)}>
                <Text style={styles.userButtonText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addButton} onPress={handleAddUser}>
          <Text style={styles.addButtonText}>ADD NEW USER</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
          <Text style={styles.signUpButtonText}>SIGN UP</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECF0F1',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3498DB',
  },
  headerText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#2980B9',
    borderRadius: 5,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    padding: 20,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  noUsersText: {
    textAlign: 'center',
    fontSize: 18,
    color: '#7F8C8D',
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
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#BDC3C7',
  },
  addButton: {
    backgroundColor: '#2ECC71',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  signUpButton: {
    backgroundColor: '#3498DB',
    padding: 15,
    borderRadius: 5,
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
});