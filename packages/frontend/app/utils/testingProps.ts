import { Platform } from "react-native"

/**
 * Utility to provide testID for native and data-testid for web
 * 
 * React Native Web doesn't automatically map testID to data-testid for all components.
 * This utility ensures consistent test ID behavior across platforms.
 * 
 * Usage:
 * - For Pressable/Button: Just use testID prop directly (React Native Web handles it)
 * - For TextInput: Use {...testingProps(testID)} to ensure data-testid is set on web
 * - For View containers: Use {...testingProps(testID)} if you need to find the container
 * 
 * @param testKey - The test identifier
 * @returns Object with testID for native, data-testid for web
 */
export function testingProps(testKey?: string) {
    if (!testKey) return {}
    return Platform.select({
      web: { "data-testid": testKey },
      default: { testID: testKey },
    })
}
