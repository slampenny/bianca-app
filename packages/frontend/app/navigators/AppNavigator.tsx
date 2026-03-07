import React, { useEffect, useRef } from "react"
import { NavigationContainer, getStateFromPath as getStateFromPathDefault } from "@react-navigation/native"
import { useSelector, useDispatch } from "react-redux"
import { isAuthenticated, getCurrentUser, getInviteToken, getPendingOnboarding } from "app/store/authSlice"
import { clearAuth } from "app/store/authSlice"
import { clearOrg } from "app/store/orgSlice"
import { getOrg } from "app/store/orgSlice"
import { useTheme } from "app/theme/ThemeContext"
import {
  navigationRef,
  useBackButtonHandler,
  useNavigationPersistence,
  resetRoot,
  getActiveRouteName,
} from "./navigationUtilities"
import { AuthStack, UnauthStack, OnboardingStackNavigator } from "./AppNavigators"
import { getNavigationTheme } from "./NavigationConfig"
import { NavigationProps } from "./navigationTypes"
import * as storage from "../utils/storage"
import { logger } from "../utils/logger"

export const AppNavigator: React.FC<NavigationProps> = (props) => {
  const { linking, initialState, onStateChange, ...otherProps } = props
  const dispatch = useDispatch()
  const isLoggedIn = useSelector(isAuthenticated)
  const currentUser = useSelector(getCurrentUser)
  const inviteToken = useSelector(getInviteToken)
  const pendingOnboarding = useSelector(getPendingOnboarding)
  const currentOrg = useSelector(getOrg)
  const { currentTheme, colors } = useTheme()
  const shouldNavigateToRegister = useRef(false)
  const hasResetNavigationOnLogout = useRef(false)
  const previousIsLoggedIn = useRef(isLoggedIn)
  
  // Calculate justLoggedOut once at the top level (used in multiple places)
  const justLoggedOut = previousIsLoggedIn.current && !isLoggedIn

  // Define back button behavior
  useBackButtonHandler((routeName) => {
    return true
  })

  // Clear navigation state when logging in/out to ensure we start at the correct screen
  useEffect(() => {
    storage.remove("navigationState").catch(() => {
      // Ignore errors if storage is not available
    })
  }, [isLoggedIn])
  
  useEffect(() => {
    if (!isLoggedIn) {
      hasResetNavigationOnLogout.current = false
    }
  }, [isLoggedIn])

  // Reset navigation when user logs out
  useEffect(() => {
    if (justLoggedOut && !hasResetNavigationOnLogout.current) {
          // Check if we're on a route that should be accessible when logged out (web only)
          const isUnauthRoute = typeof window !== 'undefined' && 
            (window.location.pathname.includes('reset-password') || 
             window.location.pathname.includes('signup') || 
             window.location.pathname.includes('client/consent'))
      
      // Only reset navigation if we're NOT on an unauth route
      if (!isUnauthRoute) {
        hasResetNavigationOnLogout.current = true
        
        // Wait for NavigationContainer to remount with UnauthStack
        // The initialState should already be set to Login, but we'll also call resetRoot
        // to ensure navigation is properly reset
        let attempts = 0
        const maxAttempts = 30 // Try for up to 3 seconds (30 * 100ms)
        const resetNavigation = () => {
          if (!isLoggedIn && attempts < maxAttempts) {
            attempts++
            if (navigationRef.isReady()) {
              try {
                // Use resetRoot to ensure we're on Login screen
                // The format should match the UnauthStack structure
                resetRoot({
                  index: 0,
                  routes: [{ name: "Login" as never }],
                })
                logger.debug(`Navigation reset to Login after logout (attempt ${attempts})`)
              } catch (error) {
                logger.warn(`Failed to reset navigation after logout (attempt ${attempts}):`, error)
                // Retry after a delay
                setTimeout(resetNavigation, 100)
              }
            } else {
              // Navigation not ready yet, try again
              setTimeout(resetNavigation, 100)
            }
          } else if (attempts >= maxAttempts) {
            logger.warn("Failed to reset navigation after logout: max attempts reached")
          }
        }
        
        // Start resetting after NavigationContainer has had time to remount
        // Use a longer delay to ensure NavigationContainer and UnauthStack are fully ready
        // Also force a re-render by updating the key
        setTimeout(resetNavigation, 500)
      }
    }
    
    previousIsLoggedIn.current = isLoggedIn
  }, [isLoggedIn, justLoggedOut])

  // Redirect users without org to registration screen
  useEffect(() => {
    if (isLoggedIn && currentUser && !currentOrg) {
      logger.warn('[AppNavigator] User logged in but has no org - logging out and redirecting to registration', {
        userId: currentUser.id,
        userEmail: currentUser.email
      })
      
      shouldNavigateToRegister.current = true
      dispatch(clearAuth())
      dispatch(clearOrg())
    } else if (isLoggedIn && currentOrg) {
      shouldNavigateToRegister.current = false
    }
  }, [isLoggedIn, currentUser, currentOrg, dispatch])
  
  // Navigate into onboarding (not Register form) when user is logged out and was previously missing org
  useEffect(() => {
    if (!isLoggedIn && shouldNavigateToRegister.current && navigationRef.isReady()) {
      shouldNavigateToRegister.current = false
      
      const timer = setTimeout(() => {
        if (navigationRef.isReady()) {
          resetRoot({
            index: 0,
            routes: [{ name: "OnboardingAboutYou" as never }],
          })
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [isLoggedIn])

  // Redirect users with incomplete profiles to profile screen (only after onboarding is complete)
  useEffect(() => {
    const hasMissingPhone = !currentUser?.phone || (typeof currentUser.phone === 'string' && currentUser.phone.trim() === '')
    const onboardingComplete = currentUser?.onboardingComplete !== false
    if (isLoggedIn && currentUser && currentOrg && onboardingComplete && (!currentUser.isEmailVerified || hasMissingPhone)) {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Profile')
      }
    }
  }, [isLoggedIn, currentUser, currentOrg])

  // Redirect invited users to signup screen
  useEffect(() => {
    if (!isLoggedIn && inviteToken && navigationRef.isReady()) {
      (navigationRef.navigate as (name: string, params?: object) => void)('Signup', { token: inviteToken })
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

  const navigationTheme = getNavigationTheme(currentTheme, colors)

  // Create a modified linking config that handles logout properly
  const getLinkingConfig = () => {
    if (!isLoggedIn && linking) {
      return {
        ...linking,
        // Override getInitialURL to return null when logged out on protected routes
        // This forces React Navigation to use initialState instead of the URL
        // CRITICAL: This must return null synchronously for protected routes to prevent URL reading
        getInitialURL: async () => {
          // On web, check if we're on reset-password or signup (these should work when logged out)
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname
            const currentSearch = window.location.search
            const fullPath = currentPath + currentSearch
            
            // Allow reset-password, signup, and verify-email URLs
            if (fullPath.includes('reset-password') || fullPath.includes('signup') || fullPath.includes('auth/verify-email')) {
              return window.location.href
            }
            
            // For protected routes when logged out, ALWAYS return null to force use of initialState
            // This is critical - React Navigation will use initialState when getInitialURL returns null
            if (currentPath.includes('MainTabs') || currentPath.includes('/Home') || 
                currentPath.includes('/Profile') || currentPath.includes('/Logout') ||
                currentPath.startsWith('/MainTabs')) {
              // Return null immediately - don't let React Navigation read the URL
              return null
            }
          }
          // For all other routes when logged out, return null to force use of initialState
          return null
        },
        getStateFromPath: (path: string, options: any) => {
          // Allow reset-password, signup, and client consent routes even when logged out
          if (path.includes('reset-password') || path.includes('signup') || path.includes('client/consent')) {
            try {
              return getStateFromPathDefault(path, options)
            } catch (error) {
              logger.warn("getStateFromPath failed for reset-password/signup/client-consent:", error)
              return undefined
            }
          }
          // If path contains MainTabs or other protected routes, return Login state
          // This prevents React Navigation from trying to navigate to protected routes when logged out
          if (path.includes('MainTabs') || path.includes('/Home') || 
              path.includes('/Profile') || path.includes('/Logout') ||
              path.startsWith('/MainTabs')) {
            logger.debug(`getStateFromPath: Blocking protected route ${path}, returning Login state`)
            return {
              routes: [{ name: "Login" as never }],
              index: 0,
            }
          }
          // Otherwise, use React Navigation's default getStateFromPath
          try {
            return getStateFromPathDefault(path, options)
          } catch (error) {
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

  const linkingConfig = getLinkingConfig()
  
  // Determine if we should disable linking when logged out on a protected route
  // When linking is disabled, React Navigation will use initialState instead of reading the URL
  // We disable linking when:
  // 1. User is logged out
  // 2. We're on web
  // 3. We're on a protected route (not reset-password, signup, or verify-email)
  // CRITICAL: We must check this synchronously during render, before NavigationContainer reads the URL
  const shouldDisableLinking = !isLoggedIn && typeof window !== 'undefined' &&
    (() => {
      const currentPath = window.location.pathname
      // Disable linking if we're on a protected route (unless it's reset-password, signup, or verify-email)
      const isProtectedRoute = currentPath.includes('MainTabs') || 
                               currentPath.includes('/Home') || 
                               currentPath.includes('/Profile') || 
                               currentPath.includes('/Logout') ||
                               currentPath.startsWith('/MainTabs')
      const isUnauthRoute = currentPath.includes('reset-password') || 
                            currentPath.includes('signup') ||
                            currentPath.includes('auth/verify-email')
      return isProtectedRoute && !isUnauthRoute
    })()
  
  // Determine initial state - allow reset-password, signup, and verify-email routes when logged out
  // This must be called AFTER shouldDisableLinking is calculated
  const getInitialState = () => {
    if (isLoggedIn) {
      return initialState || navigationPersistenceProps.initialState
    }
    
    // When logged out, check if we're on reset-password, signup, or verify-email (web only)
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      const currentSearch = window.location.search
      const fullPath = currentPath + currentSearch
      
      if (fullPath.includes('reset-password')) {
        // Return undefined to let linking handle reset-password route
        return undefined
      }
      if (fullPath.includes('signup')) {
        // Return undefined to let linking handle signup route
        return undefined
      }
      if (fullPath.includes('auth/verify-email')) {
        // Return undefined to let linking handle verify-email route
        return undefined
      }
      
      // If we're on a protected route when logged out, force Login state
      // This ensures we don't try to navigate to protected routes
      if (currentPath.includes('MainTabs') || currentPath.includes('/Home') || 
          currentPath.includes('/Profile') || currentPath.includes('/Logout')) {
        return { routes: [{ name: "Login" as never }], index: 0 }
      }
    }
    
    // Default to Login for all other cases (including after logout)
    return { routes: [{ name: "Login" as never }], index: 0 }
  }

  // Custom onStateChange handler
  const handleStateChange = (state: any) => {
    if (onStateChange) {
      onStateChange(state)
    }
    if (navigationPersistenceProps.onStateChange) {
      navigationPersistenceProps.onStateChange(state)
    }
  }

  const computedInitialState = getInitialState()
  
  // When linking is disabled, we MUST provide initialState
  // React Navigation will use initialState when linking is undefined
  // CRITICAL: When logged out on a protected route, we MUST disable linking and provide initialState
  // to prevent React Navigation from reading the URL
  const finalLinking = shouldDisableLinking ? undefined : linkingConfig
  // Always provide initialState when linking is disabled to ensure it's used
  // When just logged out, force Login screen regardless of computedInitialState
  const finalInitialState = shouldDisableLinking 
    ? (justLoggedOut 
        ? { routes: [{ name: "Login" as never }], index: 0 }  // Force Login when just logged out
        : (computedInitialState || { routes: [{ name: "Login" as never }], index: 0 }))
    : (computedInitialState || undefined)
  
  // Log for debugging
  if (justLoggedOut && typeof window !== 'undefined') {
    logger.debug(`Logout: shouldDisableLinking=${shouldDisableLinking}, currentPath=${window.location.pathname}, finalLinking=${finalLinking ? 'enabled' : 'disabled'}, finalInitialState=${JSON.stringify(finalInitialState)}`)
  }

  // Force a remount when logging out to ensure UnauthStack starts fresh
  // Use justLoggedOut in the key to force a remount when logout happens
  const containerKey = isLoggedIn ? 'auth' : (justLoggedOut ? `unauth-${Date.now()}` : 'unauth')
  
  return (
    <NavigationContainer
      key={containerKey}
      ref={navigationRef}
      theme={navigationTheme}
      linking={finalLinking}
      initialState={finalInitialState}
      onStateChange={handleStateChange}
      {...otherProps}
    >
      {isLoggedIn ? (
        currentUser && currentUser.onboardingComplete === false && pendingOnboarding ? (
          <OnboardingStackNavigator />
        ) : (
          <AuthStack />
        )
      ) : (
        <UnauthStack />
      )}
    </NavigationContainer>
  )
}
