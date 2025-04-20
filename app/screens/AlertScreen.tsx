import React, { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { FlatList, View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { Toggle, Button, EmptyState, ListItem } from "../components"
import {
  useMarkAllAsReadMutation,
  useMarkAlertAsReadMutation,
  useGetAllAlertsQuery,
} from "../services/api"
import { getAlerts, setAlerts, selectUnreadAlertCount } from "app/store/alertSlice"
import { Alert } from "../services/api/api.types"
import { getCurrentUser } from "app/store/authSlice"

export function AlertScreen() {
  const dispatch = useDispatch()
  const alerts = useSelector(getAlerts)
  const unreadAlertCount = useSelector(selectUnreadAlertCount)
  const currentUser = useSelector(getCurrentUser)
  const [showUnread, setShowUnread] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const {
    data: fetchAllAlerts,
    isLoading: isFetching,
    error: fetchError,
    refetch,
  } = useGetAllAlertsQuery()

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
    const filteredAlerts = showUnread
      ? alerts.filter((alert) => !alert.readBy?.includes(currentUser?.id))
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

  const renderItem = ({ item }: { item: Alert }) => (
    <ListItem onPress={() => handleAlertPress(item)} style={styles.listItem}>
      <View style={styles.alertContent}>
        <View style={styles.alertHeader}>
          <Toggle
            value={!!item.readBy?.includes(currentUser?.id)}
            onValueChange={() => handleAlertPress(item)}
            variant="checkbox"
            style={styles.alertToggle}
          />
          <Text style={styles.alertMessage} numberOfLines={1}>
            {item.message}
          </Text>
        </View>
        <Text style={styles.alertDetails}>Importance: {item.importance}</Text>
        {item.relevanceUntil && (
          <Text style={styles.alertDetails}>
            Expires: {new Date(item.relevanceUntil).toLocaleString()}
          </Text>
        )}
      </View>
    </ListItem>
  )

  const filteredAlerts = showUnread
    ? alerts.filter((alert) => !alert.readBy?.includes(currentUser?.id))
    : alerts

  if (isFetching) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    )
  }

  const handleShowUnreadChange = (newValue: boolean) => {
    setShowUnread(newValue)
    refetch() // Refetch data after changing showUnread
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.tabRow}>
          <Button
            text="Unread Alerts"
            onPress={() => handleShowUnreadChange(true)}
            style={[styles.tabButton, showUnread ? styles.activeTab : styles.inactiveTab]}
            textStyle={showUnread ? styles.activeTabText : styles.inactiveTabText}
          />
          <Button
            text="All Alerts"
            onPress={() => handleShowUnreadChange(false)}
            style={[styles.tabButton, !showUnread ? styles.activeTab : styles.inactiveTab]}
            textStyle={!showUnread ? styles.activeTabText : styles.inactiveTabText}
          />
        </View>

        {alerts.length > 0 && (
          <View style={styles.markAllContainer}>
            <Toggle
              value={false}
              onValueChange={handleMarkAllAsRead}
              variant="checkbox"
              style={styles.markAllToggle}
            />
            <Text style={styles.markAllText}>Mark all as read</Text>
          </View>
        )}

        {filteredAlerts.length === 0 ? (
          <EmptyState style={styles.emptyState} content="No alerts" heading="So empty... so sad" />
        ) : (
          <FlatList
            data={filteredAlerts}
            renderItem={renderItem}
            keyExtractor={(item) => item.id || ""}
            style={styles.listView}
          />
        )}

        <Button
          text={refreshing ? "Refreshing..." : "Refresh"}
          onPress={handleRefresh}
          style={styles.refreshButton}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  activeTab: {
    backgroundColor: "#3498db",
  },
  activeTabText: {
    color: "#fff",
  },
  alertContent: {
    flex: 1,
  },
  alertDetails: {
    color: "#7f8c8d",
    fontSize: 14,
  },
  alertHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 4,
  },
  alertMessage: {
    color: "#2c3e50",
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "bold",
  },
  alertToggle: {
    marginRight: 8,
  },
  container: {
    backgroundColor: "#ecf0f1",
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
  inactiveTab: {
    backgroundColor: "#ccc",
  },
  inactiveTabText: {
    color: "#2c3e50",
  },
  listItem: {
    backgroundColor: "#fff",
    borderRadius: 6,
    elevation: 2,
    marginVertical: 6,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  listView: {
    marginBottom: 16,
  },
  loaderContainer: {
    alignItems: "center",
    backgroundColor: "#ecf0f1",
    flex: 1,
    justifyContent: "center",
  },
  markAllContainer: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 16,
  },
  markAllText: {
    color: "#2c3e50",
    fontSize: 16,
  },
  markAllToggle: {
    marginRight: 8,
  },
  refreshButton: {
    backgroundColor: "#3498db",
    marginBottom: 20,
  },
  tabButton: {
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 12,
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
})
