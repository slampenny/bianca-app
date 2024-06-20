import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { AutoImage, Card } from 'app/components';
import { useSelector, useDispatch } from 'react-redux';
import { getCurrentUser } from '../store/authSlice';
import { setPatient, getPatientsForCaregiver, clearPatient } from '../store/patientSlice';
import { setSchedules, clearSchedules } from '../store/scheduleSlice';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Caregiver, Patient } from '../services/api/api.types';
import { PatientStackParamList } from 'app/navigators/navigationTypes';
import { ScrollView } from 'react-native-gesture-handler';
import { RootState } from '../store/store';

export function HomeScreen() {
  const dispatch = useDispatch(); // get the dispatch function
  const currentUser : Caregiver | null = useSelector(getCurrentUser);
  const patients = useSelector((state: RootState) => currentUser && currentUser.id ? getPatientsForCaregiver(state, currentUser.id) : []);
  const navigation = useNavigation<NavigationProp<PatientStackParamList>>();

  const handlePatientPress = (patient: Patient) => { // assuming User is the type of your user objects
    dispatch(setPatient(patient)); // dispatch the action to set the selected user
    dispatch(setSchedules(patient.schedules));
    navigation.navigate('PatientScreen');
  };

  const handleAddPatient = () => {
    dispatch(clearPatient());
    dispatch(clearSchedules());
    navigation.navigate('PatientScreen');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.welcomeText}>Welcome, {currentUser ? currentUser.name : 'Guest'}</Text>
      <View style={styles.body}>
        {patients.length === 0 ? (
          <Text style={styles.noUsersText}>No patients found</Text>
        ) : (
          <FlatList
            data={patients}
            keyExtractor={(item : Patient, index) => item.id || String(index)}
            renderItem={({ item }) => (
              <Card
                LeftComponent={<AutoImage source={{ uri: item.avatar }} style={{width: 50, height: 50}} />}
                RightComponent={
                  <Pressable style={styles.userButton} onPress={() => handlePatientPress(item)}>
                    <Text style={styles.userButtonText}>Edit</Text>
                  </Pressable>
                }
                content={item.name}
              >
              </Card>
            )}
          />
        )}
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.addButton} onPress={handleAddPatient}>
          <Text style={styles.addButtonText}>Add Patient</Text>
        </Pressable>
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