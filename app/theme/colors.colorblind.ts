// Color-blind friendly color palette
// High contrast colors optimized for users with color vision deficiency
// Uses distinct colors that are distinguishable for all types of colorblindness

const palette = {
  // Neutral colors - high contrast grays
  neutral100: "#FFFFFF",      // Pure white for backgrounds
  neutral200: "#F5F5F5",      // Very light gray
  neutral300: "#E0E0E0",      // Light gray for borders
  neutral400: "#B0B0B0",      // Medium light gray
  neutral500: "#808080",      // Medium gray
  neutral600: "#606060",      // Medium dark gray
  neutral700: "#404040",      // Dark gray
  neutral800: "#202020",      // Very dark gray
  neutral900: "#000000",      // Pure black

  // Primary colors - distinct blue (avoiding green confusion)
  primary100: "#E6F3FF",      // Very light blue
  primary200: "#CCE7FF",      // Light blue
  primary300: "#99CFFF",      // Medium light blue
  primary400: "#66B7FF",      // Medium blue
  primary500: "#0066CC",      // Primary blue - distinct and high contrast
  primary600: "#0052A3",      // Dark blue
  primary700: "#003D7A",      // Darker blue
  primary800: "#002952",      // Very dark blue
  primary900: "#001429",      // Darkest blue

  // Secondary colors - distinct purple (instead of green)
  secondary100: "#F3E6FF",    // Very light purple
  secondary200: "#E7CCFF",    // Light purple
  secondary300: "#CF99FF",    // Medium light purple
  secondary400: "#B766FF",    // Medium purple
  secondary500: "#8B00CC",    // Primary purple - distinct from blue
  secondary600: "#6F00A3",    // Dark purple
  secondary700: "#53007A",    // Darker purple
  secondary800: "#370052",    // Very dark purple
  secondary900: "#1B0029",    // Darkest purple

  // Success colors - distinct green (but high contrast)
  success100: "#E6FFE6",      // Very light green
  success200: "#CCFFCC",      // Light green
  success300: "#99FF99",      // Medium light green
  success400: "#66FF66",      // Medium green
  success500: "#00CC00",      // Primary green - distinct and bright
  success600: "#00A300",      // Dark green
  success700: "#007A00",      // Darker green
  success800: "#005200",      // Very dark green
  success900: "#002900",      // Darkest green

  // Warning colors - distinct yellow/orange
  warning100: "#FFF8E6",      // Very light yellow
  warning200: "#FFF1CC",      // Light yellow
  warning300: "#FFE399",      // Medium light yellow
  warning400: "#FFD566",      // Medium yellow
  warning500: "#FFCC00",      // Primary yellow - distinct and bright
  warning600: "#CCA300",      // Dark yellow
  warning700: "#997A00",      // Darker yellow
  warning800: "#665200",      // Very dark yellow
  warning900: "#332900",      // Darkest yellow

  // Error colors - distinct red
  error100: "#FFE6E6",        // Very light red
  error200: "#FFCCCC",        // Light red
  error300: "#FF9999",        // Medium light red
  error400: "#FF6666",        // Medium red
  error500: "#CC0000",        // Primary red - distinct and high contrast
  error600: "#A30000",        // Dark red
  error700: "#7A0000",        // Darker red
  error800: "#520000",        // Very dark red
  error900: "#290000",        // Darkest red

  // Info colors - distinct cyan/teal
  info100: "#E6FFFF",         // Very light cyan
  info200: "#CCFFFF",         // Light cyan
  info300: "#99FFFF",         // Medium light cyan
  info400: "#66FFFF",         // Medium cyan
  info500: "#00CCCC",         // Primary cyan - distinct from blue
  info600: "#00A3A3",         // Dark cyan
  info700: "#007A7A",         // Darker cyan
  info800: "#005252",         // Very dark cyan
  info900: "#002929",         // Darkest cyan

  // Medical colors - distinct teal
  medical100: "#E6FFFA",      // Very light teal
  medical200: "#CCFFF5",      // Light teal
  medical300: "#99FFEB",      // Medium light teal
  medical400: "#66FFE1",      // Medium teal
  medical500: "#00D4AA",      // Primary teal - distinct medical color
  medical600: "#00A888",      // Dark teal
  medical700: "#007C66",      // Darker teal
  medical800: "#005044",      // Very dark teal
  medical900: "#002422",      // Darkest teal

  // Additional high contrast colors for specific use cases
  accent100: "#FFF0E6",       // Very light orange
  accent200: "#FFE1CC",       // Light orange
  accent300: "#FFC399",       // Medium light orange
  accent400: "#FFA566",       // Medium orange
  accent500: "#FF8800",       // Primary orange - distinct accent
  accent600: "#CC6D00",       // Dark orange
  accent700: "#995200",       // Darker orange
  accent800: "#663700",       // Very dark orange
  accent900: "#331C00",       // Darkest orange

  // Transparent colors
  transparent: "rgba(0, 0, 0, 0)",
  overlay: "rgba(0, 0, 0, 0.5)",
} as const

// Legacy color mappings for backward compatibility
const colors = {
  palette,
  
  // Text colors - high contrast
  text: palette.neutral800,           // Dark text on light backgrounds
  textDim: palette.neutral600,       // Dimmed text
  textInverse: palette.neutral100,   // Light text on dark backgrounds
  
  // Background colors
  background: palette.neutral100,     // Main background
  backgroundDim: palette.neutral200,  // Dimmed background
  
  // Border colors
  border: palette.neutral300,         // Standard borders
  borderDim: palette.neutral200,      // Light borders
  
  // Legacy color names for compatibility
  tint: palette.primary500,           // Main tint color
  success: palette.success500,        // Success color
  error: palette.error500,            // Error color
  warning: palette.warning500,        // Warning color
  info: palette.info500,              // Info color
  
  // Healthcare-specific legacy colors
  biancaBackground: palette.neutral100,
  biancaButtonSelected: palette.primary500,
  biancaButtonUnselected: palette.neutral300,
  biancaHeader: palette.neutral800,
  biancaBorder: palette.neutral300,
  biancaError: palette.error500,
  biancaErrorBackground: palette.error100,
  biancaSuccess: palette.success500,
  biancaSuccessBackground: palette.success100,
  biancaWarning: palette.warning500,
  biancaExplanation: palette.neutral600,
} as const

export { colors }