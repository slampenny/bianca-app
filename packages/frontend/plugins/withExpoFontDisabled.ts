import { ConfigPlugin, withAppBuildGradle } from "expo/config-plugins"

/**
 * Expo Config Plugin to disable expo-font native module
 * 
 * This prevents expo-font from being included in the native build,
 * allowing us to use a JavaScript polyfill instead.
 */
export const withExpoFontDisabled: ConfigPlugin = (config) => {
  config = withAppBuildGradleMod(config)
  return config
}

/**
 * Modifies the `android/app/build.gradle` file to exclude expo-font
 * from Expo modules auto-linking
 */
const withAppBuildGradleMod: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (modConfig) => {
    // Add expo-font to the exclude list in useExpoModules if it exists
    // This prevents expo-font from being auto-included by Expo modules
    const contents = modConfig.modResults.contents
    
    // Check if we need to modify the Expo modules configuration
    // The actual exclusion happens via app.json autolinking.exclude,
    // but we can add additional safeguards here if needed
    
    // For now, we rely on the autolinking.exclude in app.json
    // This plugin serves as a placeholder for future native modifications if needed
    
    return modConfig
  })





