import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import { isAuthenticated } from 'app/store/authSlice';
import { navigationRef, useBackButtonHandler, useNavigationPersistence } from './navigationUtilities';
import { AuthStack, UnauthStack } from './AppNavigators';
import { navigationThemes } from './NavigationConfig';
import { NavigationProps } from './navigationTypes';
import * as storage from '../utils/storage'; // Ensure this import is correct

export const AppNavigator: React.FC<NavigationProps> = () => {
  const isLoggedIn = useSelector(isAuthenticated);
  const colorScheme = useColorScheme();

  // Define back button behavior
  useBackButtonHandler((routeName) => {
    return true; //['Home', 'Login'].includes(routeName); // Example routes where pressing back should exit the app
  });

  // Navigation state persistence setup
  const navigationPersistenceKey = 'navigationState';
  let navigationPersistenceProps = {};
  if (__DEV__) {
    const { initialNavigationState, onNavigationStateChange } = useNavigationPersistence(storage, navigationPersistenceKey);
    navigationPersistenceProps = { initialState: initialNavigationState, onStateChange: onNavigationStateChange };
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationThemes[colorScheme === 'dark' ? 'dark' : 'light']}
      {...navigationPersistenceProps}
    >
      {isLoggedIn ? <AuthStack /> : <UnauthStack />}
    </NavigationContainer>
  );
};
