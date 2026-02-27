import React from "react"
import { View, StyleSheet, FlatList, Platform } from "react-native"
import { AutoImage, Card, Button, Text } from "app/components"
import { Ionicons } from "@expo/vector-icons"
import { useSelector, useDispatch } from "react-redux"
import { getCurrentUser } from "../store/authSlice"
import { setPatient, getPatientsForCaregiver, clearPatient } from "../store/patientSlice"
import { setSchedules, clearSchedules } from "../store/scheduleSlice"
import { setPendingCallData, clearCallData } from "../store/callSlice"
import { clearConversation } from "../store/conversationSlice"
import { useInitiateCallMutation } from "../services/api/callWorkflowApi"
import { isAuthCancelledError } from "../services/api/baseQueryWithAuth"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { Caregiver, Patient } from "../services/api/api.types"
import { HomeStackParamList } from "app/navigators/navigationTypes"
import { RootState } from "../store/store"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { useLanguage } from "../hooks/useLanguage"
import { logger } from "../utils/logger"
import { PhoneVerificationBanner } from "../components/PhoneVerificationBanner"


export function HomeScreen() {
  const dispatch = useDispatch()
  const currentUser: Caregiver | null = useSelector(getCurrentUser)
  const [initiateCall, { isLoading: isInitiatingCall }] = useInitiateCallMutation()
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  const { colors, isLoading: themeLoading } = useTheme()
  
  // Get patients from Redux - get currentUser first, then patients
  // This ensures we re-render when either currentUser or patients change
  const patients = useSelector((state: RootState) => {
    const user = state.auth.currentUser || state.auth.user
    if (!user || !user.id) {
      console.log(`[HOMESCREEN] No current user in Redux`)
      return []
    }
    const patientList = getPatientsForCaregiver(state, user.id)
    // Always log in test mode to debug
    console.log(`[HOMESCREEN] useSelector: user.id=${user.id}, patientCount=${patientList.length}`)
    if (patientList.length === 0) {
      console.log(`[HOMESCREEN] Patient list empty! Redux state.patient.patients keys:`, Object.keys(state.patient.patients || {}))
      console.log(`[HOMESCREEN] Redux state.patient.patients[${user.id}]:`, state.patient.patients[user.id]?.length || 0, 'patients')
      if (state.patient.patients[user.id]) {
        console.log(`[HOMESCREEN] First 3 patient IDs in Redux:`, state.patient.patients[user.id].slice(0, 3).map(p => p.id))
      }
    } else {
      console.log(`[HOMESCREEN] First 3 patient IDs:`, patientList.slice(0, 3).map(p => p.id))
    }
    return patientList
  })
  
  // Debug logging when patients change
  React.useEffect(() => {
    console.log(`[HOMESCREEN] Component rendered: patients.count=${patients.length}, currentUser.id=${currentUser?.id}`)
    if (patients.length > 0) {
      console.log(`[HOMESCREEN] First 3 patient IDs:`, patients.slice(0, 3).map(p => p.id))
      console.log(`[HOMESCREEN] FlatList will render ${patients.length} patients`)
    } else if (currentUser?.id) {
      console.log(`[HOMESCREEN] Patient list is empty for user ${currentUser.id}`)
    } else {
      console.log(`[HOMESCREEN] No current user`)
    }
  }, [patients.length, currentUser?.id, patients])
  

  
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
      logger.debug('Initiating call for patient:', patient.id, patient.name)
      const response = await initiateCall({
        patientId: patient.id || '',
        callNotes: `Manual call initiated by agent to ${patient.name}`
      }).unwrap()
      
      logger.debug('Call initiated successfully, response:', response)
      logger.debug('HomeScreen - response.conversationId:', response.conversationId)
      
      // Clear any existing call and conversation data before setting new call
      dispatch(clearCallData())
      dispatch(clearConversation())
      
      // Set pending call data for CallScreen to consume
      // Conversation is now created immediately when call is initiated, so conversationId is always available
      dispatch(setPendingCallData({
        conversationId: response.conversationId, // Always available now
        callId: response.callId,
        callSid: response.callSid,
        patientId: response.patientId,
        patientName: response.patientName,
        patientPhone: response.patientPhone,
        agentId: response.agentId,
        agentName: response.agentName,
        status: response.status || 'initiated',
        callStatus: response.callStatus,
      }))
      
      // Navigate to dedicated call screen
      navigation.navigate("Call")
    } catch (error: unknown) {
      if (isAuthCancelledError(error)) {
        // User closed the auth modal without signing in; no need to log or show a generic error
        return
      }
      console.error('Failed to initiate call:', error)
      if ((error as any)?.response?.status === 401) {
        logger.debug('Authentication failed - user may need to login again')
      } else if ((error as any)?.response?.status >= 400) {
        console.error('API error:', (error as any)?.response?.data?.message || 'Unknown error')
      }
    }
  }

  const renderPatient = ({ item }: { item: Patient }) => {
    const hasNoSchedule = !item.schedules || item.schedules.length === 0
    const cardStyle = hasNoSchedule 
      ? [styles.patientCard, styles.patientCardWarning]
      : styles.patientCard
    
    return (
      <Card
        style={cardStyle}
        testID={`patient-card-${item.id}`}
        accessibilityLabel={`patient-card-${item.name}`}
        LeftComponent={<AutoImage source={{ uri: item.avatar }} style={styles.avatar} />}
        content={item.name}
        contentStyle={styles.patientName}
        ContentTextProps={{ testID: `patient-name-${item.name}` }}
        footer={hasNoSchedule ? translate("homeScreen.noScheduleWarning") : undefined}
        footerStyle={hasNoSchedule ? styles.warningFooter : undefined}
        FooterTextProps={hasNoSchedule ? { testID: `no-schedule-warning-${item.name}` } : undefined}
        RightComponent={
          <View style={styles.buttonContainer}>
            <Button
              preset="primary"
              text="" // Empty text for icon-only button
              onPress={() => handleCallNow(item)}
              testID={`call-now-${item.name}`}
              accessibilityLabel={`Call ${item.name}`}
              accessibilityHint="Initiates a phone call to this patient"
              style={styles.callButton}
              textStyle={styles.callButtonText}
              LeftAccessory={(props) => (
                <Ionicons 
                  name="call" 
                  size={20} 
                  color={colors.palette.neutral100 || colors.palette.neutral900 || "#FFFFFF"}
                />
              )}
            />
            <Button
              preset="primary"
              text="" // Empty text for icon-only button
              onPress={() => handlePatientPress(item)}
              testID={`edit-patient-button-${item.id}`}
              accessibilityLabel={`Edit ${item.name}`}
              accessibilityHint="Opens patient details for editing"
              style={styles.editButton}
              textStyle={styles.editButtonText}
              LeftAccessory={(props) => (
                <Ionicons 
                  name="create-outline" 
                  size={20} 
                  color={colors.palette.neutral100 || colors.palette.neutral900 || "#FFFFFF"}
                />
              )}
            />
          </View>
        }
      />
    )
  }

  const ListEmpty = () => <Text style={styles.noUsersText} testID="home-no-patients">{translate("homeScreen.noPatientsFound")}</Text>

  // Don't return null during theme loading - render with default theme instead
  // This prevents the component from not rendering during async theme loading
  if (themeLoading) {
    console.log('[HOMESCREEN] themeLoading is true, but rendering anyway with default colors')
    // Continue rendering - useTheme will return default theme if loading
  }
  
  // Debug log to confirm component is rendering
  console.log('[HOMESCREEN] Component rendering: currentUser.id=', currentUser?.id, 'patients.count=', patients.length, 'themeLoading=', themeLoading)

  const styles = createStyles(colors)

  return (
    <View style={styles.container} accessibilityLabel="home-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="home-header" accessibilityLabel="home-header">{translate("homeScreen.welcome", { name: currentUser ? currentUser.name : translate("homeScreen.guest") })}</Text>
      </View>

      {/* Phone Verification Banner */}
      <PhoneVerificationBanner />

      {/* Patient List */}
      <FlatList
        data={patients}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderPatient}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ListEmpty}
        testID="patient-list"
        extraData={patients.length} // Force re-render when patient count changes
        removeClippedSubviews={false} // Ensure all items are rendered (important for testing)
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

const createStyles = (colors: any) => StyleSheet.create({
  addButton: {
    marginHorizontal: 16,
  },
  addButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
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
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: 44,
    minHeight: 44,
    // Button component handles theming automatically
  },
  callButton: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginRight: 8,
    minWidth: 44,
    minHeight: 44,
    // Button component handles theming automatically
  },
  callButtonText: {
    // Hide text since we're using icon-only buttons
    fontSize: 0,
    lineHeight: 0,
    width: 0,
    padding: 0,
    margin: 0,
  },
  editButtonText: {
    // Hide text since we're using icon-only buttons
    fontSize: 0,
    lineHeight: 0,
    width: 0,
    padding: 0,
    margin: 0,
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
  patientCardWarning: {
    backgroundColor: colors.palette.warning100 || colors.palette.warning200 || "#FEF3C7",
    borderWidth: 1,
    borderColor: colors.palette.warning300 || colors.palette.warning400 || "#FCD34D",
  },
  warningFooter: {
    color: colors.palette.warning700 || colors.palette.warning800 || "#B45309",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
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
    backgroundColor: colors.palette.neutral800,
    padding: 8,
    borderRadius: 6,
    zIndex: 100,
    maxWidth: 220,
    alignSelf: "center",
  },
  tooltipText: {
    color: colors.palette.neutral100,
    fontSize: 14,
    textAlign: "center",
  },
})
