import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Text, TextInput, ScrollView, Pressable, StyleSheet, View } from 'react-native'
import { getOrg } from '../store/orgSlice'
import { useUpdateOrgMutation } from '../services/api/orgApi'
import { LoadingScreen } from './LoadingScreen'
import { goBack } from 'app/navigators'
import { useNavigation, NavigationProp } from '@react-navigation/native'
import { OrgStackParamList } from 'app/navigators/navigationTypes'

export function OrgScreen() {
  const dispatch = useDispatch()
  const currentOrg = useSelector(getOrg)
  const [updateOrg, { isError, error }] = useUpdateOrgMutation()
  const [isLoading, setIsLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()
  

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name)
      setEmail(currentOrg.email)
      setPhone(currentOrg.phone)
      setIsLoading(false)
    }
  }, [currentOrg])

  const handleSave = async () => {
    if (currentOrg?.id) {
      await updateOrg({
        orgId: currentOrg.id,
        org: {
          ...currentOrg,
          name,
          email,
          phone,
        },
      })
    }
    if (!isError) {
      goBack()
    }
  }

  const handleViewCaregivers = () => {
    // Navigate to a dedicated caregivers list screen
    navigation.navigate("Caregivers")
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {isError && (
        <Text style={styles.errorText}>
          {'status' in error && 'data' in error
            ? `Status: ${error.status}, Data: ${JSON.stringify(error.data)}`
            : 'error' in error
            ? error.error
            : 'Unknown error'}
        </Text>
      )}
      <View style={styles.formCard}>
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
          placeholderTextColor="#7f8c8d"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          placeholderTextColor="#7f8c8d"
        />
        <TextInput
          style={styles.input}
          placeholder="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholderTextColor="#7f8c8d"
        />
        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>SAVE</Text>
        </Pressable>
      </View>
      <Pressable style={styles.viewCaregiversButton} onPress={handleViewCaregivers}>
        <Text style={styles.viewCaregiversButtonText}>View Caregivers</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ecf0f1",
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#ddd",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#2c3e50",
  },
  errorText: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 6,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  input: {
    height: 45,
    borderColor: "#bdc3c7",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontSize: 16,
    color: "#2c3e50",
  },
  saveButton: {
    backgroundColor: "#3498db",
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  viewCaregiversButton: {
    backgroundColor: "#2ecc71",
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  viewCaregiversButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
})