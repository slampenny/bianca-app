/**
 * Ignore some yellowbox warnings. Some of these are for deprecated functions
 * that we haven't gotten around to replacing yet.
 */
import { LogBox, Platform } from "react-native"

// prettier-ignore
LogBox.ignoreLogs([
  "Require cycle:",
  // Ignore shadow* deprecation warning - we handle it with Platform-specific styles
  /shadow.*style props are deprecated/,
  // Ignore pointerEvents deprecation warning from React Navigation (third-party library issue)
  /props\.pointerEvents is deprecated/,
])

// Also suppress pointerEvents warning in browser console (for web)
if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const originalWarn = console.warn
  console.warn = (...args: any[]) => {
    const message = args[0]
    if (typeof message === 'string' && message.includes('props.pointerEvents is deprecated')) {
      return // Suppress this specific warning
    }
    originalWarn.apply(console, args)
  }
}
