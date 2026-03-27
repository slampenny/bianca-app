/* eslint-disable import/first */
/**
 * Welcome to the main entry point of the app. In this file, we'll
 * be kicking off our app.
 *
 * Most of this file is boilerplate and you shouldn't need to modify
 * it very often. But take some time to look through and understand
 * what is going on here.
 *
 * The app navigation resides in ./app/navigators, so head over there
 * if you're interested in adding screens and navigators.
 */
if (__DEV__) {
  // Load Reactotron configuration in development. We don't want to
  // include this in our production bundle, so we are using `if (__DEV__)`
  // to only execute this in development.
  require("./devtools/ReactotronConfig.ts")
}
import "./i18n"
import "./utils/ignoreWarnings"
import { useFonts } from "expo-font"
import React from "react"
import { Provider } from "react-redux"
import { persistor, store } from "./store/store"
import { PersistGate } from "redux-persist/integration/react"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"
import * as Linking from "expo-linking"
import { AppNavigator, useNavigationPersistence } from "./navigators"
import { ErrorBoundary } from "./screens/ErrorScreen/ErrorBoundary"
import * as storage from "./utils/storage"
import { customFontsToLoad } from "./theme"
import { ThemeProvider } from "./theme/ThemeContext"
import Config from "./config"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { ViewStyle, Platform, View } from "react-native"
import useRefreshToken from "./effects/useRefreshToken"
import { useAlertRealtime } from "./effects/useAlertRealtime"
import { SSOCallbackGate } from "./components/SSOCallbackGate"
import { useLanguage } from "./hooks/useLanguage"
import { AuthModalProvider } from "./contexts/AuthModalContext"
import { useSelector } from "react-redux"
import { getCurrentUser } from "./store/authSlice"
import { useTheme } from "./theme/ThemeContext"

export const NAVIGATION_PERSISTENCE_KEY = "NAVIGATION_STATE"

const HAS_CUSTOM_FONTS_TO_LOAD = Object.keys(customFontsToLoad).length > 0

// Web linking configuration
const prefix = Linking.createURL("/")
const config = {
  screens: {
    Login: {
      path: "",
    },
    MainTabs: "MainTabs",
    EmailVerified: "email-verified",
    VerifyEmail: {
      path: "auth/verify-email",
      exact: true,
    },
    Signup: "signup",
    ConfirmReset: "reset-password",
    ClientConsent: {
      path: "client/consent/:token?",
      parse: {
        token: (value: string) => value || undefined,
      },
    },
  },
}

interface AppProps {
  hideSplashScreen: () => Promise<boolean>
}

function InnerApp() {
  useRefreshToken()
  useLanguage()
  useAlertRealtime()

  return null
}

/**
 * Theme-aware container wrapper that applies theme colors for web mode
 * This component applies the background to fill the viewport and styles the inner container
 */
function ThemedWebContainer({ children }: { children: React.ReactNode }) {
  const { colors, currentTheme } = useTheme()
  const isDark = currentTheme === "dark"
  
  // On web, inject styles to set background on body and html to fill the viewport
  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const outerBgColor = isDark ? colors.palette.neutral200 : '#f5f5f5'
      const styleId = 'themed-outer-container-bg'
      let styleElement = document.getElementById(styleId)
      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = styleId
        document.head.appendChild(styleElement)
      }
      // Set background on html and body to fill the entire viewport
      styleElement.textContent = `
        html, body {
          background-color: ${outerBgColor} !important;
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
        }
        #root {
          background-color: ${outerBgColor} !important;
          min-height: 100vh;
        }
      `
      
      return () => {
        // Cleanup on unmount
        const element = document.getElementById(styleId)
        if (element) {
          element.remove()
        }
      }
    }
  }, [colors.palette.neutral200, isDark])
  
  const $themedInnerStyle: ViewStyle = {
    flex: 1,
    ...(Platform.OS === 'web' && {
      maxWidth: 1200,
      width: '100%',
      alignSelf: 'center',
      marginHorizontal: 'auto',
      backgroundColor: (colors.palette as any).biancaBackground || colors.background || (isDark ? colors.palette.neutral100 : '#ffffff'),
      minHeight: '100vh',
      boxShadow: isDark 
        ? '0 0 20px rgba(0, 0, 0, 0.5)' 
        : '0 0 20px rgba(0, 0, 0, 0.1)',
    } as any),
  }
  
  return <View style={$themedInnerStyle}>{children}</View>
}

/**
 * Loads custom fonts when configured. Skipped entirely when `customFontsToLoad` is empty so web does not
 * run expo-font / FontFaceObserver (avoids 6000ms timeout uncaught rejections with no real fonts to load).
 */
function AppWithFontLoading(props: AppProps & { isNavigationStateRestored: boolean; initialNavigationState: any; onNavigationStateChange: (state: any) => void }) {
  const [fontsLoaded, fontError] = useFonts(customFontsToLoad)

  React.useEffect(() => {
    if (fontError) {
      console.warn("[App] Custom fonts failed to load; continuing with system fallbacks.", fontError)
    }
  }, [fontError])

  // Expo pattern: only block while loading; on error, render anyway (see expo-font / useFonts docs).
  const fontsBlocking = !fontsLoaded && !fontError

  return <AppShell {...props} fontsBlocking={fontsBlocking} />
}

type AppShellProps = AppProps & {
  isNavigationStateRestored: boolean
  initialNavigationState: any
  onNavigationStateChange: (state: any) => void
  fontsBlocking: boolean
}

/**
 * This is the root component of our app.
 * @param {AppProps} props - The props for the `App` component.
 * @returns {JSX.Element} The rendered `App` component.
 */
function App(props: AppProps) {
  const { hideSplashScreen } = props
  const {
    initialNavigationState,
    onNavigationStateChange,
    isRestored: isNavigationStateRestored,
  } = useNavigationPersistence(storage, NAVIGATION_PERSISTENCE_KEY)

  const persistenceProps = {
    isNavigationStateRestored,
    initialNavigationState,
    onNavigationStateChange,
  }

  if (HAS_CUSTOM_FONTS_TO_LOAD) {
    return <AppWithFontLoading {...props} {...persistenceProps} />
  }

  return <AppShell {...props} {...persistenceProps} fontsBlocking={false} />
}

function AppShell(props: AppShellProps) {
  const { hideSplashScreen, isNavigationStateRestored, fontsBlocking } = props

  const onBeforeLiftPersistGate = () => {
    // Expose store on window after rehydration for testing (web only)
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        (window as any).__REDUX_STORE__ = store
        // Only expose as __REDUX_STORE__ to avoid conflicts with window.store
        console.log('[APP] Redux store exposed on window after rehydration')
      }
    } catch (e) {
      // Ignore errors when exposing store on window
    }
    // If your initialization scripts run very fast, it's good to show the splash screen for just a bit longer to prevent flicker.
    // Slightly delaying splash screen hiding for better UX; can be customized or removed as needed,
    // Note: (vanilla Android) The splash-screen will not appear if you launch your app via the terminal or Android Studio. Kill the app and launch it normally by tapping on the launcher icon. https://stackoverflow.com/a/69831106
    // Note: (vanilla iOS) You might notice the splash-screen logo change size. This happens in debug/development mode. Try building the app for release.
    setTimeout(hideSplashScreen, 500)
  }

  React.useEffect(() => {
    setTimeout(hideSplashScreen, 500)
  }, [])

  // Before we show the app, we have to wait for our state to be ready.
  // In the meantime, don't render anything. This will be the background
  // color set in native by rootView's background color.
  // In iOS: application:didFinishLaunchingWithOptions:
  // In Android: https://stackoverflow.com/a/45838109/204044
  // You can replace with your own loading component if you wish.
  if (!isNavigationStateRestored || fontsBlocking) return null

  const linking = {
    prefixes: [prefix],
    config,
  }

  const { initialNavigationState, onNavigationStateChange } = props

  // otherwise, we're ready to render the app
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ErrorBoundary catchErrors={Config.catchErrors}>
        <View style={$outerContainer}>
          <GestureHandlerRootView style={$container}>
            <Provider store={store}>
              <ThemeProvider>
                <ThemedWebContainer>
                  <AuthModalProvider>
                    <PersistGate
                      loading={null}
                      onBeforeLift={onBeforeLiftPersistGate}
                      persistor={persistor}
                    >
                      <SSOCallbackGate>
                        <AppNavigator
                          linking={linking}
                          initialState={initialNavigationState}
                          onStateChange={onNavigationStateChange}
                        />
                        <InnerApp />
                      </SSOCallbackGate>
                    </PersistGate>
                  </AuthModalProvider>
                </ThemedWebContainer>
              </ThemeProvider>
            </Provider>
          </GestureHandlerRootView>
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  )
}

export default App

// Base styles for non-web platforms (mobile)
const $outerContainer: ViewStyle = {
  flex: 1,
}

const $container: ViewStyle = {
  flex: 1,
}
