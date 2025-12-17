import React, { useEffect, useRef } from "react"
import { NavigationContainer, getStateFromPath as getStateFromPathDefault } from "@react-navigation/native"
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
  const hasResetNavigationOnLogout = useRef(false)

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
  
  // When switching to UnauthStack (logout), explicitly reset navigation to Login screen
  // This ensures users aren't stuck on protected routes after logout
  // This needs to be a separate effect to run after the stack has switched
  useEffect(() => {
    if (!isLoggedIn) {
      // Reset the flag when user logs back in
      hasResetNavigationOnLogout.current = false
    }
  }, [isLoggedIn])
  
  useEffect(() => {
    if (!isLoggedIn && !hasResetNavigationOnLogout.current && navigationRef.isReady()) {
      // Mark that we're resetting to prevent multiple resets
      hasResetNavigationOnLogout.current = true
      
      // Use a timeout to ensure the stack has fully switched and rendered
      const timer = setTimeout(() => {
        if (navigationRef.isReady() && !isLoggedIn) {
          try {
            resetRoot({
              index: 0,
              routes: [{ name: "Login" as never }],
            })
            logger.debug("Navigation reset to Login after logout")
          } catch (error) {
            logger.warn("Failed to reset navigation after logout:", error)
            // Fallback: try navigating directly
            try {
              navigationRef.navigate("Login" as never)
            } catch (navError) {
              logger.warn("Failed to navigate to Login after logout:", navError)
            }
          }
        }
      }, 300)
      
      return () => clearTimeout(timer)
    }
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

  // When switching to UnauthStack, ensure navigation is reset to Login
  // The key prop on NavigationContainer forces a remount, but we also need to ensure
  // the navigation state is properly reset when the stack switches
  useEffect(() => {
    if (!isLoggedIn && navigationRef.isReady()) {
      // Wait for the stack to switch, then reset navigation to Login
      const timer = setTimeout(() => {
        if (navigationRef.isReady() && !isLoggedIn) {
          try {
            // Use resetRoot to ensure we're on Login screen
            resetRoot({
              index: 0,
              routes: [{ name: "Login" as never }],
            })
          } catch (error) {
            logger.warn("Failed to reset navigation after logout:", error)
          }
        }
      }, 200)
      
      return () => clearTimeout(timer)
    }
  }, [isLoggedIn])

  // Create a modified linking config that ignores protected routes when logged out
  // This prevents the URL from overriding our initialState
  const getLinkingConfig = () => {
    if (!isLoggedIn && linking) {
      // When logged out, create a linking config that only handles unauth routes
      // This prevents MainTabs URLs from being parsed
      return {
        ...linking,
        // Override getInitialURL to return null when logged out, forcing use of initialState
        getInitialURL: async () => {
          // Don't use the current URL when logged out - let initialState handle it
          return null
        },
        getStateFromPath: (path: string, options: any) => {
          // If path contains MainTabs or other protected routes, ignore it and return Login
          if (path.includes('MainTabs') || path.includes('/Home') || path.includes('/Profile') || path.includes('/Logout')) {
            return {
              routes: [{ name: "Login" as never }],
              index: 0,
            }
          }
          // Otherwise, use React Navigation's default getStateFromPath
          // Don't pass config in options - React Navigation will use the linking.config from the linking object
          try {
            // Just pass options without config - React Navigation uses linking.config automatically
            return getStateFromPathDefault(path, options)
          } catch (error) {
            // If getStateFromPath fails, return Login as fallback
            logger.warn("getStateFromPath failed, returning Login:", error)
            return {
              routes: [{ name: "Login" as never }],
              index: 0,
            }
          }
        },
      }
    }
    return linking
  }

  return (
    <NavigationContainer
      key={isLoggedIn ? 'auth' : 'unauth'} // Force remount when switching stacks to ensure clean state
      ref={navigationRef}
      theme={navigationTheme}
      linking={getLinkingConfig()}
      initialState={!isLoggedIn ? { routes: [{ name: "Login" as never }], index: 0 } : (initialState || navigationPersistenceProps.initialState)}
      onStateChange={onStateChange || navigationPersistenceProps.onStateChange}
      {...otherProps}
    >
      {isLoggedIn ? <AuthStack /> : <UnauthStack />}
    </NavigationContainer>
  )
}
