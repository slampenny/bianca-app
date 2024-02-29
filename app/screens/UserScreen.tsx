import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSelector, useDispatch } from 'react-redux';
import { useCreateUserMutation, useUpdateUserMutation, useDeleteUserMutation } from '../services/api/userApi';
import { getCurrentUser } from '../store/authSlice';
import { removeSelectedUser } from '../store/caregiverSlice';
import { getSelectedUser } from '../store/userSlice';
import Schedule from '../components/Schedule';

export function UserScreen() {
  const dispatch = useDispatch();
  const currentUser = useSelector(getCurrentUser);
  const displayedUser = useSelector(getSelectedUser); 

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schedules, setSchedules] = useState(displayedUser.schedules);

  const [addUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const navigation = useNavigation();

  useEffect(() => {
    setName(displayedUser.name);
    setEmail(displayedUser.email);
    setPhone(displayedUser.phone);
    setSchedules(displayedUser.schedules);
  }, [displayedUser]);

  const handleAddUser = async () => {
    if (currentUser) {
        const updatedUser = {
          ...displayedUser,
          name: name,
          email: email,
          phone: phone,
          caregiver: currentUser.id ? currentUser.id : null,
          schedules: schedules,
        };
        if (updatedUser.id) {
          await updateUser({
            id: updatedUser.id,
            user : updatedUser
          });
        } else {
          await addUser({
            user : updatedUser
          });
        }
        navigation.goBack();
    }
  };

  const handleDeleteUser = async () => {
    if (displayedUser && displayedUser.id) {
      await deleteUser({ id: displayedUser.id});
      dispatch(removeSelectedUser(displayedUser.id));
      navigation.goBack();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Name"
      />
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
      />
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone"
      />
      {schedules && schedules.length > 0 && (
        <Schedule
          initialSchedule={schedules[0]}
          onScheduleChange={(schedule) => {
            const updatedSchedules = [...schedules];
            updatedSchedules[0] = schedule;
            setSchedules(updatedSchedules);
          }}
        />
      )}
      <TouchableOpacity style={styles.button} onPress={handleAddUser}>
        <Text style={styles.buttonText}>{displayedUser.id ? "Save" : "Add User"}</Text>
      </TouchableOpacity>
      {displayedUser.id && (
        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDeleteUser}>
          <Text style={styles.buttonText}>Delete User</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    padding: 20,
    backgroundColor: '#fff', // or another light background color
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    fontSize: 18,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});