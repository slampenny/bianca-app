import React, { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { FlatList, View, StyleSheet, ActivityIndicator, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Toggle, Button, ListItem, Text } from "../components"
import {
  useMarkAllAsReadMutation,
  useMarkAlertAsReadMutation,
  useGetAllAlertsQuery,
  useGetAllPatientsQuery,
} from "../services/api"
import { getAlerts, setAlerts, selectUnreadAlertCount } from "app/store/alertSlice"
import { Alert, Caregiver, Patient } from "../services/api/api.types"
import { getCurrentUser } from "app/store/authSlice"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { logger } from "../utils/logger"

export function AlertScreen() {
  const dispatch = useDispatch()
  const alerts = useSelector(getAlerts)
  const unreadAlertCount = useSelector(selectUnreadAlertCount)
  const currentUser = useSelector(getCurrentUser) as Caregiver | null
  const [showUnread, setShowUnread] = useState(true)
  const { colors, isLoading: themeLoading } = useTheme()

  const {
    data: fetchAllAlerts,
    isLoading: isFetching,
    error: fetchError,
    refetch,
  } = useGetAllAlertsQuery(undefined, {
    // Poll every 30 seconds to automatically fetch new alerts (or 3 seconds in test mode)
    // Check multiple ways to detect test mode since process.env might not be available in browser
    pollingInterval: (() => {
      if (typeof window !== 'undefined') {
        // Check URL parameter (set by Playwright tests)
        if (window.location.search.includes('playwright_test=1')) return 3000;
        // Check localStorage (can be set by tests)
        if (localStorage.getItem('playwright_test') === '1') return 3000;
      }
      // Check process.env (works in Node.js, might work in some build configs)
      if (process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST === '1') return 3000;
      return 30000;
    })(),
    // Refetch when the screen comes into focus
    refetchOnFocus: true,
    // Refetch when the app reconnects
    refetchOnReconnect: true,
  })

  const {
    data: patientsData,
    isLoading: isPatientsLoading,
  } = useGetAllPatientsQuery({})

  const [markAllAsRead] = useMarkAllAsReadMutation()
  const [markAlertAsRead] = useMarkAlertAsReadMutation()
  
  // Use a ref to track current alerts for merging without causing dependency issues
  const alertsRef = React.useRef(alerts)
  React.useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])

  useEffect(() => {
    if (fetchAllAlerts) {
      // First, deduplicate the API response itself (in case API returns duplicates)
      const uniqueApiAlerts = Array.from(
        new Map(fetchAllAlerts.map(a => [a.id, a])).values()
      )
      
      const readCount = currentUser 
        ? uniqueApiAlerts.filter(a => a.readBy?.includes(currentUser.id!)).length 
        : 0
      const unreadCount = uniqueApiAlerts.length - readCount
      logger.debug("Fetched alerts from API:", {
        total: uniqueApiAlerts.length,
        read: readCount,
        unread: unreadCount,
        hadDuplicates: fetchAllAlerts.length !== uniqueApiAlerts.length,
        alertIds: uniqueApiAlerts.slice(0, 5).map(a => ({ id: a.id, readBy: a.readBy, isRead: currentUser ? a.readBy?.includes(currentUser.id!) : false }))
      })
      
      // CRITICAL: Only merge if we detect the API is missing read alerts that we know exist
      // This handles race conditions where an alert was just marked as read but the API hasn't updated yet
      const currentAlerts = alertsRef.current
      const currentReadAlerts = currentUser 
        ? currentAlerts.filter(a => a.readBy?.includes(currentUser.id!))
        : []
      
      // Create a map of API alerts by ID for quick lookup
      const apiAlertsMap = new Map(uniqueApiAlerts.map(a => [a.id, a]))
      
      // Check if any read alerts from local state are missing from API response
      const missingReadAlerts = currentReadAlerts.filter(localReadAlert => 
        !apiAlertsMap.has(localReadAlert.id)
      )
      
      if (missingReadAlerts.length > 0) {
        logger.debug('[AlertScreen] API missing read alerts, merging:', missingReadAlerts.length)
        // Only merge if we detect missing alerts - otherwise trust the API completely
        const mergedAlerts = [...uniqueApiAlerts, ...missingReadAlerts]
        // Remove duplicates (shouldn't be any, but be safe)
        const finalAlerts = Array.from(
          new Map(mergedAlerts.map(a => [a.id, a])).values()
        )
        logger.debug('[AlertScreen] Merged alerts:', {
          fromAPI: uniqueApiAlerts.length,
          addedFromLocal: missingReadAlerts.length,
          total: finalAlerts.length
        })
        dispatch(setAlerts(finalAlerts))
      } else {
        // API has all alerts, just use it directly (no merging needed)
        logger.debug('[AlertScreen] API has all alerts, using directly')
        dispatch(setAlerts(uniqueApiAlerts))
      }
    }
  }, [fetchAllAlerts, dispatch, currentUser?.id])

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return
    const filteredAlerts = showUnread
      ? alerts.filter((alert) => !alert.readBy?.includes(currentUser.id!))
      : alerts

    try {
      await markAllAsRead({ alerts: filteredAlerts }).unwrap()
      await refetch()
    } catch (error: any) {
      // Handle authentication errors gracefully
      const errorStatus = error?.status
      const errorData = error?.data
      const customError = error?.error
      
      // Check if this is an authentication error (401 or CUSTOM_ERROR from cancelled auth)
      if (errorStatus === 401 || (customError && customError.status === 'CUSTOM_ERROR')) {
        // Authentication error - the auth modal should already be showing
        // Don't show additional error messages, just log it
        logger.debug('[AlertScreen] Mark all as read failed due to authentication error:', {
          status: errorStatus,
          error: customError?.error || errorData?.message || 'Authentication required'
        })
        // Don't refetch on auth error - let the user authenticate first
        return
      }
      
      // For other errors, log and potentially show a user-friendly message
      logger.error('[AlertScreen] Failed to mark all alerts as read:', error)
      // Optionally show an error toast or message to the user
      // For now, we'll just log it and not refetch
    }
  }

  const handleAlertPress = async (alert: Alert) => {
    if (alert.id) {
      try {
        logger.debug('[AlertScreen] Marking alert as read:', alert.id)
        logger.debug('[AlertScreen] Current alerts in state before marking:', alerts.length)
        logger.debug('[AlertScreen] Current alerts breakdown:', {
          total: alerts.length,
          read: currentUser ? alerts.filter(a => a.readBy?.includes(currentUser.id!)).length : 0,
          unread: currentUser ? alerts.filter(a => !a.readBy?.includes(currentUser.id!)).length : 0
        })
        
        const updatedAlert = await markAlertAsRead({ alertId: alert.id }).unwrap()
        logger.debug('[AlertScreen] Alert marked as read, updated alert:', updatedAlert)
        logger.debug('[AlertScreen] Updated alert readBy:', updatedAlert.readBy)
        
        // Note: The alertSlice extraReducer automatically updates the alert in Redux state
        // No need to manually update here - that could cause duplicates
        
        // Wait for invalidatesTags to trigger automatic refetch, then also manually refetch
        // This ensures we get the latest data from the server
        await new Promise(resolve => setTimeout(resolve, 500))
        const refetchResult = await refetch()
        
        if (refetchResult.data) {
          const readCount = currentUser 
            ? refetchResult.data.filter(a => a.readBy?.includes(currentUser.id!)).length 
            : 0
          logger.debug('[AlertScreen] After refetch, got:', {
            total: refetchResult.data.length,
            read: readCount,
            unread: refetchResult.data.length - readCount
          })
        } else {
          logger.debug('[AlertScreen] Refetch returned no data')
        }
      } catch (error) {
        logger.error("Failed to mark alert as read:", error)
      }
    }
  }

  // Helper function to get patient name by ID
  const getPatientName = (patientId: string) => {
    if (!patientsData?.results) return "Unknown Patient"
    const patient = patientsData.results.find(p => p.id === patientId)
    return patient?.name || "Unknown Patient"
  }

  // Helper function to get alert type display text
  const getAlertTypeDisplay = (alertType: string) => {
    switch (alertType) {
      case 'conversation':
        return 'Conversation Alert'
      case 'patient':
        return 'Patient Alert'
      case 'system':
        return 'System Alert'
      case 'schedule':
        return 'Schedule Alert'
      default:
        return 'Alert'
    }
  }

  // Helper function to determine if all visible alerts are read
  const allVisibleAlertsRead = alerts.every(alert => alert.readBy?.includes(currentUser?.id || ""))

  const renderItem = ({ item }: { item: Alert }) => (
    <ListItem onPress={() => handleAlertPress(item)} style={styles.listItem} testID="alert-item">
      <View style={styles.alertContent}>
        <View style={styles.alertHeader}>
          <Toggle
            value={!!item.readBy?.includes(currentUser?.id || "")}
            onValueChange={() => handleAlertPress(item)}
            variant="checkbox"
            containerStyle={styles.alertToggle}
            testID="alert-checkbox"
          />
          <View style={styles.alertHeaderContent}>
            <Text style={styles.alertMessage} numberOfLines={1}>
              {item.message}
            </Text>
            <Text style={styles.alertType}>
              {getAlertTypeDisplay(item.alertType)}
            </Text>
          </View>
        </View>
        
        {/* Show patient information if alert is related to a patient */}
        {item.relatedPatient && (
          <Text style={styles.alertDetails}>
            {translate("alertScreen.patient")} {getPatientName(item.relatedPatient)}
          </Text>
        )}
        
        <Text style={styles.alertDetails}>{translate("alertScreen.importance")} {item.importance}</Text>
        {item.relevanceUntil && (
          <Text style={styles.alertDetails}>
            {translate("alertScreen.expires")} {new Date(item.relevanceUntil).toLocaleString()}
          </Text>
        )}
      </View>
    </ListItem>
  )

  // Compute filtered alerts - use useMemo to ensure it updates when dependencies change
  // CRITICAL: When showUnread is false, we MUST show ALL alerts (both read and unread)
  const filteredAlerts = React.useMemo(() => {
    logger.debug('[AlertScreen] Computing filteredAlerts:', {
      showUnread,
      totalAlerts: alerts.length,
      currentUserId: currentUser?.id,
      alertIds: alerts.map(a => ({ id: a.id, readBy: a.readBy }))
    })
    
    if (showUnread) {
      // Filter to only show unread alerts
      const unread = currentUser 
        ? alerts.filter((alert) => !alert.readBy?.includes(currentUser.id!)) 
        : []
      logger.debug('[AlertScreen] Unread alerts:', unread.length)
      return unread
    } else {
      // CRITICAL: Show ALL alerts when not filtering by unread (both read and unread)
      logger.debug('[AlertScreen] Showing ALL alerts (read + unread):', alerts.length)
      return alerts
    }
  }, [showUnread, alerts, currentUser?.id])

  // Debug logging
  React.useEffect(() => {
    logger.debug('[AlertScreen] Debug:', {
      showUnread,
      alertsCount: alerts.length,
      filteredAlertsCount: filteredAlerts.length,
      currentUserId: currentUser?.id,
      firstFewAlerts: alerts.slice(0, 3).map(a => ({ 
        id: a.id, 
        readBy: a.readBy,
        isReadByCurrentUser: currentUser ? a.readBy?.includes(currentUser.id!) : false
      }))
    })
  }, [showUnread, alerts.length, filteredAlerts.length, currentUser?.id])

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)

  if (isFetching) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.palette.biancaButtonSelected} />
      </View>
    )
  }

  const handleShowUnreadChange = (newValue: boolean) => {
    logger.debug('[AlertScreen] Changing showUnread from', showUnread, 'to', newValue)
    setShowUnread(newValue)
    // Don't refetch - just update the filter state
  }

  return (
    <View style={styles.container} testID="alert-screen" accessibilityLabel="alert-screen">
      <View style={styles.contentContainer}>
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => {
              logger.debug('Pressing Unread tab')
              handleShowUnreadChange(true)
            }}
            style={styles.tabButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={translate("alertScreen.unreadAlerts")}
          >
            <View style={styles.tabButtonContent}>
              <Text style={styles.tabText}>
                {translate("alertScreen.unreadAlerts")}
              </Text>
              {showUnread && <View style={styles.tabUnderline} />}
            </View>
          </Pressable>
          <Pressable
            onPress={() => {
              logger.debug('Pressing All Alerts tab')
              handleShowUnreadChange(false)
            }}
            style={styles.tabButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="tab"
            accessibilityLabel={translate("alertScreen.allAlerts") || "All alerts"}
            accessibilityState={{ selected: !showUnread }}
          >
            <View style={styles.tabButtonContent}>
              <Text style={styles.tabText}>
                {translate("alertScreen.allAlerts")}
              </Text>
              {!showUnread && <View style={styles.tabUnderline} />}
            </View>
          </Pressable>
        </View>

        {alerts.length > 0 && (
          <View style={styles.markAllContainer}>
            <Button
              text={translate("alertScreen.markAllAsRead")}
              onPress={handleMarkAllAsRead}
              style={styles.refreshButton}
              testID="mark-all-checkbox"
              accessibilityLabel={translate("alertScreen.markAllAsRead") || "Mark all alerts as read"}
              accessibilityHint="Marks all unread alerts as read"
            />
          </View>
        )}

        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyStateContainer} testID="alert-empty-state">
            <View style={styles.emptyStateIcon}>
              <Ionicons name="checkmark-circle-outline" size={64} color={colors.palette.success500 || colors.palette.neutral100 || "#FFFFFF"} />
            </View>
            <Text style={styles.emptyStateTitle}>{translate("alertScreen.noAlertsTitle")}</Text>
            <Text style={styles.emptyStateSubtitle}>{translate("alertScreen.noAlertsSubtitle")}</Text>
          </View>
        ) : (
          <FlatList
            key={`alert-list-${showUnread ? 'unread' : 'all'}`}
            data={filteredAlerts}
            renderItem={renderItem}
            keyExtractor={(item) => item.id || ""}
            style={styles.listView}
            testID="alert-list"
          />
        )}

      </View>
    </View>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  alertContent: {
    flex: 1,
  },
  alertDetails: {
    color: colors.palette.neutral600,
    fontSize: 14,
  },
  alertHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 4,
  },
  alertHeaderContent: {
    flex: 1,
  },
  alertMessage: {
    color: colors.palette.biancaHeader,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "bold",
  },
  alertToggle: {
    marginRight: 8,
  },
  alertType: {
    color: colors.palette.biancaButtonSelected,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyState: {
    marginTop: 40,
  },
  emptyStateContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyStateIcon: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaBackground,
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    marginBottom: 24,
    width: 80,
  },
  emptyStateTitle: {
    color: colors.palette.biancaHeader,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtitle: {
    color: colors.palette.neutral600,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  listItem: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: 6,
    marginBottom: 10,
    padding: 10,
    shadowColor: colors.palette.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  listView: {
    marginTop: 10,
  },
  loaderContainer: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
    justifyContent: "center",
  },
  markAllContainer: {
    alignItems: "center",
    flexDirection: "row",
    marginVertical: 10,
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    marginTop: 20,
    paddingVertical: 10,
  },
  tabButton: {
    flex: 1,
  },
  tabButtonContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabText: {
    color: colors.palette.biancaHeader || colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  tabUnderline: {
    position: "absolute",
    bottom: -1,
    left: "10%",
    right: "10%",
    height: 2,
    backgroundColor: colors.palette.biancaHeader || colors.text,
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.biancaBorder || colors.border,
  },
  debugText: {
    color: colors.palette.biancaHeader || colors.text,
    fontSize: 12,
    padding: 8,
    textAlign: "center",
  },
})
