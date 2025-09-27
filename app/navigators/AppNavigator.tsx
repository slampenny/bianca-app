import React, { useEffect } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { useColorScheme } from "react-native"
import { useSelector } from "react-redux"
import { isAuthenticated, getCurrentUser } from "app/store/authSlice"
import {
  navigationRef,
  useBackButtonHandler,
  useNavigationPersistence,
} from "./navigationUtilities"
import { AuthStack, UnauthStack } from "./AppNavigators"
import { navigationThemes } from "./NavigationConfig"
import { NavigationProps } from "./navigationTypes"
import * as storage from "../utils/storage" // Ensure this import is correct

export const AppNavigator: React.FC<NavigationProps> = (props) => {
  const { linking, initialState, onStateChange, ...otherProps } = props
  const isLoggedIn = useSelector(isAuthenticated)
  const currentUser = useSelector(getCurrentUser)
  const colorScheme = useColorScheme()

  // Define back button behavior
  useBackButtonHandler((routeName) => {
    return true // ['Home', 'Login'].includes(routeName); // Example routes where pressing back should exit the app
  })

  // Clear navigation state when logging in/out to ensure we start at the correct screen
  useEffect(() => {
    if (__DEV__) {
      storage.remove("navigationState")
    }
  }, [isLoggedIn])

  // Redirect unverified users to profile screen
  useEffect(() => {
    if (isLoggedIn && currentUser && currentUser.role === 'unverified') {
      // Navigate to profile screen to complete setup
      if (navigationRef.isReady()) {
        navigationRef.navigate('Profile')
      }
    }
  }, [isLoggedIn, currentUser])

  // Navigation state persistence setup
  const navigationPersistenceKey = "navigationState"
  let navigationPersistenceProps: { initialState?: any; onStateChange?: any } = {}
  if (__DEV__) {
    const { initialNavigationState, onNavigationStateChange } = useNavigationPersistence(
      storage,
      navigationPersistenceKey,
    )
    navigationPersistenceProps = {
      initialState: initialNavigationState,
      onStateChange: onNavigationStateChange,
    }
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationThemes[colorScheme === "dark" ? "dark" : "light"]}
      linking={linking}
      initialState={initialState || navigationPersistenceProps.initialState}
      onStateChange={onStateChange || navigationPersistenceProps.onStateChange}
      {...otherProps}
    >
      {isLoggedIn ? <AuthStack /> : <UnauthStack />}
    </NavigationContainer>
  )
}
