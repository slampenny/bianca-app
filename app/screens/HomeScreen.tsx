import React from "react"
import { View, StyleSheet, FlatList, Pressable, Platform } from "react-native"
import { AutoImage, Card, Button, Text } from "app/components"
import { Ionicons } from "@expo/vector-icons"
import { useSelector, useDispatch } from "react-redux"
import { getCurrentUser } from "../store/authSlice"
import { setPatient, getPatientsForCaregiver, clearPatient } from "../store/patientSlice"
import { setSchedules, clearSchedules } from "../store/scheduleSlice"
import { setPendingCallData, clearCallData } from "../store/callSlice"
import { clearConversation } from "../store/conversationSlice"
import { useInitiateCallMutation } from "../services/api/callWorkflowApi"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { Caregiver, Patient } from "../services/api/api.types"
import { HomeStackParamList } from "app/navigators/navigationTypes"
import { RootState } from "../store/store"
import { colors } from "app/theme/colors"
import { translate } from "../i18n"
import { useLanguage } from "../hooks/useLanguage"


export function HomeScreen() {
  const dispatch = useDispatch()
  const currentUser: Caregiver | null = useSelector(getCurrentUser)
  const [initiateCall, { isLoading: isInitiatingCall }] = useInitiateCallMutation()
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  
  // Memoize the patients selector to prevent unnecessary re-renders
  const patientsSelector = React.useMemo(
    () => (state: RootState) => {
      const patientList = currentUser && currentUser.id ? getPatientsForCaregiver(state, currentUser.id) : []
      return patientList
    },
    [currentUser?.id]
  )
  
  const patients = useSelector(patientsSelector)
  

  
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>()
  const [showTooltip, setShowTooltip] = React.useState(false)
  
  // More defensive role checking
  const isStaff = currentUser?.role === "staff"
  const isOrgAdmin = currentUser?.role === "orgAdmin"
  const isSuperAdmin = currentUser?.role === "superAdmin"
  
  // Role-based access control for patient creation
  // Only org admins and super admins can create patients
  // Staff users can only view patients
  const shouldDisableButton = isStaff
  
  const tooltipMessage = translate("homeScreen.adminOnlyMessage")

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

  const handleCallNow = async (patient: Patient) => {
    try {
      // Set the patient in Redux first
      dispatch(setPatient(patient))
      
      // Actually initiate the call via backend API
      console.log('Initiating call for patient:', patient.id, patient.name)
      const response = await initiateCall({
        patientId: patient.id || '',
        callNotes: `Manual call initiated by agent to ${patient.name}`
      }).unwrap()
      
      console.log('Call initiated successfully, response:', response)
      console.log('HomeScreen - response.conversationId:', response.conversationId)
      
      // Clear any existing call and conversation data before setting new call
      dispatch(clearCallData())
      dispatch(clearConversation())
      
      // Set pending call data for CallScreen to consume
      // Always start with 'initiating' status regardless of API response
      // to prevent showing "completed" before the call actually starts
      dispatch(setPendingCallData({
        conversationId: response.conversationId,
        callSid: response.callSid,
        patientId: response.patientId,
        patientName: response.patientName,
        patientPhone: response.patientPhone,
        agentId: response.agentId,
        agentName: response.agentName,
        status: 'initiated' // Force initiated status initially
      }))
      
      // Navigate to dedicated call screen
      navigation.navigate("Call")
    } catch (error: any) {
      console.error('Failed to initiate call:', error)
      
      // Handle different types of errors
      if (error.response?.status === 401) {
        console.error('Authentication failed - user may need to login again')
        // You might want to redirect to login or show an auth error
      } else if (error.response?.status >= 400) {
        console.error('API error:', error.response?.data?.message || 'Unknown error')
      }
      
      // You might want to show an error message to the user here
    }
  }

  const renderPatient = ({ item }: { item: Patient }) => {
    return (
      <Card
        style={styles.patientCard}
        testID={`patient-card-${item.id}`}
        accessibilityLabel={`patient-card-${item.name}`}
        LeftComponent={<AutoImage source={{ uri: item.avatar }} style={styles.avatar} />}
        content={item.name}
        contentStyle={styles.patientName}
        ContentTextProps={{ testID: `patient-name-${item.name}` }}
        RightComponent={
          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.callButton,
                { opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={() => handleCallNow(item)}
              testID={`call-now-${item.name}`}
              accessibilityLabel={`Call ${item.name}`}
              accessibilityRole="button"
            >
              <Ionicons name="call" size={20} color={colors.palette.neutral100} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.editButton,
                { opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={() => handlePatientPress(item)}
              testID={`edit-patient-button-${item.name}`}
              accessibilityLabel={`Edit ${item.name}`}
              accessibilityRole="button"
            >
              <Ionicons name="create-outline" size={20} color={colors.palette.neutral100} />
            </Pressable>
          </View>
        }
      />
    )
  }

  const ListEmpty = () => <Text style={styles.noUsersText} testID="home-no-patients">No patients found</Text>

  return (
    <View style={styles.container} accessibilityLabel="home-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="home-header" accessibilityLabel="home-header">{translate("homeScreen.welcome", { name: currentUser ? currentUser.name : translate("homeScreen.guest") })}</Text>
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
      <View style={styles.addButtonContainer}>
        <View
          onTouchStart={() => { if (shouldDisableButton) setShowTooltip(true) }}
          onTouchEnd={() => setShowTooltip(false)}
          {...(Platform.OS === "web" ? {
            onMouseEnter: () => { if (shouldDisableButton) setShowTooltip(true) },
            onMouseLeave: () => setShowTooltip(false)
          } : {})}
        >
          <Button
            text={translate("homeScreen.addPatient")}
            preset="primary"
            onPress={shouldDisableButton ? undefined : handleAddPatient}
            testID="add-patient-button"
            disabled={shouldDisableButton}
            style={styles.addButton}
          />
        </View>
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
    marginHorizontal: 16,
  },
  addButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
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
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    minHeight: 44,
  },
  callButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    minHeight: 44,
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
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
