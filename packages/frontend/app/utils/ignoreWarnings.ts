/**
 * Ignore some yellowbox warnings. Some of these are for deprecated functions
 * that we haven't gotten around to replacing yet.
 */
import { LogBox } from "react-native"

// prettier-ignore
LogBox.ignoreLogs([
  "Require cycle:",
  // Ignore shadow* deprecation warning - we handle it with Platform-specific styles
  /shadow.*style props are deprecated/,
])
