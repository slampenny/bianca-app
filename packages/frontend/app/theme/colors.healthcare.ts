// Healthcare-focused color palette for MyPhoneFriend
// Designed for medical professionals, caregivers, and healthcare environments

const healthcarePalette = {
  // Neutral colors - clean, professional grays
  neutral100: "#FFFFFF",      // Pure white for backgrounds
  neutral200: "#F8FAFC",      // Very light gray for subtle backgrounds
  neutral300: "#E2E8F0",      // Light gray for borders and dividers
  neutral400: "#94A3B8",      // Medium gray for secondary text
  neutral500: "#64748B",      // Darker gray for muted text
  neutral600: "#475569",      // Dark gray for body text
  neutral700: "#334155",      // Very dark gray for headings
  neutral800: "#1E293B",      // Almost black for primary text
  neutral900: "#0F172A",      // Pure black for high contrast

  // Primary colors - medical blue theme
  primary100: "#E0F2FE",      // Very light blue for backgrounds
  primary200: "#BAE6FD",      // Light blue for hover states
  primary300: "#7DD3FC",      // Medium light blue
  primary400: "#38BDF8",      // Medium blue
  primary500: "#0EA5E9",      // Primary blue - main brand color
  primary600: "#0284C7",      // Darker blue for pressed states
  primary700: "#0369A1",      // Dark blue for emphasis
  primary800: "#075985",      // Very dark blue
  primary900: "#0C4A6E",      // Darkest blue

  // Secondary colors - healthcare green
  secondary100: "#DCFCE7",    // Very light green for success backgrounds
  secondary200: "#BBF7D0",    // Light green
  secondary300: "#86EFAC",    // Medium light green
  secondary400: "#4ADE80",    // Medium green
  secondary500: "#22C55E",    // Primary green - success, healthy states
  secondary600: "#16A34A",    // Darker green
  secondary700: "#15803D",    // Dark green
  secondary800: "#166534",    // Very dark green
  secondary900: "#14532D",    // Darkest green

  // Accent colors - warm orange for alerts and calls
  accent100: "#FEF3C7",       // Very light orange for warning backgrounds
  accent200: "#FDE68A",       // Light orange
  accent300: "#FCD34D",       // Medium light orange
  accent400: "#FBBF24",       // Medium orange
  accent500: "#F59E0B",       // Primary orange - warnings, calls
  accent600: "#D97706",       // Darker orange
  accent700: "#B45309",       // Dark orange
  accent800: "#92400E",       // Very dark orange
  accent900: "#78350F",       // Darkest orange

  // Status colors - medical status indicators
  success100: "#D1FAE5",      // Very light green for success backgrounds
  success200: "#A7F3D0",      // Light green
  success300: "#6EE7B7",      // Medium light green
  success400: "#34D399",      // Medium green
  success500: "#10B981",      // Primary green - success states
  success600: "#059669",      // Darker green
  success700: "#047857",      // Dark green
  success800: "#065F46",      // Very dark green
  success900: "#064E3B",      // Darkest green

  warning100: "#FEF3C7",      // Very light yellow for warning backgrounds
  warning200: "#FDE68A",      // Light yellow
  warning300: "#FCD34D",      // Medium light yellow
  warning400: "#FBBF24",      // Medium yellow
  warning500: "#F59E0B",      // Primary yellow - warnings
  warning600: "#D97706",      // Darker yellow
  warning700: "#B45309",      // Dark yellow
  warning800: "#92400E",      // Very dark yellow
  warning900: "#78350F",      // Darkest yellow

  error100: "#FEE2E2",        // Very light red for error backgrounds
  error200: "#FECACA",        // Light red
  error300: "#FCA5A5",        // Medium light red
  error400: "#F87171",        // Medium red
  error500: "#EF4444",        // Primary red - errors, critical states
  error600: "#DC2626",        // Darker red
  error700: "#B91C1C",        // Dark red
  error800: "#991B1B",        // Very dark red
  error900: "#7F1D1D",        // Darkest red

  info100: "#DBEAFE",         // Very light blue for info backgrounds
  info200: "#BFDBFE",         // Light blue
  info300: "#93C5FD",         // Medium light blue
  info400: "#60A5FA",         // Medium blue
  info500: "#3B82F6",         // Primary blue - info states
  info600: "#2563EB",         // Darker blue
  info700: "#1D4ED8",         // Dark blue
  info800: "#1E40AF",         // Very dark blue
  info900: "#1E3A8A",         // Darkest blue

  // Healthcare-specific colors
  medical100: "#F0F9FF",      // Very light medical blue
  medical200: "#E0F2FE",       // Light medical blue
  medical300: "#BAE6FD",       // Medium light medical blue
  medical400: "#7DD3FC",       // Medium medical blue
  medical500: "#38BDF8",       // Primary medical blue
  medical600: "#0EA5E9",       // Darker medical blue
  medical700: "#0284C7",       // Dark medical blue
  medical800: "#0369A1",       // Very dark medical blue
  medical900: "#075985",       // Darkest medical blue

  // Overlay colors for modals and overlays
  overlay20: "rgba(15, 23, 42, 0.2)",    // 20% black overlay
  overlay50: "rgba(15, 23, 42, 0.5)",    // 50% black overlay
  overlay80: "rgba(15, 23, 42, 0.8)",    // 80% black overlay

  // Legacy Bianca colors (for backward compatibility)
  biancaBackground: "#F8FAFC",           // Updated to match neutral200
  biancaHeader: "#1E293B",               // Updated to match neutral800
  biancaButtonSelected: "#0EA5E9",        // Updated to match primary500
  biancaButtonUnselected: "#E2E8F0",      // Updated to match neutral300
  biancaError: "#EF4444",                // Updated to match error500
  biancaErrorBackground: "rgba(239, 68, 68, 0.1)", // Updated error background
  biancaSuccess: "#22C55E",              // Updated to match success500
  biancaSuccessBackground: "rgba(34, 197, 94, 0.1)", // Updated success background
  biancaExplanation: "#64748B",          // Updated to match neutral500
  biancaBorder: "#E2E8F0",              // Updated to match neutral300
} as const

export const healthcareColors = {
  /**
   * The palette is available to use, but prefer using the semantic names.
   * This is only included for rare, one-off cases. Try to use
   * semantic names as much as possible.
   */
  palette: healthcarePalette,
  
  /**
   * A helper for making something see-thru.
   */
  transparent: "rgba(0, 0, 0, 0)",
  
  /**
   * The default text color in many components.
   */
  text: healthcarePalette.neutral800,
  
  /**
   * Secondary text information.
   */
  textDim: healthcarePalette.neutral500,
  
  /**
   * The default color of the screen background.
   */
  background: healthcarePalette.neutral200,
  
  /**
   * The default border color.
   */
  border: healthcarePalette.neutral300,
  
  /**
   * The main tinting color - medical blue.
   */
  tint: healthcarePalette.primary500,
  
  /**
   * A subtle color used for lines and separators.
   */
  separator: healthcarePalette.neutral300,
  
  /**
   * Error messages and critical states.
   */
  error: healthcarePalette.error500,
  
  /**
   * Error background for error states.
   */
  errorBackground: healthcarePalette.error100,
  
  /**
   * Success messages and positive states.
   */
  success: healthcarePalette.success500,
  
  /**
   * Success background for success states.
   */
  successBackground: healthcarePalette.success100,
  
  /**
   * Warning messages and caution states.
   */
  warning: healthcarePalette.warning500,
  
  /**
   * Warning background for warning states.
   */
  warningBackground: healthcarePalette.warning100,
  
  /**
   * Info messages and informational states.
   */
  info: healthcarePalette.info500,
  
  /**
   * Info background for info states.
   */
  infoBackground: healthcarePalette.info100,
  
  /**
   * Medical/healthcare specific color.
   */
  medical: healthcarePalette.medical500,
  
  /**
   * Medical background for healthcare-specific elements.
   */
  medicalBackground: healthcarePalette.medical100,
}
