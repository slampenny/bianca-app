import { useSelector } from 'react-redux';
import React, { useEffect, useState } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigation
} from "@react-navigation/native"
import { LoadingScreen, LoginScreen } from "app/screens"
import MainTabsWithDrawer from "./MainTabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { useColorScheme } from "react-native"
import Config from "../config"
import { navigationRef, useBackButtonHandler, resetRoot } from "./navigationUtilities"
import { colors } from "app/theme"
import { isAuthenticated } from '../store/authSlice';

export type AppStackParamList = {
  LoadingScreen: undefined
  Login: undefined
  MainTabsWithDrawer: undefined
}

const exitRoutes = Config.exitRoutes

const Stack = createNativeStackNavigator<AppStackParamList>()

export interface NavigationProps
  extends Partial<React.ComponentProps<typeof NavigationContainer>> {}

  const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabsWithDrawer" component={MainTabsWithDrawer} />
    </Stack.Navigator>
  );
  
  const UnauthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
  
  const AppStack = () => {
    const loggedIn = useSelector(isAuthenticated);
  
    return loggedIn ? <AuthStack /> : <UnauthStack />;
  };
  
  export const AppNavigator = (props: NavigationProps) => {
    const colorScheme = useColorScheme()
  
    useBackButtonHandler((routeName) => exitRoutes.includes(routeName))
  
    return (
      <NavigationContainer
        ref={navigationRef}
        theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        {...props}
      >
        <AppStack />
      </NavigationContainer>
    )
  }