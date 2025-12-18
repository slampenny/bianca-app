import "@expo/metro-runtime"
import React from "react"
import App from "./app/app"

// Try to use expo-splash-screen, but handle gracefully if native module not available
let SplashScreen: any = null
let hideSplashScreen: () => Promise<void> = async () => {}

try {
  SplashScreen = require("expo-splash-screen")
  if (SplashScreen && SplashScreen.preventAutoHideAsync) {
    SplashScreen.preventAutoHideAsync()
  }
  if (SplashScreen && SplashScreen.hideAsync) {
    hideSplashScreen = SplashScreen.hideAsync
  }
} catch (e) {
  // expo-splash-screen not available - use no-op
  console.warn("expo-splash-screen not available, continuing without it")
}

function IgniteApp() {
  return <App hideSplashScreen={hideSplashScreen} />
}

export default IgniteApp
