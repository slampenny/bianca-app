// Modern 2025 color palette
// Designed with contemporary design principles: soft gradients, warm undertones, sophisticated colors

const palette = {
  // Neutral colors - warm, sophisticated grays with subtle undertones
  neutral100: "#FFFFFF",      // Pure white for backgrounds
  neutral200: "#FAFAFA",      // Very light warm gray (slightly warmer than pure white)
  neutral300: "#F0F0F0",      // Light warm gray for subtle backgrounds
  neutral400: "#E5E5E5",      // Warm gray for borders and dividers
  neutral500: "#A3A3A3",      // Medium warm gray for secondary text
  neutral600: "#737373",      // Dark warm gray for muted text
  neutral700: "#525252",      // Darker gray for body text
  neutral800: "#404040",      // Very dark gray for headings
  neutral900: "#171717",      // Almost black with warm undertone

  // Primary colors - modern sophisticated blue (inspired by Linear, Vercel)
  primary100: "#EEF2FF",      // Very light indigo-blue
  primary200: "#E0E7FF",      // Light indigo
  primary300: "#C7D2FE",      // Medium light indigo
  primary400: "#A5B4FC",      // Medium indigo
  primary500: "#6366F1",      // Primary indigo - modern, sophisticated
  primary600: "#4F46E5",      // Darker indigo for pressed states
  primary700: "#4338CA",      // Dark indigo for emphasis
  primary800: "#3730A3",      // Very dark indigo
  primary900: "#312E81",      // Darkest indigo

  // Secondary colors - modern emerald green (softer, more sophisticated)
  secondary100: "#D1FAE5",    // Very light emerald
  secondary200: "#A7F3D0",    // Light emerald
  secondary300: "#6EE7B7",    // Medium light emerald
  secondary400: "#34D399",    // Medium emerald
  secondary500: "#10B981",    // Primary emerald - modern, balanced
  secondary600: "#059669",    // Darker emerald
  secondary700: "#047857",    // Dark emerald
  secondary800: "#065F46",    // Very dark emerald
  secondary900: "#064E3B",    // Darkest emerald

  // Accent colors - modern amber (warmer, more sophisticated)
  accent100: "#FEF3C7",       // Very light amber
  accent200: "#FDE68A",       // Light amber
  accent300: "#FCD34D",       // Medium light amber
  accent400: "#FBBF24",       // Medium amber
  accent500: "#F59E0B",       // Primary amber - modern, warm
  accent600: "#D97706",       // Darker amber
  accent700: "#B45309",       // Dark amber
  accent800: "#92400E",       // Very dark amber
  accent900: "#78350F",       // Darkest amber

  // Status colors - modern, balanced system
  success100: "#D1FAE5",      // Very light emerald for success backgrounds
  success200: "#A7F3D0",      // Light emerald
  success300: "#6EE7B7",      // Medium light emerald
  success400: "#34D399",      // Medium emerald
  success500: "#10B981",      // Primary emerald - modern success
  success600: "#059669",      // Darker emerald
  success700: "#047857",      // Dark emerald
  success800: "#065F46",      // Very dark emerald
  success900: "#064E3B",      // Darkest emerald

  warning100: "#FEF3C7",      // Very light amber for warning backgrounds
  warning200: "#FDE68A",      // Light amber
  warning300: "#FCD34D",      // Medium light amber
  warning400: "#FBBF24",      // Medium amber
  warning500: "#F59E0B",      // Primary amber - modern warnings
  warning600: "#D97706",      // Darker amber
  warning700: "#B45309",      // Dark amber
  warning800: "#92400E",      // Very dark amber
  warning900: "#78350F",      // Darkest amber

  error100: "#FEE2E2",        // Very light rose for error backgrounds
  error200: "#FECACA",        // Light rose
  error300: "#FCA5A5",        // Medium light rose
  error400: "#F87171",        // Medium rose
  error500: "#EF4444",        // Primary rose - modern errors
  error600: "#DC2626",        // Darker rose
  error700: "#B91C1C",        // Dark rose
  error800: "#991B1B",        // Very dark rose
  error900: "#7F1D1D",        // Darkest rose

  info100: "#DBEAFE",         // Very light blue for info backgrounds
  info200: "#BFDBFE",         // Light blue
  info300: "#93C5FD",         // Medium light blue
  info400: "#60A5FA",         // Medium blue
  info500: "#3B82F6",         // Primary blue - modern info
  info600: "#2563EB",         // Darker blue
  info700: "#1D4ED8",         // Dark blue
  info800: "#1E40AF",         // Very dark blue
  info900: "#1E3A8A",         // Darkest blue

  // Healthcare-specific colors - modern teal/cyan
  medical100: "#F0FDFA",      // Very light teal
  medical200: "#CCFBF1",      // Light teal
  medical300: "#99F6E4",      // Medium light teal
  medical400: "#5EEAD4",      // Medium teal
  medical500: "#14B8A6",      // Primary teal - modern healthcare
  medical600: "#0D9488",      // Darker teal
  medical700: "#0F766E",      // Dark teal
  medical800: "#115E59",      // Very dark teal
  medical900: "#134E4A",      // Darkest teal

  // Overlay colors for modals and overlays - modern warm overlays
  overlay20: "rgba(23, 23, 23, 0.2)",    // 20% warm black overlay
  overlay50: "rgba(23, 23, 23, 0.5)",    // 50% warm black overlay
  overlay80: "rgba(23, 23, 23, 0.8)",    // 80% warm black overlay

  // Legacy Bianca colors (for backward compatibility) - updated to modern palette
  biancaBackground: "#FAFAFA",           // Modern warm white
  biancaHeader: "#171717",               // Modern dark text
  biancaButtonSelected: "#6366F1",       // Modern indigo primary
  biancaButtonUnselected: "#E5E5E5",     // Modern warm gray
  biancaError: "#DC2626",                // Darker red for better contrast (was #EF4444)
  biancaErrorBackground: "#FEE2E2",      // Solid light red background (was rgba) - meets WCAG AA
  biancaSuccess: "#059669",              // Darker green for better contrast (was #10B981)
  biancaSuccessBackground: "#D1FAE5",   // Solid light green background (was rgba) - meets WCAG AA
  biancaExplanation: "#737373",          // Modern warm gray
  biancaBorder: "#E5E5E5",              // Modern warm gray border

  // Legacy angry colors (for backward compatibility)
  angry100: "#FEE2E2",        // Updated to match error100
  angry500: "#EF4444",        // Updated to match error500
} as const

export const colors = {
  /**
   * The palette is available to use, but prefer using the name.
   * This is only included for rare, one-off cases. Try to use
   * semantic names as much as possible.
   */
  palette,
  
  /**
   * A helper for making something see-thru.
   */
  transparent: "rgba(0, 0, 0, 0)",
  
  /**
   * The default text color in many components.
   */
  text: palette.neutral900,
  
  /**
   * Secondary text information.
   */
  textDim: palette.neutral700,  // Darker for better contrast (was neutral600)
  
  /**
   * The default color of the screen background.
   */
  background: palette.neutral200,
  
  /**
   * The default border color.
   */
  border: palette.neutral300,
  
  /**
   * The main tinting color - modern indigo.
   */
  tint: palette.primary500,
  
  /**
   * A subtle color used for lines and separators.
   */
  separator: palette.neutral300,
  
  /**
   * Error messages and critical states.
   */
  error: palette.error500,
  
  /**
   * Error background for error states.
   */
  errorBackground: palette.error100,
  
  /**
   * Success messages and positive states.
   */
  success: palette.success500,
  
  /**
   * Success background for success states.
   */
  successBackground: palette.success100,
  
  /**
   * Warning messages and caution states.
   */
  warning: palette.warning500,
  
  /**
   * Warning background for warning states.
   */
  warningBackground: palette.warning100,
  
  /**
   * Info messages and informational states.
   */
  info: palette.info500,
  
  /**
   * Info background for info states.
   */
  infoBackground: palette.info100,
  
  /**
   * Medical/healthcare specific color.
   */
  medical: palette.medical500,
  
  /**
   * Medical background for healthcare-specific elements.
   */
  medicalBackground: palette.medical100,
}
