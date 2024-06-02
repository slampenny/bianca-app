import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Text, View, Pressable, FlatList, StyleSheet } from 'react-native';
import { getCurrentUser } from '../store/authSlice';
import { Alert } from '../services/api/api.types';
import { useGetAllAlertsQuery, useMarkAllAsReadMutation, useMarkAlertAsReadMutation } from '../services/api';

export function AlertScreen() {
  const currentUser = useSelector(getCurrentUser);
  const [selectedAlert, setSelectedAlert] = useState<string|null>(null);
  const { data: alerts = [], isFetching } = useGetAllAlertsQuery();
  const [markAllAsRead, { isSuccess }] = useMarkAllAsReadMutation();
  const [markAlertAsRead] = useMarkAlertAsReadMutation();
  const dispatch = useDispatch();

  useEffect(() => {
    if (isSuccess) {
      dispatch(markAllAsRead(alerts));
    }
  }, [isSuccess, dispatch, alerts]);

  const handleAlertPress = async (alert: Alert) => {
    if (alert.id) {
      setSelectedAlert(alert.id);
      if (!alert.readBy) {
        await markAlertAsRead({ alertId: alert.id });
      }
    }
  };

  // Call the mutation when the "Mark all as read" button is pressed
  const handleMarkAllAsRead = async () => {
    await markAllAsRead({alerts});
  };

  const renderItem = ({ item }: { item: Alert }) => (
    <Pressable onPress={() => handleAlertPress(item)}>
      <Text style={styles.alertText}>
        {selectedAlert === item.id ? item.message : `${item.message.substring(0, 10)}...`}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Pressable onPress={handleMarkAllAsRead}>
        <Text>Mark all as read</Text>
      </Pressable>
      <Text>Mark all as read</Text>
      {isFetching ? (
        <Text>Loading...</Text>
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderItem}
          keyExtractor={item => item.id || ''}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  alertText: {
    fontSize: 16,
    marginBottom: 10,
  },
});