import React from "react"
import { View, StyleSheet, FlatList, Pressable, Platform } from "react-native"
import { AutoImage, Card, Button, Text } from "app/components"
import { useSelector, useDispatch } from "react-redux"
import { getCurrentUser } from "../store/authSlice"
import { setPatient, getPatientsForCaregiver, clearPatient } from "../store/patientSlice"
import { setSchedules, clearSchedules } from "../store/scheduleSlice"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { Caregiver, Patient } from "../services/api/api.types"
import { HomeStackParamList } from "app/navigators/navigationTypes"
import { RootState } from "../store/store"
import { colors } from "app/theme/colors"

export function HomeScreen() {
  const dispatch = useDispatch()
  const currentUser: Caregiver | null = useSelector(getCurrentUser)
  const patients = useSelector((state: RootState) => {
    const patientList = currentUser && currentUser.id ? getPatientsForCaregiver(state, currentUser.id) : []
    console.log(`HomeScreen - currentUser.id: ${currentUser?.id}`)
    console.log(`HomeScreen - patients count: ${patientList.length}`)
    console.log(`HomeScreen - patients:`, patientList.map(p => ({ id: p.id, name: p.name })))
    return patientList
  })
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>()
  const [showTooltip, setShowTooltip] = React.useState(false)
  
  // Debug logging
  console.log('HomeScreen - currentUser:', currentUser)
  console.log('HomeScreen - currentUser?.role:', currentUser?.role)
  console.log('HomeScreen - currentUser?.email:', currentUser?.email)
  
  // More defensive role checking
  const isStaff = currentUser?.role === "staff"
  const isOrgAdmin = currentUser?.role === "orgAdmin"
  const isSuperAdmin = currentUser?.role === "superAdmin"
  
  console.log('HomeScreen - isStaff:', isStaff)
  console.log('HomeScreen - isOrgAdmin:', isOrgAdmin)
  console.log('HomeScreen - isSuperAdmin:', isSuperAdmin)
  
  // Role-based access control for patient creation
  // Only org admins and super admins can create patients
  // Staff users can only view patients
  const shouldDisableButton = isStaff
  
  console.log('HomeScreen - shouldDisableButton:', shouldDisableButton)
  
  const tooltipMessage = "Only org admins and super admins can add patients"

  const handlePatientPress = (patient: Patient) => {
    dispatch(setPatient(patient))
    dispatch(setSchedules(patient.schedules))
    navigation.navigate("Patient")
  }

  const handleAddPatient = () => {
    dispatch(clearPatient())
    dispatch(clearSchedules())
    navigation.navigate("Patient")
  }

  const renderPatient = ({ item }: { item: Patient }) => {
    return (
      <Card
        style={styles.patientCard}
        onPress={() => handlePatientPress(item)}
        testID={`patient-card-${item.id}`}
        accessibilityLabel={`patient-card-${item.name}`}
        LeftComponent={<AutoImage source={{ uri: item.avatar }} style={styles.avatar} />}
        content={item.name}
        contentStyle={styles.patientName}
        ContentTextProps={{ testID: `patient-name-${item.name}` }}
        RightComponent={
          <Button
            text="Edit"
            style={styles.editButton}
            textStyle={styles.editButtonText}
            onPress={() => handlePatientPress(item)}
            testID={`edit-patient-button-${item.name}`}
          />
        }
      />
    )
  }

  const ListEmpty = () => <Text style={styles.noUsersText} testID="home-no-patients">No patients found</Text>

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="home-header">Welcome, {currentUser ? currentUser.name : "Guest"}</Text>
        <Text style={styles.headerTitle} testID="home-welcome-header">{currentUser ? currentUser.name : "Guest"}</Text>
      </View>

      {/* Patient List */}
      <FlatList
        data={patients}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderPatient}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ListEmpty}
        testID="patient-list"
      />

      {/* Footer (Add Patient) with Tooltip */}
      <View style={{ alignItems: "center" }}>
        <Pressable
          onPressIn={() => { if (shouldDisableButton) setShowTooltip(true) }}
          onPressOut={() => setShowTooltip(false)}
          onHoverIn={() => { if (shouldDisableButton && Platform.OS === "web") setShowTooltip(true) }}
          onHoverOut={() => { if (shouldDisableButton && Platform.OS === "web") setShowTooltip(false) }}
        >
          <Button
            text="Add Patient"
            style={[styles.addButton, shouldDisableButton && styles.addButtonDisabled]}
            textStyle={styles.addButtonText}
            onPress={shouldDisableButton ? undefined : handleAddPatient}
            testID="add-patient-button"
            disabled={shouldDisableButton}
          />
        </Pressable>
        {shouldDisableButton && showTooltip && (
          <View style={styles.tooltip} testID="add-patient-tooltip">
            <Text style={styles.tooltipText}>{tooltipMessage}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaSuccess,
    paddingVertical: 16,
  },
  addButtonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "600",
  },
  avatar: {
    backgroundColor: colors.palette.neutral300,
    borderRadius: 24,
    height: 48,
    marginRight: 12,
    width: 48,
  },
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
  },
  editButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editButtonText: {
    color: colors.palette.neutral100,
    fontSize: 16,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral100,
    borderBottomWidth: 1,
    borderColor: colors.palette.biancaBorder,
    paddingVertical: 20,
  },
  headerTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 20,
    fontWeight: "600",
  },
  listContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  noUsersText: {
    color: colors.palette.neutral600,
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
  },
  patientCard: {
    backgroundColor: colors.palette.neutral100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 16,
    borderRadius: 6,

    // iOS shadow
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,

    // Android elevation
    elevation: 2,
  },
  patientInfo: {
    alignItems: "center",
    flexDirection: "row",
  },
  patientName: {
    color: colors.palette.biancaHeader,
    flexShrink: 1,
    fontSize: 16,
  },
  addButtonDisabled: {
    backgroundColor: colors.palette.neutral400,
  },
  tooltip: {
    position: "absolute",
    bottom: 60,
    backgroundColor: "#333",
    padding: 8,
    borderRadius: 6,
    zIndex: 100,
    maxWidth: 220,
    alignSelf: "center",
  },
  tooltipText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
})
