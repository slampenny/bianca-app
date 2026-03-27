import React, { useCallback } from "react"
import { View, StyleSheet, FlatList, Platform } from "react-native"
import { AutoImage, Card, Button, Text, ClientGlanceStat } from "app/components"
import { Ionicons } from "@expo/vector-icons"
import { useSelector, useDispatch } from "react-redux"
import { getCurrentUser, getAuthTokens } from "../store/authSlice"
import { useAuthModal } from "../contexts/AuthModalContext"
import { hasUsableAccessToken } from "../utils/accessToken"
import { setClient, getClientsForCaregiver, clearClient, setClientsForCaregiver } from "../store/clientSlice"
import { getAlerts } from "../store/alertSlice"
import { setSchedules, clearSchedules } from "../store/scheduleSlice"
import { setPendingCallData, clearCallData } from "../store/callSlice"
import { clearConversation } from "../store/conversationSlice"
import { useInitiateCallMutation } from "../services/api/callWorkflowApi"
import { isAuthCancelledError } from "../services/api/baseQueryWithAuth"
import type { CompositeNavigationProp } from "@react-navigation/native"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs"
import type { StackNavigationProp } from "@react-navigation/stack"
import { Caregiver, Client } from "../services/api/api.types"
import type { DrawerParamList, HomeStackParamList } from "app/navigators/navigationTypes"
import { RootState } from "../store/store"

type HomeScreenNavigationProp = CompositeNavigationProp<
  StackNavigationProp<HomeStackParamList, "HomeDetail">,
  BottomTabNavigationProp<DrawerParamList>
>
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { useLanguage } from "../hooks/useLanguage"
import { logger } from "../utils/logger"
import { PhoneVerificationBanner } from "../components/PhoneVerificationBanner"
import { caregiverApi } from "../services/api/caregiverApi"
import { useGetAllAlertsQuery } from "../services/api/alertApi"
import { formatRelativeFromIso } from "../utils/formatDate"

function formatSentimentGlanceLabel(
  trend: Client["sentimentTrendDirection"],
  analyzed: number | null | undefined,
): string {
  if (analyzed == null || analyzed === 0) return translate("homeScreen.glanceNoData")
  if (trend === "improving") return translate("homeScreen.sentimentTrendImproving")
  if (trend === "declining") return translate("homeScreen.sentimentTrendDeclining")
  return translate("homeScreen.sentimentTrendStable")
}

function formatScoreGlance(score: number | null | undefined): string {
  if (score == null || Number.isNaN(Number(score))) return translate("homeScreen.glanceNoData")
  return String(Math.round(Number(score)))
}

function sentimentGlanceIcon(
  trend: Client["sentimentTrendDirection"],
  analyzed: number | null | undefined,
): "trending-up" | "trending-down" | "remove" | null {
  if (analyzed == null || analyzed === 0) return null
  if (trend === "improving") return "trending-up"
  if (trend === "declining") return "trending-down"
  return "remove"
}

export function HomeScreen() {
  const dispatch = useDispatch()
  const currentUser: Caregiver | null = useSelector(getCurrentUser)
  const [fetchClientsForCaregiver] = caregiverApi.useLazyGetClientsForCaregiverQuery()
  const [initiateCall, { isLoading: isInitiatingCall }] = useInitiateCallMutation()
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  const { colors, isLoading: themeLoading } = useTheme()
  
  const clients = useSelector((state: RootState) => {
    const user = state.auth.currentUser || (state.auth as { user?: { id: string } }).user
    if (!user || !user.id) return []
    return getClientsForCaregiver(state, user.id)
  })

  const alertsFromStore = useSelector(getAlerts)

  const { data: alertsFromApi } = useGetAllAlertsQuery(undefined, {
    skip: !currentUser?.id,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  })

  /** Prefer RTK cache when loaded so home counts stay fresh without clobbering alert Redux merge logic */
  const alertsForCounts = React.useMemo(() => {
    if (alertsFromApi !== undefined) {
      return Array.from(new Map(alertsFromApi.map((a) => [a.id, a])).values())
    }
    return alertsFromStore
  }, [alertsFromApi, alertsFromStore])

  const alertCountByClientId = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const a of alertsForCounts) {
      const cid = a.relatedClient
      if (!cid) continue
      m.set(cid, (m.get(cid) ?? 0) + 1)
    }
    return m
  }, [alertsForCounts])
  
  React.useEffect(() => {
    if (clients.length > 0 && currentUser?.id) {
      console.log(`[HOMESCREEN] Rendered ${clients.length} clients for user ${currentUser.id}`)
    }
  }, [clients.length, currentUser?.id])

  useFocusEffect(
    useCallback(() => {
      const id = currentUser?.id
      if (!id) return undefined
      void fetchClientsForCaregiver(id)
        .unwrap()
        .then((list) => {
          dispatch(setClientsForCaregiver({ caregiverId: id, clients: list }))
        })
        .catch(() => {
          /* offline / auth: keep cached list */
        })
      return undefined
    }, [currentUser?.id, dispatch, fetchClientsForCaregiver]),
  )

  
  const navigation = useNavigation<HomeScreenNavigationProp>()
  const { showAuthModal } = useAuthModal()
  const authTokens = useSelector(getAuthTokens)
  const [showTooltip, setShowTooltip] = React.useState(false)

  const ensureSignedInForGlanceNavigation = React.useCallback(() => {
    if (!hasUsableAccessToken(authTokens)) {
      showAuthModal(translate("common.signInToContinue"))
      return false
    }
    return true
  }, [authTokens, showAuthModal])
  
  // More defensive role checking
  const isStaff = currentUser?.role === "staff"
  const isOrgAdmin = currentUser?.role === "orgAdmin"
  const isSuperAdmin = currentUser?.role === "superAdmin"
  
  // Role-based access control for client creation
  // Only org admins and super admins can create clients
  // Staff users can only view clients
  const shouldDisableButton = isStaff
  
  const tooltipMessage = translate("homeScreen.adminOnlyMessage")

  const primeClientForReports = (client: Client) => {
    dispatch(setClient(client))
    dispatch(setSchedules(client.schedules ?? []))
  }

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
        caregiverId: response.caregiverId,
        caregiverName: response.caregiverName,
        status: response.status || 'initiated',
        callStatus: response.callStatus,
        callType: response.callType,
        onboardingDay: response.onboardingDay,
        onboardingJourneyComplete: response.onboardingJourneyComplete,
        onboardingSessionsCompleted: response.onboardingSessionsCompleted,
        onboardingCurrentStageDay: response.onboardingCurrentStageDay,
        nextOutboundWillBeOnboarding: response.nextOutboundWillBeOnboarding,
        isOnboardingCall: response.isOnboardingCall,
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

  const styles = createStyles(colors)

  const renderClient = ({ item }: { item: Client }) => {
    const hasNoSchedule = !item.schedules || item.schedules.length === 0
    const cardStyle = hasNoSchedule 
      ? [styles.clientCard, styles.clientCardWarning]
      : styles.clientCard

    const lastCalledLabel = item.lastCallAttemptAt
      ? formatRelativeFromIso(item.lastCallAttemptAt)
      : translate("homeScreen.neverCalled")
    const lastAnsweredLabel = item.lastAnsweredCallAt
      ? formatRelativeFromIso(item.lastAnsweredCallAt)
      : translate("homeScreen.noAnsweredCallsYet")

    const clientAlertCount = item.id ? alertCountByClientId.get(item.id) ?? 0 : 0

    const sentimentIcon = sentimentGlanceIcon(
      item.sentimentTrendDirection,
      item.sentimentAnalyzedConversations,
    )
    const sentimentIconColor =
      item.sentimentTrendDirection === "improving"
        ? colors.palette.biancaSuccess || "#22c55e"
        : item.sentimentTrendDirection === "declining"
          ? colors.palette.error || "#ef4444"
          : colors.palette.neutral500

    const contentBlock = (
      <View style={styles.clientContentBlock}>
        <View style={styles.clientTopRow}>
          <View style={styles.nameColumn}>
            <Text style={styles.clientName} testID={`client-name-${item.name}`}>
              {item.name}
            </Text>
            <View style={styles.callMetaColumn}>
              <Text style={styles.callMetaLine} size="xs">
                {translate("homeScreen.lastCalled")}: {lastCalledLabel}
              </Text>
              <Text style={styles.callMetaLine} size="xs">
                {translate("homeScreen.lastAnsweredCall")}: {lastAnsweredLabel}
              </Text>
            </View>
          </View>
          <View style={styles.glanceStats}>
            <ClientGlanceStat
              labelTx="homeScreen.glanceSentiment"
              valueTestID={`client-glance-mood-${item.id}`}
              value={formatSentimentGlanceLabel(
                item.sentimentTrendDirection,
                item.sentimentAnalyzedConversations,
              )}
              accessibilityHint={translate("homeScreen.glanceSentimentActionHint")}
              onPress={() => {
                if (!item.id) return
                if (!ensureSignedInForGlanceNavigation()) return
                primeClientForReports(item)
                navigation.navigate("Reports", {
                  screen: "SentimentReport",
                  params: {
                    clientId: item.id,
                    clientName: item.name,
                    timeRange: "lastCall",
                  },
                })
              }}
              leftAccessory={
                sentimentIcon ? (
                  <Ionicons name={sentimentIcon} size={14} color={sentimentIconColor} />
                ) : undefined
              }
            />
            <ClientGlanceStat
              labelTx="homeScreen.glanceHealth"
              value={formatScoreGlance(item.latestOverallHealthScore)}
              accessibilityHint={translate("homeScreen.glanceHealthActionHint")}
              onPress={() => {
                if (!item.id) return
                if (!ensureSignedInForGlanceNavigation()) return
                primeClientForReports(item)
                navigation.navigate("Reports", {
                  screen: "MedicalAnalysis",
                  params: { clientId: item.id, clientName: item.name },
                })
              }}
            />
            <ClientGlanceStat
              labelTx="homeScreen.glanceRisk"
              value={formatScoreGlance(item.latestOverallRiskScore)}
              accessibilityHint={translate("homeScreen.glanceRiskActionHint")}
              onPress={() => {
                if (!item.id) return
                if (!ensureSignedInForGlanceNavigation()) return
                primeClientForReports(item)
                navigation.navigate("Reports", {
                  screen: "FraudAbuseAnalysis",
                  params: { clientId: item.id, clientName: item.name },
                })
              }}
            />
            <ClientGlanceStat
              labelTx="homeScreen.glanceAlerts"
              value={String(clientAlertCount)}
              valueTestID={`client-glance-alerts-${item.id}`}
              tone={clientAlertCount > 0 ? "danger" : "default"}
              accessibilityHint={translate("homeScreen.glanceAlertsActionHint")}
              onPress={() => {
                if (!item.id) return
                if (!ensureSignedInForGlanceNavigation()) return
                navigation.navigate("Alert", {
                  screen: "AlertList",
                  params: { filterClientId: item.id, filterClientName: item.name },
                })
              }}
              leftAccessory={
                clientAlertCount > 0 ? (
                  <Ionicons name="notifications-outline" size={14} color={colors.palette.biancaError} />
                ) : undefined
              }
            />
          </View>
        </View>
        {hasNoSchedule ? (
          <Text style={styles.warningFooter} testID={`no-schedule-warning-${item.name}`}>
            {translate("homeScreen.noScheduleWarning")}
          </Text>
        ) : null}
      </View>
    )

    return (
      <Card
        style={cardStyle}
        testID={`client-card-${item.id}`}
        accessibilityLabel={`client-card-${item.name}`}
        LeftComponent={<AutoImage source={{ uri: item.avatar }} style={styles.avatar} />}
        ContentComponent={contentBlock}
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
        extraData={{ c: clients.length, a: alertsForCounts.length }}
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
    alignSelf: "flex-start",
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
    alignItems: "flex-start",
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
  callMetaLine: {
    color: colors.palette.neutral600,
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
    fontWeight: "600",
  },
  clientContentBlock: {
    flex: 1,
    minWidth: 0,
  },
  clientTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    gap: 8,
  },
  nameColumn: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
    paddingRight: 4,
  },
  callMetaColumn: {
    gap: 2,
    maxWidth: 220,
  },
  glanceStats: {
    flex: 1,
    minWidth: 0,
    maxWidth: 320,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 6,
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginLeft: 4,
    paddingTop: 2,
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
