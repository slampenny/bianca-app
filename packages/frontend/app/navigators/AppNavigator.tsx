import React, { useEffect, useRef } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { useSelector, useDispatch } from "react-redux"
import { isAuthenticated, getCurrentUser, getInviteToken } from "app/store/authSlice"
import { clearAuth } from "app/store/authSlice"
import { clearOrg } from "app/store/orgSlice"
import { getOrg } from "app/store/orgSlice"
import { useTheme } from "app/theme/ThemeContext"
import {
  navigationRef,
  useBackButtonHandler,
  useNavigationPersistence,
  resetRoot,
} from "./navigationUtilities"
import { AuthStack, UnauthStack } from "./AppNavigators"
import { getNavigationTheme } from "./NavigationConfig"
import { NavigationProps } from "./navigationTypes"
import * as storage from "../utils/storage" // Ensure this import is correct
import { logger } from "../utils/logger"

export const AppNavigator: React.FC<NavigationProps> = (props) => {
  const { linking, initialState, onStateChange, ...otherProps } = props
  const dispatch = useDispatch()
  const isLoggedIn = useSelector(isAuthenticated)
  const currentUser = useSelector(getCurrentUser)
  const inviteToken = useSelector(getInviteToken)
  const currentOrg = useSelector(getOrg)
  const { currentTheme, colors } = useTheme()
  const shouldNavigateToRegister = useRef(false)

  // Define back button behavior
  useBackButtonHandler((routeName) => {
    return true // ['Home', 'Login'].includes(routeName); // Example routes where pressing back should exit the app
  })

  // Clear navigation state when logging in/out to ensure we start at the correct screen
  // This prevents corrupted navigation state from causing crashes
  useEffect(() => {
    // Always clear navigation state on login/logout to prevent [object Object] errors
    storage.remove("navigationState").catch(() => {
      // Ignore errors if storage is not available
    })
  }, [isLoggedIn])

  // Redirect users without org to registration screen
  // If user doesn't have an org, they need to complete registration
  // Since Register is in UnauthStack, we need to log them out first
  useEffect(() => {
    if (isLoggedIn && currentUser && !currentOrg) {
      // User is logged in but has no org - this shouldn't happen with SSO
      // (SSO should create org automatically), but if it does, log them out and send to registration
      logger.warn('[AppNavigator] User logged in but has no org - logging out and redirecting to registration', {
        userId: currentUser.id,
        userEmail: currentUser.email
      })
      
      // Set flag to navigate to Register after logout
      shouldNavigateToRegister.current = true
      
      // Clear auth state (this will switch to UnauthStack)
      dispatch(clearAuth())
      dispatch(clearOrg())
    } else if (isLoggedIn && currentOrg) {
      // User has org, clear the flag
      shouldNavigateToRegister.current = false
    }
  }, [isLoggedIn, currentUser, currentOrg, dispatch])
  
  // Navigate to Register when user is logged out and was previously missing org
  useEffect(() => {
    if (!isLoggedIn && shouldNavigateToRegister.current && navigationRef.isReady()) {
      // Reset flag
      shouldNavigateToRegister.current = false
      
      // Navigate to Register screen
      const timer = setTimeout(() => {
        if (navigationRef.isReady()) {
          resetRoot({
            index: 0,
            routes: [{ name: "Register" as never }],
          })
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [isLoggedIn])

  // Redirect users with incomplete profiles to profile screen
  // Profile is incomplete if email is not verified OR phone is missing
  // Users can continue with unverified phone number
  // Only check this if user has an org (otherwise they go to registration above)
  useEffect(() => {
    const hasMissingPhone = !currentUser?.phone || (typeof currentUser.phone === 'string' && currentUser.phone.trim() === '')
    if (isLoggedIn && currentUser && currentOrg && (!currentUser.isEmailVerified || hasMissingPhone)) {
      // Navigate to profile screen to complete setup
      if (navigationRef.isReady()) {
        navigationRef.navigate('Profile')
      }
    }
  }, [isLoggedIn, currentUser, currentOrg])

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
