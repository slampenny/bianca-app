import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen, CaregiverScreen, AlertScreen } from 'app/screens';
import { MainTabsParamList } from './navigationTypes';

const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator initialRouteName="HomeScreen" screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeScreen" component={HomeScreen} />
      <Tab.Screen name="CaregiverScreen" component={CaregiverScreen} />
      <Tab.Screen name="AlertScreen" component={AlertScreen} />
    </Tab.Navigator>
  );
}
