import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { HomeScreen, CaregiverScreen, AlertScreen, PatientScreen, SchedulesScreen } from 'app/screens';
import { MainTabsParamList } from './navigationTypes';

const PStack = createStackNavigator();

function PatientStack() {
  return (
    <PStack.Navigator screenOptions={{ headerShown: false }}>
      <PStack.Screen name="PatientScreen" component={PatientScreen} />
      <PStack.Screen name="ScheduleScreen" component={SchedulesScreen} />
    </PStack.Navigator>
  );
}

const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
      <Stack.Screen name="PatientScreen" component={PatientStack} />
    </Stack.Navigator>
  );
}


const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator initialRouteName="HomeScreen" screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeScreen" component={HomeStack} />
      <Tab.Screen name="CaregiverScreen" component={CaregiverScreen} />
      <Tab.Screen name="AlertScreen" component={AlertScreen} />
    </Tab.Navigator>
  );
}
