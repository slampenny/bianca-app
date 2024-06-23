import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { View, Text, StyleSheet } from 'react-native';
import { Toggle } from '../components';
import { Alert } from '../services/api/api.types';
import { useMarkAllAsReadMutation, useMarkAlertAsReadMutation, useGetAllAlertsQuery } from '../services/api';
import { LoadingScreen } from './LoadingScreen';
import { Button, EmptyState, ListItem, ListView } from '../components';
import { getAlerts, setAlerts } from 'app/store/alertSlice';

export function AlertScreen() {
  const dispatch = useDispatch();
  const alerts = useSelector(getAlerts);
  const [selectedAlert, setSelectedAlert] = useState<string|null>(null);
  const [refresh, setRefresh] = useState(false);
  const [showUnread, setShowUnread] = useState(true);
  const { data: fetchAllAlerts, isLoading: isFetching, error: fetchError, refetch } = useGetAllAlertsQuery()
  const [markAllAsRead, { isSuccess: isMarkAllAsReadSuccess }] = useMarkAllAsReadMutation();
  const [markAlertAsRead] = useMarkAlertAsReadMutation();

  useEffect(() => {
    if (fetchAllAlerts) {
      dispatch(setAlerts(fetchAllAlerts));
    }
  }, [fetchAllAlerts, dispatch]);

  const handleAlertPress = async (alert: Alert) => {
    if (alert.id) {
      setSelectedAlert(alert.id);
      await markAlertAsRead({ alertId: alert.id });
    }
  };

  const handleRefresh = async () => {
    setRefresh(true);
    await refetch();
    setRefresh(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead({alerts: filteredAlerts});
    await refetch();
  };

  const renderItem = ({ item }: { item: Alert }) => (
    <ListItem onPress={() => handleAlertPress(item)} style={styles.listItem}>
      <View style={styles.checkboxContainer}>
        <Toggle 
          value={item.readBy?.length > 0}
          onValueChange={() => handleAlertPress(item)}
        //  labelTx="alertScreen.markAllAsRead" 
          variant="checkbox" 
        />
      </View>
      <View style={styles.alertContent}>
        <Text style={styles.alertMessage}>{item.message}</Text>
        <Text style={styles.alertDetails}>Importance: {item.importance}</Text>
        {item.relevanceUntil && <Text style={styles.alertDetails}>Expires: {new Date(item.relevanceUntil).toLocaleString()}</Text>}
      </View>
    </ListItem>
  );

  const filteredAlerts = showUnread ? alerts.filter(alert => !alert.readBy?.length) : alerts;

  console.log("alerts", alerts);

  return (
    <View style={styles.container}>
      {isFetching ? (
        <LoadingScreen />
      ) : (
        <>
          <View style={styles.tabs}>
            <Button
              text="Unread Alerts"
              onPress={() => setShowUnread(true)}
              style={showUnread ? styles.activeTab : styles.inactiveTab}
            />
            <Button
              text="All Alerts"
              onPress={() => setShowUnread(false)}
              style={!showUnread ? styles.activeTab : styles.inactiveTab}
            />
          </View>
          {filteredAlerts.length === 0 ? (
            <EmptyState
              style={{ padding: 10 }}
              content="No alerts"
            />  
          ) : (
            <>  
            <View style={styles.header}>
              <Toggle value={false} onValueChange={handleMarkAllAsRead} labelTx="alertScreen.markAllAsRead" variant="checkbox" />
            </View>
            <ListView
              data={filteredAlerts}
              renderItem={renderItem}
              keyExtractor={item => item.id || ''}
              style={styles.listView}
            />
            </>
          )}
          <Button text="Refresh" onPress={handleRefresh} style={styles.refreshButton} />
          </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  markAllText: {
    marginLeft: 10,
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  activeTab: {
    backgroundColor: '#3498db',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
  },
  inactiveTab: {
    backgroundColor: '#ccc',
    padding: 10,
    borderRadius: 5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginVertical: 5,
    backgroundColor: '#fff',
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  checkboxContainer: {
    marginRight: 10,
  },
  checkbox: {
    alignSelf: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertDetails: {
    fontSize: 12,
    color: 'gray',
  },
  listView: {
    marginTop: 10,
  },
  refreshButton: {
    marginTop: 10,
    backgroundColor: '#3498db',
    color: '#fff',
  },
});
