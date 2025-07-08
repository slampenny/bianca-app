import React from "react"
import { View, StyleSheet, FlatList } from "react-native"
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
  const patients = useSelector((state: RootState) =>
    currentUser && currentUser.id ? getPatientsForCaregiver(state, currentUser.id) : [],
  )
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>()

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
        RightComponent={
          <Button
            text="Edit"
            style={styles.editButton}
            textStyle={styles.editButtonText}
            onPress={() => handlePatientPress(item)}
            testID={`edit-patient-button-${item.id}`}
          />
        }
      />
    )
  }

  const ListEmpty = () => <Text style={styles.noUsersText} testID="no-patients-label">No patients found</Text>

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="home-header">Welcome, {currentUser ? currentUser.name : "Guest"}</Text>
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

      {/* Footer (Add Patient) */}
      <Button
        text="Add Patient"
        style={styles.addButton}
        textStyle={styles.addButtonText}
        onPress={handleAddPatient}
        testID="add-patient-button"
      />
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
})
