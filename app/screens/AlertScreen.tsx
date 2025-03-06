import React, { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { FlatList } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native"
import { Toggle, Button, EmptyState, ListItem, ListView } from "../components"
import {
  useMarkAllAsReadMutation,
  useMarkAlertAsReadMutation,
  useGetAllAlertsQuery,
} from "../services/api"
import { getAlerts, setAlerts } from "app/store/alertSlice"
import { Alert } from "../services/api/api.types"

/** If you have a common header component, import it here.
 * Otherwise, we manually create a simple header below.
 */
// import { Header } from "app/components"

export function AlertScreen() {
  const dispatch = useDispatch()
  const alerts = useSelector(getAlerts)
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
      dispatch(setAlerts(fetchAllAlerts))
    }
  }, [fetchAllAlerts, dispatch])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const handleMarkAllAsRead = async () => {
    // Filter to only those currently shown
    const filteredAlerts = showUnread
      ? alerts.filter((alert) => !alert.readBy?.length)
      : alerts

    await markAllAsRead({ alerts: filteredAlerts })
    await refetch()
  }

  const handleAlertPress = async (alert: Alert) => {
    if (alert.id) {
      await markAlertAsRead({ alertId: alert.id })
    }
  }

  // Filter alerts based on the toggle
  const filteredAlerts = showUnread
    ? alerts.filter((alert) => !alert.readBy?.length)
    : alerts

  const renderItem = ({ item }: { item: Alert }) => (
    <ListItem onPress={() => handleAlertPress(item)} style={styles.listItem}>
      <View style={styles.alertContent}>
        <View style={styles.alertHeader}>
          {/* Toggle to mark individual alert read/unread */}
          <Toggle
            value={!!item.readBy?.length}
            onValueChange={() => handleAlertPress(item)}
            variant="checkbox"
            style={styles.alertToggle}
          />
          <Text style={styles.alertMessage} numberOfLines={1}>
            {item.message}
          </Text>
        </View>
        <Text style={styles.alertDetails}>
          Importance: {item.importance}
        </Text>
        {item.relevanceUntil && (
          <Text style={styles.alertDetails}>
            Expires: {new Date(item.relevanceUntil).toLocaleString()}
          </Text>
        )}
      </View>
    </ListItem>
  )

  if (isFetching) {
    // Show a simple loader or your custom LoadingScreen
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* CONTENT */}
      <View style={styles.contentContainer}>
        {/* Tabs: Unread vs All */}
        <View style={styles.tabRow}>
          <Button
            text="Unread Alerts"
            onPress={() => setShowUnread(true)}
            style={[styles.tabButton, showUnread ? styles.activeTab : styles.inactiveTab]}
            textStyle={showUnread ? styles.activeTabText : styles.inactiveTabText}
          />
          <Button
            text="All Alerts"
            onPress={() => setShowUnread(false)}
            style={[styles.tabButton, !showUnread ? styles.activeTab : styles.inactiveTab]}
            textStyle={!showUnread ? styles.activeTabText : styles.inactiveTabText}
          />
        </View>

        {/* Mark all as read */}
        {filteredAlerts.length > 0 && (
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

        {/* Alert List / Empty State */}
        {filteredAlerts.length === 0 ? (
          <EmptyState
            style={styles.emptyState}
            content="No alerts"
            heading="So empty... so sad"
          />
        ) : (
          <FlatList
            data={filteredAlerts}
            renderItem={renderItem}
            keyExtractor={(item) => item.id || ""}
            style={styles.listView}
          />
        )}

        {/* Refresh Button */}
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
  // Screen container
  container: {
    flex: 1,
    backgroundColor: "#ecf0f1",
  },
  // Header
  header: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
  },
  // Main content
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Loader
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ecf0f1",
  },
  // Tabs
  tabRow: {
    flexDirection: "row",
    marginBottom: 16,
    justifyContent: "space-between",
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 12,
    borderRadius: 5,
  },
  activeTab: {
    backgroundColor: "#3498db",
  },
  inactiveTab: {
    backgroundColor: "#ccc",
  },
  activeTabText: {
    color: "#fff",
  },
  inactiveTabText: {
    color: "#2c3e50",
  },
  // Mark all as read
  markAllContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  markAllToggle: {
    marginRight: 8,
  },
  markAllText: {
    fontSize: 16,
    color: "#2c3e50",
  },
  // Empty state
  emptyState: {
    marginTop: 40,
  },
  // List
  listView: {
    marginBottom: 16,
  },
  listItem: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 12,
    marginVertical: 6,
    // shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    // elevation for Android
    elevation: 2,
  },
  alertContent: {
    flex: 1,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  alertToggle: {
    marginRight: 8,
  },
  alertMessage: {
    fontSize: 16,
    fontWeight: "bold",
    flexShrink: 1,
    color: "#2c3e50",
  },
  alertDetails: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  // Refresh button
  refreshButton: {
    backgroundColor: "#3498db",
    marginBottom: 20,
  },
})
