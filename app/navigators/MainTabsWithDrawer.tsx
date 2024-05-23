import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { MainTabs } from './MainTabs';
import { LogoutScreen, PaymentInfoScreen, RegisterScreen, ForgotPasswordScreen } from 'app/screens';
import { useSelector } from 'react-redux';
import { DrawerParamList } from './navigationTypes';
import { isAuthenticated } from 'app/store/authSlice';

const Drawer = createDrawerNavigator<DrawerParamList>();

export default function MainTabsWithDrawer() {
  const isLoggedIn = useSelector(isAuthenticated);

  if (!isLoggedIn) {
    // If the user is not authenticated, render nothing or a placeholder
    return null;
  }

  return (
    <Drawer.Navigator initialRouteName="Home">
      <Drawer.Screen name="Home" component={MainTabs} />
      <Drawer.Screen name="Payment" component={PaymentInfoScreen} />
      <Drawer.Screen name="Logout" component={LogoutScreen} />
    </Drawer.Navigator>
  );
}
