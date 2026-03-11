import React from "react"
import { View, StyleSheet, FlatList, Platform } from "react-native"
import { AutoImage, Card, Button, Text } from "app/components"
import { Ionicons } from "@expo/vector-icons"
import { useSelector, useDispatch } from "react-redux"
import { getCurrentUser } from "../store/authSlice"
import { setClient, getClientsForCaregiver, clearClient } from "../store/clientSlice"
import { setSchedules, clearSchedules } from "../store/scheduleSlice"
import { setPendingCallData, clearCallData } from "../store/callSlice"
import { clearConversation } from "../store/conversationSlice"
import { useInitiateCallMutation } from "../services/api/callWorkflowApi"
import { isAuthCancelledError } from "../services/api/baseQueryWithAuth"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { Caregiver, Client } from "../services/api/api.types"
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
  
  const clients = useSelector((state: RootState) => {
    const user = state.auth.currentUser || (state.auth as { user?: { id: string } }).user
    if (!user || !user.id) return []
    return getClientsForCaregiver(state, user.id)
  })
  
  React.useEffect(() => {
    if (clients.length > 0 && currentUser?.id) {
      console.log(`[HOMESCREEN] Rendered ${clients.length} clients for user ${currentUser.id}`)
    }
  }, [clients.length, currentUser?.id])
  

  
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>()
  const [showTooltip, setShowTooltip] = React.useState(false)
  
  // More defensive role checking
  const isStaff = currentUser?.role === "staff"
  const isOrgAdmin = currentUser?.role === "orgAdmin"
  const isSuperAdmin = currentUser?.role === "superAdmin"
  
  // Role-based access control for client creation
  // Only org admins and super admins can create clients
  // Staff users can only view clients
  const shouldDisableButton = isStaff
  
  const tooltipMessage = translate("homeScreen.adminOnlyMessage")

  const handleClientPress = (client: Client) => {
    dispatch(setClient(client))
    dispatch(setSchedules(client.schedules))
    navigation.navigate("Client")
  }

  const handleAddClient = () => {
    dispatch(clearClient())
    dispatch(clearSchedules())
    navigation.navigate("Client")
  }

  const handleCallNow = async (client: Client) => {
    try {
      dispatch(setClient(client))
      logger.debug('Initiating call for client:', client.id, client.name)
      const response = await initiateCall({
        clientId: client.id || '',
        callNotes: `Manual call initiated by agent to ${client.name}`
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
        clientId: response.clientId,
        clientName: response.clientName,
        clientPhone: response.clientPhone,
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

  const renderClient = ({ item }: { item: Client }) => {
    const hasNoSchedule = !item.schedules || item.schedules.length === 0
    const cardStyle = hasNoSchedule 
      ? [styles.clientCard, styles.clientCardWarning]
      : styles.clientCard
    
    return (
      <Card
        style={cardStyle}
        testID={`client-card-${item.id}`}
        accessibilityLabel={`client-card-${item.name}`}
        LeftComponent={<AutoImage source={{ uri: item.avatar }} style={styles.avatar} />}
        content={item.name}
        contentStyle={styles.clientName}
        ContentTextProps={{ testID: `client-name-${item.name}` }}
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
              accessibilityHint="Initiates a phone call to this client"
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
              onPress={() => handleClientPress(item)}
              testID={`edit-client-button-${item.id}`}
              accessibilityLabel={`Edit ${item.name}`}
              accessibilityHint="Opens client details for editing"
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

  const ListEmpty = () => <Text style={styles.noUsersText} testID="home-no-clients">{translate("homeScreen.noClientsFound")}</Text>

  // Don't return null during theme loading - render with default theme instead
  // This prevents the component from not rendering during async theme loading
  if (themeLoading) {
    console.log('[HOMESCREEN] themeLoading is true, but rendering anyway with default colors')
    // Continue rendering - useTheme will return default theme if loading
  }
  
  // Debug log to confirm component is rendering
  console.log('[HOMESCREEN] Component rendering: currentUser.id=', currentUser?.id, 'clients.count=', clients.length, 'themeLoading=', themeLoading)

  const styles = createStyles(colors)

  return (
    <View style={styles.container} accessibilityLabel="home-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="home-header" accessibilityLabel="home-header">{translate("homeScreen.welcome", { name: currentUser ? currentUser.name : translate("homeScreen.guest") })}</Text>
      </View>

      {/* Phone Verification Banner */}
      <PhoneVerificationBanner />

      {/* Client List */}
      <FlatList
        data={clients}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderClient}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ListEmpty}
        testID="client-list"
        extraData={clients.length}
        removeClippedSubviews={false} // Ensure all items are rendered (important for testing)
      />

      {/* Footer (Add Client) with Tooltip */}
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
            text={translate("homeScreen.addClient")}
            preset="primary"
            onPress={shouldDisableButton ? undefined : handleAddClient}
            testID="add-client-button"
            disabled={shouldDisableButton}
            style={styles.addButton}
          />
        </View>
        {shouldDisableButton && showTooltip && (
          <View style={styles.tooltip} testID="add-client-tooltip">
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
  clientCard: {
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
  clientCardWarning: {
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
  clientInfo: {
    alignItems: "center",
    flexDirection: "row",
  },
  clientName: {
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
