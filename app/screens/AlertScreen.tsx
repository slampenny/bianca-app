import React, { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { FlatList, View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Toggle, Button, EmptyState, ListItem } from "../components"
import {
  useMarkAllAsReadMutation,
  useMarkAlertAsReadMutation,
  useGetAllAlertsQuery,
  useGetAllPatientsQuery,
} from "../services/api"
import { getAlerts, setAlerts, selectUnreadAlertCount } from "app/store/alertSlice"
import { Alert, Caregiver, Patient } from "../services/api/api.types"
import { getCurrentUser } from "app/store/authSlice"
import { colors } from "app/theme/colors"
import { translate } from "../i18n"

export function AlertScreen() {
  const dispatch = useDispatch()
  const alerts = useSelector(getAlerts)
  const unreadAlertCount = useSelector(selectUnreadAlertCount)
  const currentUser = useSelector(getCurrentUser) as Caregiver | null
  const [showUnread, setShowUnread] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
      console.log("Fetched alerts:", fetchAllAlerts)
      dispatch(setAlerts(fetchAllAlerts))
    }
  }, [fetchAllAlerts, dispatch])

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
        await markAlertAsRead({ alertId: alert.id }).unwrap()
        refetch()
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

  const filteredAlerts = showUnread
    ? (currentUser ? alerts.filter((alert) => !alert.readBy?.includes(currentUser.id!)) : [])
    : alerts

  if (isFetching) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.palette.biancaButtonSelected} />
      </View>
    )
  }

  const handleShowUnreadChange = (newValue: boolean) => {
    setShowUnread(newValue)
    refetch() // Refetch data after changing showUnread
  }

  return (
    <View style={styles.container} testID="alert-header">
      <View style={styles.contentContainer}>
        <View style={styles.tabRow}>
          <Button
            text={translate("alertScreen.unreadAlerts")}
            onPress={() => handleShowUnreadChange(true)}
            style={[styles.tabButton, showUnread ? styles.activeTab : styles.inactiveTab]}
            textStyle={showUnread ? styles.activeTabText : styles.inactiveTabText}
          />
          <Button
            text={translate("alertScreen.allAlerts")}
            onPress={() => handleShowUnreadChange(false)}
            style={[styles.tabButton, !showUnread ? styles.activeTab : styles.inactiveTab]}
            textStyle={!showUnread ? styles.activeTabText : styles.inactiveTabText}
          />
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

        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyStateContainer} testID="alert-empty-state">
            <View style={styles.emptyStateIcon}>
              <Ionicons name="checkmark-circle-outline" size={64} color={colors.palette.biancaButtonSelected} />
            </View>
            <Text style={styles.emptyStateTitle}>{translate("alertScreen.noAlertsTitle")}</Text>
            <Text style={styles.emptyStateSubtitle}>{translate("alertScreen.noAlertsSubtitle")}</Text>
          </View>
        ) : (
          <FlatList
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

const styles = StyleSheet.create({
  activeTab: {
    backgroundColor: colors.palette.biancaButtonSelected,
  },
  activeTabText: {
    color: colors.palette.neutral100,
  },
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
  inactiveTab: {
    backgroundColor: colors.palette.biancaButtonUnselected,
  },
  inactiveTabText: {
    color: colors.palette.biancaButtonSelected,
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
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
})
