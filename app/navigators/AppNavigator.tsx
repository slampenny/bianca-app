import React, { useEffect } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { isAuthenticated, getCurrentUser, getInviteToken } from "app/store/authSlice"
import { useTheme } from "app/theme/ThemeContext"
import {
  navigationRef,
  useBackButtonHandler,
  useNavigationPersistence,
} from "./navigationUtilities"
import { AuthStack, UnauthStack } from "./AppNavigators"
import { getNavigationTheme } from "./NavigationConfig"
import { NavigationProps } from "./navigationTypes"
import * as storage from "../utils/storage" // Ensure this import is correct

export const AppNavigator: React.FC<NavigationProps> = (props) => {
  const { linking, initialState, onStateChange, ...otherProps } = props
  const isLoggedIn = useSelector(isAuthenticated)
  const currentUser = useSelector(getCurrentUser)
  const inviteToken = useSelector(getInviteToken)
  const { currentTheme, colors } = useTheme()

  // Define back button behavior
  useBackButtonHandler((routeName) => {
    return true // ['Home', 'Login'].includes(routeName); // Example routes where pressing back should exit the app
  })

  // Clear navigation state when logging in/out to ensure we start at the correct screen
  // Also clear in test mode
  const isTestMode = process.env.NODE_ENV === 'test' || 
                     process.env.PLAYWRIGHT_TEST === '1' || 
                     process.env.JEST_WORKER_ID
  
  useEffect(() => {
    if (__DEV__ || isTestMode) {
      storage.remove("navigationState")
    }
  }, [isLoggedIn, isTestMode])

  // Redirect unverified users to profile screen
  useEffect(() => {
    if (isLoggedIn && currentUser && currentUser.role === 'unverified') {
      // Navigate to profile screen to complete setup
      if (navigationRef.isReady()) {
        navigationRef.navigate('Profile')
      }
    }
  }, [isLoggedIn, currentUser])

  // Redirect invited users to signup screen
  useEffect(() => {
    if (!isLoggedIn && inviteToken && navigationRef.isReady()) {
      // User has an invite token but isn't logged in, redirect to signup
      navigationRef.navigate('Signup', { token: inviteToken })
    }
  }, [isLoggedIn, inviteToken])

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

  // Get navigation theme based on current app theme
  const navigationTheme = getNavigationTheme(currentTheme, colors)

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={linking}
      initialState={initialState || navigationPersistenceProps.initialState}
      onStateChange={onStateChange || navigationPersistenceProps.onStateChange}
      {...otherProps}
    >
      {isLoggedIn ? <AuthStack /> : <UnauthStack />}
    </NavigationContainer>
  )
}
