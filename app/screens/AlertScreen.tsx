import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { View } from 'react-native';
import { Alert } from '../services/api/api.types';
import { useMarkAllAsReadMutation, useMarkAlertAsReadMutation, useGetAllAlertsQuery } from '../services/api';
import { LoadingScreen } from './LoadingScreen';
import { Button, ListItem, ListView, Text } from '../components';
import { getAlerts } from 'app/store/alertSlice';

export function AlertScreen() {
  const alerts = useSelector(getAlerts);
  const [selectedAlert, setSelectedAlert] = useState<string|null>(null);
  const [refresh, setRefresh] = useState(false);
  const { data: fetchAllAlerts, isLoading: isFetching, error: fetchError, refetch } = useGetAllAlertsQuery(undefined, { skip: true})
  const [markAllAsRead, { isSuccess }] = useMarkAllAsReadMutation();
  const [markAlertAsRead] = useMarkAlertAsReadMutation();

  useEffect(() => {
    if (isSuccess) {
      markAllAsRead({alerts});
    }
  }, [isSuccess, alerts]);

  const handleAlertPress = async (alert: Alert) => {
    if (alert.id) {
      setSelectedAlert(alert.id);
      if (!alert.readBy) {
        await markAlertAsRead({ alertId: alert.id });
      }
    }
  };

  const handleRefresh = async () => {
    setRefresh(true);
    await refetch();
    setRefresh(false);
  };

  const renderItem = ({ item }: { item: Alert }) => (
    <ListItem onPress={() => handleAlertPress(item)}>
      {selectedAlert === item.id ? item.message : `${item.message.substring(0, 10)}...`}
    </ListItem>
  );

  return (
    <View style={{ flex: 1 }}>
      {isFetching ? (
        <LoadingScreen />
      ) : alerts.length === 0 ? (
        <Text style={{ textAlign: 'center', fontSize: 24, margin: 20}}>No alerts</Text>
      ) : (
        <>
          <ListView
            data={alerts}
            renderItem={renderItem}
            keyExtractor={item => item.id || ''}
          />
          <Button text="Refresh" onPress={handleRefresh} />
        </>
      )}
    </View>
  );
}