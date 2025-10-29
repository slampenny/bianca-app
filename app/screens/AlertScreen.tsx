import React, { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { FlatList, View, StyleSheet, ActivityIndicator, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Toggle, Button, EmptyState, ListItem, Text } from "../components"
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

export function AlertScreen() {
  const dispatch = useDispatch()
  const alerts = useSelector(getAlerts)
  const unreadAlertCount = useSelector(selectUnreadAlertCount)
  const currentUser = useSelector(getCurrentUser) as Caregiver | null
  const [showUnread, setShowUnread] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, isLoading: themeLoading } = useTheme()

  const {
    data: fetchAllAlerts,
    isLoading: isFetching,
    error: fetchError,
    refetch,
  } = useGetAllAlertsQuery()

  const {
    data: patientsData,
    isLoading: isPatientsLoading,
  } = useGetAllPatientsQuery({})

  const [markAllAsRead] = useMarkAllAsReadMutation()
  const [markAlertAsRead] = useMarkAlertAsReadMutation()

  useEffect(() => {
    if (fetchAllAlerts) {
      const readCount = currentUser 
        ? fetchAllAlerts.filter(a => a.readBy?.includes(currentUser.id!)).length 
        : 0
      const unreadCount = fetchAllAlerts.length - readCount
      console.log("Fetched alerts from API:", {
        total: fetchAllAlerts.length,
        read: readCount,
        unread: unreadCount,
        alertIds: fetchAllAlerts.slice(0, 5).map(a => ({ id: a.id, readBy: a.readBy, isRead: currentUser ? a.readBy?.includes(currentUser.id!) : false }))
      })
      
      // CRITICAL: Check if we're about to lose read alerts
      const currentReadCount = currentUser 
        ? alerts.filter(a => a.readBy?.includes(currentUser.id!)).length 
        : 0
      if (currentReadCount > 0 && readCount === 0 && fetchAllAlerts.length === alerts.filter(a => !a.readBy?.includes(currentUser?.id!)).length) {
        console.warn('[AlertScreen] WARNING: API returned only unread alerts when read alerts exist!')
        console.warn('[AlertScreen] Current state has', currentReadCount, 'read alerts, but API returned', readCount)
        // Don't overwrite if we'd lose read alerts - merge instead
        const existingReadAlerts = alerts.filter(a => currentUser && a.readBy?.includes(currentUser.id!))
        const mergedAlerts = [...fetchAllAlerts, ...existingReadAlerts.filter(existing => 
          !fetchAllAlerts.some(fresh => fresh.id === existing.id)
        )]
        console.log('[AlertScreen] Merged alerts to preserve read ones:', mergedAlerts.length)
        dispatch(setAlerts(mergedAlerts))
        return
      }
      
      // CRITICAL: Replace entire alerts array with fresh data from API
      // This ensures we have ALL alerts including read ones
      dispatch(setAlerts(fetchAllAlerts))
      console.log("Updated Redux state with", fetchAllAlerts.length, "alerts")
    }
  }, [fetchAllAlerts, dispatch, currentUser?.id])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return
    const filteredAlerts = showUnread
      ? alerts.filter((alert) => !alert.readBy?.includes(currentUser.id!))
      : alerts

    await markAllAsRead({ alerts: filteredAlerts })
    await refetch()
  }

  const handleAlertPress = async (alert: Alert) => {
    if (alert.id) {
      try {
        console.log('[AlertScreen] Marking alert as read:', alert.id)
        console.log('[AlertScreen] Current alerts in state before marking:', alerts.length)
        console.log('[AlertScreen] Current alerts breakdown:', {
          total: alerts.length,
          read: currentUser ? alerts.filter(a => a.readBy?.includes(currentUser.id!)).length : 0,
          unread: currentUser ? alerts.filter(a => !a.readBy?.includes(currentUser.id!)).length : 0
        })
        
        const updatedAlert = await markAlertAsRead({ alertId: alert.id }).unwrap()
        console.log('[AlertScreen] Alert marked as read, updated alert:', updatedAlert)
        console.log('[AlertScreen] Updated alert readBy:', updatedAlert.readBy)
        
        // Update Redux immediately with the updated alert to ensure it's in state
        // Find the alert in the array and update it
        const alertIndex = alerts.findIndex(a => a.id === alert.id)
        if (alertIndex !== -1) {
          const updatedAlerts = [...alerts]
          updatedAlerts[alertIndex] = updatedAlert
          dispatch(setAlerts(updatedAlerts))
          console.log('[AlertScreen] Updated Redux state immediately with', updatedAlerts.length, 'alerts')
        }
        
        // Wait for invalidatesTags to trigger automatic refetch, then also manually refetch
        await new Promise(resolve => setTimeout(resolve, 1000))
        const refetchResult = await refetch()
        
        if (refetchResult.data) {
          const readCount = currentUser 
            ? refetchResult.data.filter(a => a.readBy?.includes(currentUser.id!)).length 
            : 0
          console.log('[AlertScreen] After refetch, got:', {
            total: refetchResult.data.length,
            read: readCount,
            unread: refetchResult.data.length - readCount
          })
        } else {
          console.log('[AlertScreen] Refetch returned no data')
        }
      } catch (error) {
        console.error("Failed to mark alert as read:", error)
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
    console.log('[AlertScreen] Computing filteredAlerts:', {
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
      console.log('[AlertScreen] Unread alerts:', unread.length)
      return unread
    } else {
      // CRITICAL: Show ALL alerts when not filtering by unread (both read and unread)
      console.log('[AlertScreen] Showing ALL alerts (read + unread):', alerts.length)
      return alerts
    }
  }, [showUnread, alerts, currentUser?.id])

  // Debug logging
  React.useEffect(() => {
    console.log('[AlertScreen] Debug:', {
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
    console.log('[AlertScreen] Changing showUnread from', showUnread, 'to', newValue)
    setShowUnread(newValue)
    // Don't refetch - just update the filter state
  }

  return (
    <View style={styles.container} testID="alert-screen" accessibilityLabel="alert-screen">
      <View style={styles.contentContainer}>
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => {
              console.log('Pressing Unread tab')
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
              console.log('Pressing All Alerts tab')
              handleShowUnreadChange(false)
            }}
            style={styles.tabButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={translate("alertScreen.allAlerts")}
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
            />
          </View>
        )}

        {/* Debug indicator */}
        {__DEV__ && (
          <Text style={styles.debugText}>
            Debug: showUnread={showUnread.toString()}, alerts={alerts.length}, filtered={filteredAlerts.length}
          </Text>
        )}

        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyStateContainer} testID="alert-empty-state">
            <View style={styles.emptyStateIcon}>
              <Ionicons name="checkmark-circle-outline" size={64} color={colors.palette.biancaButtonSelected} />
            </View>
            <Text style={styles.emptyStateTitle}>{translate("alertScreen.noAlertsTitle")}</Text>
            <Text style={styles.emptyStateSubtitle}>{translate("alertScreen.noAlertsSubtitle")}</Text>
            {__DEV__ && (
              <Text style={styles.debugText}>
                Total alerts in store: {alerts.length}, Show unread: {showUnread.toString()}
              </Text>
            )}
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

        <Button
          text={refreshing ? translate("alertScreen.refreshing") : translate("alertScreen.refresh")}
          onPress={handleRefresh}
          style={styles.refreshButton}
        />
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
