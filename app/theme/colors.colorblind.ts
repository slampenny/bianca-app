// Modern 2025 color-blind friendly color palette
// High contrast colors optimized for users with color vision deficiency
// Uses distinct colors that are distinguishable for all types of colorblindness
// Updated with modern 2025 design principles while maintaining accessibility

const palette = {
  // Neutral colors - modern warm grays with high contrast
  neutral100: "#FFFFFF",      // Pure white for backgrounds
  neutral200: "#FAFAFA",      // Very light warm gray
  neutral300: "#F0F0F0",      // Light warm gray for borders
  neutral400: "#E5E5E5",      // Warm gray
  neutral500: "#A3A3A3",      // Medium warm gray
  neutral600: "#737373",      // Dark warm gray
  neutral700: "#525252",      // Darker gray
  neutral800: "#404040",      // Very dark gray
  neutral900: "#171717",      // Almost black with warm undertone

  // Primary colors - modern indigo-blue (distinct, high contrast)
  primary100: "#EEF2FF",      // Very light indigo
  primary200: "#E0E7FF",      // Light indigo
  primary300: "#C7D2FE",      // Medium light indigo
  primary400: "#A5B4FC",      // Medium indigo
  primary500: "#6366F1",      // Primary indigo - modern, distinct, accessible
  primary600: "#4F46E5",      // Darker indigo
  primary700: "#4338CA",      // Dark indigo
  primary800: "#3730A3",      // Very dark indigo
  primary900: "#312E81",      // Darkest indigo

  // Secondary colors - distinct purple (instead of green - colorblind friendly)
  secondary100: "#F3E8FF",    // Very light purple
  secondary200: "#E9D5FF",    // Light purple
  secondary300: "#D8B4FE",    // Medium light purple
  secondary400: "#C084FC",    // Medium purple
  secondary500: "#A855F7",    // Primary purple - modern, distinct from blue/green
  secondary600: "#9333EA",    // Dark purple
  secondary700: "#7E22CE",    // Darker purple
  secondary800: "#6B21A8",    // Very dark purple
  secondary900: "#581C87",    // Darkest purple

  // Success colors - distinct teal-green (colorblind friendly)
  success100: "#F0FDF4",      // Very light teal-green
  success200: "#DCFCE7",      // Light teal-green
  success300: "#BBF7D0",      // Medium light teal-green
  success400: "#86EFAC",      // Medium teal-green
  success500: "#22C55E",      // Primary teal-green - distinct and accessible
  success600: "#16A34A",      // Dark teal-green
  success700: "#15803D",      // Darker teal-green
  success800: "#166534",      // Very dark teal-green
  success900: "#14532D",      // Darkest teal-green

  // Warning colors - modern amber (high contrast, colorblind friendly)
  warning100: "#FEF3C7",      // Very light amber
  warning200: "#FDE68A",      // Light amber
  warning300: "#FCD34D",      // Medium light amber
  warning400: "#FBBF24",      // Medium amber
  warning500: "#F59E0B",      // Primary amber - modern, distinct, accessible
  warning600: "#D97706",      // Dark amber
  warning700: "#B45309",      // Darker amber
  warning800: "#92400E",      // Very dark amber
  warning900: "#78350F",      // Darkest amber

  // Error colors - modern rose-red (high contrast, colorblind friendly)
  error100: "#FEE2E2",        // Very light rose
  error200: "#FECACA",        // Light rose
  error300: "#FCA5A5",        // Medium light rose
  error400: "#F87171",        // Medium rose
  error500: "#EF4444",        // Primary rose - modern, distinct, high contrast
  error600: "#DC2626",        // Dark rose
  error700: "#B91C1C",        // Darker rose
  error800: "#991B1B",        // Very dark rose
  error900: "#7F1D1D",        // Darkest rose

  // Info colors - modern blue (distinct from indigo primary)
  info100: "#DBEAFE",         // Very light blue
  info200: "#BFDBFE",         // Light blue
  info300: "#93C5FD",         // Medium light blue
  info400: "#60A5FA",         // Medium blue
  info500: "#3B82F6",         // Primary blue - modern, distinct from indigo
  info600: "#2563EB",         // Dark blue
  info700: "#1D4ED8",         // Darker blue
  info800: "#1E40AF",         // Very dark blue
  info900: "#1E3A8A",         // Darkest blue

  // Medical colors - modern teal (distinct, colorblind friendly)
  medical100: "#F0FDFA",      // Very light teal
  medical200: "#CCFBF1",      // Light teal
  medical300: "#99F6E4",      // Medium light teal
  medical400: "#5EEAD4",      // Medium teal
  medical500: "#14B8A6",      // Primary teal - modern, distinct medical color
  medical600: "#0D9488",      // Dark teal
  medical700: "#0F766E",      // Darker teal
  medical800: "#115E59",      // Very dark teal
  medical900: "#134E4A",      // Darkest teal

  // Accent colors - modern orange (high contrast)
  accent100: "#FFF7ED",       // Very light orange
  accent200: "#FFEDD5",       // Light orange
  accent300: "#FED7AA",       // Medium light orange
  accent400: "#FDBA74",       // Medium orange
  accent500: "#FB923C",       // Primary orange - modern, distinct accent
  accent600: "#F97316",       // Dark orange
  accent700: "#EA580C",       // Darker orange
  accent800: "#C2410C",       // Very dark orange
  accent900: "#9A3412",       // Darkest orange

  // Transparent colors
  transparent: "rgba(0, 0, 0, 0)",
  overlay: "rgba(0, 0, 0, 0.5)",
} as const

// Legacy color mappings for backward compatibility
const colors = {
  palette,
  
  // Text colors - high contrast
  text: palette.neutral900,           // Dark text on light backgrounds
  textDim: palette.neutral600,       // Dimmed text
  textInverse: palette.neutral100,   // Light text on dark backgrounds
  
  // Background colors
  background: palette.neutral200,     // Main background - modern warm white
  backgroundDim: palette.neutral300,  // Dimmed background
  
  // Border colors
  border: palette.neutral400,         // Standard borders
  borderDim: palette.neutral300,      // Light borders
  
  // Legacy color names for compatibility
  tint: palette.primary500,           // Main tint color
  success: palette.success500,        // Success color
  error: palette.error500,            // Error color
  warning: palette.warning500,        // Warning color
  info: palette.info500,              // Info color
  
  // Healthcare-specific legacy colors - modern palette
  biancaBackground: palette.neutral200,
  biancaButtonSelected: palette.primary500,
  biancaButtonUnselected: palette.neutral400,
  biancaHeader: palette.neutral800,
  biancaBorder: palette.neutral400,
  biancaError: palette.error500,
  biancaErrorBackground: "rgba(239, 68, 68, 0.1)",
  biancaSuccess: palette.success500,
  biancaSuccessBackground: "rgba(34, 197, 94, 0.1)",
  biancaWarning: palette.warning500,
  biancaExplanation: palette.neutral600,
} as const

export { colors }