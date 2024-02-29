import React from 'react';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { HomeScreen } from 'app/screens/HomeScreen';
import { UserScreen } from 'app/screens/UserScreen';
import { CaregiverScreen, LogoutScreen, PaymentInfoScreen } from 'app/screens';

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
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeScreen" component={HomeScreen} />
      <Tab.Screen name="CaregiverScreen" component={CaregiverScreen} />
      <Tab.Screen name="UserScreen" component={UserScreen}/>
    </Tab.Navigator>
  );
}

export default function MainTabsWithDrawer() {
  return (
    <Drawer.Navigator initialRouteName="MainTabs">
      <Drawer.Screen name="MainTabs" 
        component={MainTabs} 
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'HomeScreen';
          return { headerTitle: routeName };
        }} 
      />
      <Drawer.Screen name="CaregiverInfo" component={CaregiverScreen} />
      <Drawer.Screen name="PaymentInfo" component={PaymentInfoScreen} />
      <Drawer.Screen name="Logout" component={LogoutScreen} />
    </Drawer.Navigator>
  );
}