import React, { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { Text, TextInput, ScrollView, Pressable, StyleSheet, View } from "react-native"
import { getOrg } from "../store/orgSlice"
import { getCurrentUser } from "../store/authSlice"
import { useUpdateOrgMutation } from "../services/api/orgApi"
import { LoadingScreen } from "./LoadingScreen"
import { goBack } from "app/navigators"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { OrgStackParamList } from "app/navigators/navigationTypes"
import { colors } from "app/theme/colors"
import { clearCaregiver } from "../store/caregiverSlice"

export function OrgScreen() {
  const dispatch = useDispatch()
  const currentOrg = useSelector(getOrg)
  const currentUser = useSelector(getCurrentUser)
  const [updateOrg, { isError, error }] = useUpdateOrgMutation()
  const [isLoading, setIsLoading] = useState(true)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  const navigation = useNavigation<NavigationProp<OrgStackParamList>>()

  // Check if user has permission to invite caregivers
  const canInviteCaregivers = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'
  
  // Check if user has permission to edit org details
  const canEditOrg = currentUser?.role === 'orgAdmin' || currentUser?.role === 'superAdmin'

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

  const handleInviteCaregiver = () => {
    // Clear any existing caregiver so the invite form starts fresh
    dispatch(clearCaregiver())
    // Navigate to caregiver screen in invite mode (no caregiver selected)
    navigation.navigate("Caregiver")
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {isError && (
        <Text style={styles.errorText}>
          {"status" in error && "data" in error
            ? `Status: ${error.status}, Data: ${JSON.stringify(error.data)}`
            : "error" in error
            ? error.error
            : "Unknown error"}
        </Text>
      )}
      <View style={styles.formCard}>
        <TextInput
          style={[styles.input, !canEditOrg && styles.readonlyInput]}
          placeholder="Name"
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.palette.neutral600}
          editable={canEditOrg}
        />
        <TextInput
          style={[styles.input, !canEditOrg && styles.readonlyInput]}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          placeholderTextColor={colors.palette.neutral600}
          editable={canEditOrg}
        />
        <TextInput
          style={[styles.input, !canEditOrg && styles.readonlyInput]}
          placeholder="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholderTextColor={colors.palette.neutral600}
          editable={canEditOrg}
        />
        {canEditOrg && (
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>SAVE</Text>
          </Pressable>
        )}
      </View>
      <Pressable style={styles.viewCaregiversButton} onPress={handleViewCaregivers} testID="view-caregivers-button">
        <Text style={styles.viewCaregiversButtonText}>View Caregivers</Text>
      </Pressable>
      {canInviteCaregivers && (
        <Pressable style={styles.inviteCaregiverButton} onPress={handleInviteCaregiver} testID="invite-caregiver-button">
          <Text style={styles.inviteCaregiverButtonText}>Invite Caregiver</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  errorText: {
    color: colors.palette.biancaError,
    marginBottom: 10,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 6,
    elevation: 2,
    marginBottom: 20,
    padding: 20,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral100,
    borderBottomWidth: 1,
    borderColor: colors.palette.biancaBorder,
    marginBottom: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 24,
    fontWeight: "600",
  },
  input: {
    borderColor: colors.palette.neutral300,
    borderRadius: 5,
    borderWidth: 1,
    color: colors.palette.biancaHeader,
    fontSize: 16,
    height: 45,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  readonlyInput: {
    backgroundColor: colors.palette.neutral200,
    color: colors.palette.neutral600,
    borderColor: colors.palette.neutral400,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    paddingVertical: 15,
  },
  saveButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "600",
  },
  viewCaregiversButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaSuccess,
    borderRadius: 5,
    marginTop: 10,
    paddingVertical: 15,
  },
  viewCaregiversButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "600",
  },
  inviteCaregiverButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    marginTop: 10,
    paddingVertical: 15,
  },
  inviteCaregiverButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "600",
  },
})
