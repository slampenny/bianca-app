import React from 'react'
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native'
import { AutoImage, Card } from 'app/components'
import { useSelector, useDispatch } from 'react-redux'
import { getCurrentUser } from '../store/authSlice'
import {
  setPatient,
  getPatientsForCaregiver,
  clearPatient,
} from '../store/patientSlice'
import { setSchedules, clearSchedules } from '../store/scheduleSlice'
import { useNavigation, NavigationProp } from '@react-navigation/native'
import { Caregiver, Patient } from '../services/api/api.types'
import { HomeStackParamList } from 'app/navigators/navigationTypes'
import { RootState } from '../store/store'

export function HomeScreen() {
  const dispatch = useDispatch()
  const currentUser: Caregiver | null = useSelector(getCurrentUser)
  const patients = useSelector((state: RootState) =>
    currentUser && currentUser.id ? getPatientsForCaregiver(state, currentUser.id) : [],
  )
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>()

  const handlePatientPress = (patient: Patient) => {
    dispatch(setPatient(patient))
    dispatch(setSchedules(patient.schedules))
    navigation.navigate('Patient')
  }

  const handleAddPatient = () => {
    dispatch(clearPatient())
    dispatch(clearSchedules())
    navigation.navigate('Patient')
  }

  const renderPatient = ({ item }: { item: Patient }) => {
    return (
      <View style={styles.patientCard}>
        <View style={styles.patientInfo}>
          <AutoImage
            source={{ uri: item.avatar }}
            style={styles.avatar}
          />
          <Text style={styles.patientName}>{item.name}</Text>
        </View>
        <Pressable
          style={styles.editButton}
          android_ripple={{ color: '#2980b9' }}
          onPress={() => handlePatientPress(item)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>
    )
  }

  const ListEmpty = () => (
    <Text style={styles.noUsersText}>No patients found</Text>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Welcome, {currentUser ? currentUser.name : 'Guest'}
        </Text>
      </View>

      {/* Patient List */}
      <FlatList
        data={patients}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderPatient}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ListEmpty}
      />

      {/* Footer (Add Patient) */}
      <Pressable
        style={styles.addButton}
        android_ripple={{ color: '#27ae60' }}
        onPress={handleAddPatient}
      >
        <Text style={styles.addButtonText}>Add Patient</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
  },
  header: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  listContentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  patientCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 16,
    borderRadius: 6,

    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,

    // Android elevation
    elevation: 2,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#bdc3c7',
  },
  patientName: {
    fontSize: 16,
    color: '#2c3e50',
    flexShrink: 1,
  },
  editButton: {
    backgroundColor: '#3498db',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  noUsersText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 20,
  },
  addButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
})
