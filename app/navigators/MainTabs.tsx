import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { HomeScreen, CaregiverScreen, AlertScreen, PatientScreen, SchedulesScreen } from 'app/screens';
import { MainTabsParamList } from './navigationTypes';

const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Patient" component={PatientScreen} />
      <Stack.Screen name="Schedule" component={SchedulesScreen} />
    </Stack.Navigator>
  );
}


const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator initialRouteName="HomeTab" screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={HomeStack} />
      <Tab.Screen name="Caregiver" component={CaregiverScreen} />
      <Tab.Screen name="Alert" component={AlertScreen} />
    </Tab.Navigator>
  );
}
