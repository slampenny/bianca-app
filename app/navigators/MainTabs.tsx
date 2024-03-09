import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { HomeScreen } from 'app/screens/HomeScreen';
import { UserScreen } from 'app/screens/UserScreen';
import { CaregiverScreen, LogoutScreen, PaymentInfoScreen } from 'app/screens';
import { useSelector } from 'react-redux';
import { isAuthenticated } from 'app/store/authSlice';

// Define a type for your MainTabs navigator
export type MainTabsParamList = {
  HomeScreen: undefined;
  UserScreen: undefined; // or { userId: string } if UserScreen expects a userId parameter
  CaregiverScreen: undefined;
  // other routes...
};

const Tab = createBottomTabNavigator<MainTabsParamList>();
const Drawer = createDrawerNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator initialRouteName="HomeScreen" screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeScreen" component={HomeScreen} />
      <Tab.Screen name="CaregiverScreen" component={CaregiverScreen} />
    </Tab.Navigator>
  );
}

export default function MainTabsWithDrawer() {
  const loggedIn = useSelector(isAuthenticated);

  if (!loggedIn) {
    // User is not authenticated, do not render the actual content
    return null; // or return some placeholder component
  }

  return (
    <Drawer.Navigator initialRouteName="Home">
      <Drawer.Screen name="Home" component={MainTabs} />
      <Drawer.Screen name="Caregiver" component={CaregiverScreen} />
      <Drawer.Screen name="Payment" component={PaymentInfoScreen} />
      <Drawer.Screen name="Logout" component={LogoutScreen} />
    </Drawer.Navigator>
  );
}