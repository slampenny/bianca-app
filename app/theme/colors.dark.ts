// Modern 2025 dark mode color palette
// Rich, warm dark theme with sophisticated colors and balanced contrast

const palette = {
  // Neutral colors - rich warm grays (not pure black)
  neutral100: "#0A0A0A",      // Almost black with warm undertone
  neutral200: "#1A1A1A",      // Rich dark gray
  neutral300: "#262626",      // Dark gray with warm tone
  neutral400: "#404040",      // Medium dark gray
  neutral500: "#525252",      // Medium gray
  neutral600: "#737373",      // Light gray for muted text
  neutral700: "#A3A3A3",      // Lighter gray for body text
  neutral800: "#D4D4D4",      // Very light gray for headings
  neutral900: "#FAFAFA",      // Almost white with warm undertone

  // Primary colors - modern indigo (softer for dark backgrounds)
  primary100: "#1E1B4B",      // Very dark indigo
  primary200: "#312E81",      // Dark indigo
  primary300: "#3730A3",      // Medium dark indigo
  primary400: "#4338CA",      // Medium indigo
  primary500: "#6366F1",      // Primary indigo - bright but balanced
  primary600: "#818CF8",      // Light indigo
  primary700: "#A5B4FC",      // Lighter indigo
  primary800: "#C7D2FE",      // Very light indigo
  primary900: "#E0E7FF",      // Lightest indigo

  // Secondary colors - modern emerald
  secondary100: "#064E3B",    // Very dark emerald
  secondary200: "#065F46",    // Dark emerald
  secondary300: "#047857",    // Medium dark emerald
  secondary400: "#059669",    // Medium emerald
  secondary500: "#10B981",    // Primary emerald - bright
  secondary600: "#34D399",    // Light emerald
  secondary700: "#6EE7B7",    // Lighter emerald
  secondary800: "#A7F3D0",    // Very light emerald
  secondary900: "#D1FAE5",    // Lightest emerald

  // Accent colors - modern amber (warmer for dark backgrounds)
  accent100: "#78350F",       // Very dark amber
  accent200: "#92400E",       // Dark amber
  accent300: "#B45309",       // Medium dark amber
  accent400: "#D97706",       // Medium amber
  accent500: "#F59E0B",       // Primary amber - warm and vibrant
  accent600: "#FBBF24",       // Light amber
  accent700: "#FCD34D",       // Lighter amber
  accent800: "#FDE68A",       // Very light amber
  accent900: "#FEF3C7",       // Lightest amber

  // Success colors - emerald (matching secondary)
  success100: "#064E3B",      // Very dark emerald
  success200: "#065F46",      // Dark emerald
  success300: "#047857",      // Medium dark emerald
  success400: "#059669",      // Medium emerald
  success500: "#10B981",      // Primary emerald
  success600: "#34D399",      // Light emerald
  success700: "#6EE7B7",      // Lighter emerald
  success800: "#A7F3D0",      // Very light emerald
  success900: "#D1FAE5",      // Lightest emerald

  // Warning colors - amber (matching accent)
  warning100: "#78350F",      // Very dark amber
  warning200: "#92400E",      // Dark amber
  warning300: "#B45309",      // Medium dark amber
  warning400: "#D97706",      // Medium amber
  warning500: "#F59E0B",      // Primary amber
  warning600: "#FBBF24",      // Light amber
  warning700: "#FCD34D",      // Lighter amber
  warning800: "#FDE68A",      // Very light amber
  warning900: "#FEF3C7",      // Lightest amber

  // Error colors - modern rose (softer than pure red)
  error100: "#7F1D1D",        // Very dark rose
  error200: "#991B1B",        // Dark rose
  error300: "#B91C1C",        // Medium dark rose
  error400: "#DC2626",        // Medium rose
  error500: "#EF4444",        // Primary rose - modern error
  error600: "#F87171",        // Light rose
  error700: "#FCA5A5",        // Lighter rose
  error800: "#FECACA",        // Very light rose
  error900: "#FEE2E2",        // Lightest rose

  // Info colors - modern blue
  info100: "#1E3A8A",         // Very dark blue
  info200: "#1E40AF",         // Dark blue
  info300: "#1D4ED8",         // Medium dark blue
  info400: "#2563EB",         // Medium blue
  info500: "#3B82F6",         // Primary blue
  info600: "#60A5FA",         // Light blue
  info700: "#93C5FD",         // Lighter blue
  info800: "#BFDBFE",         // Very light blue
  info900: "#DBEAFE",         // Lightest blue

  // Medical colors - modern teal
  medical100: "#134E4A",      // Very dark teal
  medical200: "#115E59",      // Dark teal
  medical300: "#0F766E",      // Medium dark teal
  medical400: "#0D9488",      // Medium teal
  medical500: "#14B8A6",      // Primary teal - modern healthcare
  medical600: "#5EEAD4",      // Light teal
  medical700: "#99F6E4",      // Lighter teal
  medical800: "#CCFBF1",      // Very light teal
  medical900: "#F0FDFA",      // Lightest teal

  // Transparent colors
  transparent: "rgba(0, 0, 0, 0)",
  overlay: "rgba(0, 0, 0, 0.7)",
  // Overlay colors for modals and overlays
  overlay20: "rgba(0, 0, 0, 0.2)",    // 20% black overlay
  overlay50: "rgba(0, 0, 0, 0.5)",    // 50% black overlay
  overlay80: "rgba(0, 0, 0, 0.8)",    // 80% black overlay
} as const

// Legacy color mappings for backward compatibility
const colors = {
  palette,
  
  // Text colors - light text for dark backgrounds
  text: palette.neutral900,           // Almost white for readability
  textDim: palette.neutral700,       // Dimmed text (medium gray)
  textInverse: palette.neutral200,   // Dark text on light backgrounds
  
  // Background colors - use rich dark grays, not pure black
  background: palette.neutral200,     // Main background (rich dark gray)
  backgroundDim: palette.neutral300,  // Dimmed background
  
  // Border colors
  border: palette.neutral400,         // Visible borders on dark background
  borderDim: palette.neutral300,      // Subtle borders
  
  // Legacy color names for compatibility
  tint: palette.primary500,           // Main tint color - modern indigo
  success: palette.success500,        // Success color - emerald
  error: palette.error500,            // Error color - rose
  warning: palette.warning500,        // Warning color - amber
  info: palette.info500,              // Info color - blue
  
  // Healthcare-specific legacy colors - modern palette
  biancaBackground: palette.neutral200,  // Rich dark gray
  biancaButtonSelected: palette.primary500, // Modern indigo
  biancaButtonUnselected: palette.neutral400, // Medium gray
  biancaHeader: palette.neutral900,       // Light text
  biancaBorder: palette.neutral400,      // Visible borders
  biancaError: palette.error500,         // Modern rose
  biancaErrorBackground: "rgba(239, 68, 68, 0.15)", // Subtle error background
  biancaSuccess: palette.success500,     // Modern emerald
  biancaSuccessBackground: "rgba(16, 185, 129, 0.15)", // Subtle success background
  biancaWarning: palette.warning500,    // Modern amber
  biancaExplanation: palette.neutral700, // Medium gray for explanations
} as const

export { colors }
