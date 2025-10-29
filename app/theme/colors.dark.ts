// Dark mode color palette
// High contrast dark theme optimized for low-light environments and accessibility

const palette = {
  // Neutral colors - dark theme grays
  neutral100: "#000000",      // Pure black for backgrounds
  neutral200: "#1A1A1A",      // Very dark gray
  neutral300: "#333333",      // Dark gray for borders
  neutral400: "#4D4D4D",      // Medium dark gray
  neutral500: "#666666",      // Medium gray
  neutral600: "#808080",      // Medium light gray
  neutral700: "#999999",      // Light gray
  neutral800: "#CCCCCC",      // Very light gray
  neutral900: "#FFFFFF",      // Pure white

  // Primary colors - bright blue for dark backgrounds
  primary100: "#001A33",      // Very dark blue
  primary200: "#003366",      // Dark blue
  primary300: "#004D99",      // Medium dark blue
  primary400: "#0066CC",      // Medium blue
  primary500: "#0080FF",      // Primary blue - bright for dark theme
  primary600: "#3399FF",      // Light blue
  primary700: "#66B3FF",      // Lighter blue
  primary800: "#99CCFF",      // Very light blue
  primary900: "#CCE6FF",      // Lightest blue

  // Secondary colors - bright purple for dark backgrounds
  secondary100: "#330033",    // Very dark purple
  secondary200: "#660066",    // Dark purple
  secondary300: "#990099",    // Medium dark purple
  secondary400: "#CC00CC",    // Medium purple
  secondary500: "#FF00FF",    // Primary purple - bright magenta
  secondary600: "#FF33FF",    // Light purple
  secondary700: "#FF66FF",    // Lighter purple
  secondary800: "#FF99FF",    // Very light purple
  secondary900: "#FFCCFF",    // Lightest purple

  // Success colors - bright green for dark backgrounds
  success100: "#003300",      // Very dark green
  success200: "#006600",      // Dark green
  success300: "#009900",      // Medium dark green
  success400: "#00CC00",      // Medium green
  success500: "#00FF00",      // Primary green - bright lime
  success600: "#33FF33",      // Light green
  success700: "#66FF66",      // Lighter green
  success800: "#99FF99",      // Very light green
  success900: "#CCFFCC",      // Lightest green

  // Warning colors - bright yellow for dark backgrounds
  warning100: "#333300",      // Very dark yellow
  warning200: "#666600",      // Dark yellow
  warning300: "#999900",      // Medium dark yellow
  warning400: "#CCCC00",      // Medium yellow
  warning500: "#FFFF00",      // Primary yellow - bright yellow
  warning600: "#FFFF33",      // Light yellow
  warning700: "#FFFF66",      // Lighter yellow
  warning800: "#FFFF99",      // Very light yellow
  warning900: "#FFFFCC",      // Lightest yellow

  // Error colors - bright red for dark backgrounds
  error100: "#330000",        // Very dark red
  error200: "#660000",        // Dark red
  error300: "#990000",        // Medium dark red
  error400: "#CC0000",        // Medium red
  error500: "#FF0000",        // Primary red - bright red
  error600: "#FF3333",        // Light red
  error700: "#FF6666",        // Lighter red
  error800: "#FF9999",        // Very light red
  error900: "#FFCCCC",        // Lightest red

  // Info colors - bright cyan for dark backgrounds
  info100: "#003333",         // Very dark cyan
  info200: "#006666",         // Dark cyan
  info300: "#009999",         // Medium dark cyan
  info400: "#00CCCC",         // Medium cyan
  info500: "#00FFFF",         // Primary cyan - bright cyan
  info600: "#33FFFF",         // Light cyan
  info700: "#66FFFF",         // Lighter cyan
  info800: "#99FFFF",         // Very light cyan
  info900: "#CCFFFF",         // Lightest cyan

  // Medical colors - bright teal for dark backgrounds
  medical100: "#003333",      // Very dark teal
  medical200: "#006666",      // Dark teal
  medical300: "#009999",      // Medium dark teal
  medical400: "#00CCCC",      // Medium teal
  medical500: "#00FFCC",      // Primary teal - bright aqua
  medical600: "#33FFCC",      // Light teal
  medical700: "#66FFCC",      // Lighter teal
  medical800: "#99FFCC",      // Very light teal
  medical900: "#CCFFCC",      // Lightest teal

  // Additional bright colors for dark theme
  accent100: "#332200",       // Very dark orange
  accent200: "#664400",       // Dark orange
  accent300: "#996600",       // Medium dark orange
  accent400: "#CC8800",       // Medium orange
  accent500: "#FFAA00",       // Primary orange - bright amber
  accent600: "#FFBB33",       // Light orange
  accent700: "#FFCC66",       // Lighter orange
  accent800: "#FFDD99",       // Very light orange
  accent900: "#FFEECC",       // Lightest orange

  // Transparent colors
  transparent: "rgba(0, 0, 0, 0)",
  overlay: "rgba(0, 0, 0, 0.7)",
} as const

// Legacy color mappings for backward compatibility
const colors = {
  palette,
  
  // Text colors - light text for dark backgrounds
  text: palette.neutral800,           // Light text on dark backgrounds
  textDim: palette.neutral600,       // Dimmed text
  textInverse: palette.neutral200,   // Dark text on light backgrounds
  
  // Background colors - use dark grays instead of pure black
  background: palette.neutral200,     // Main background (dark gray, not black)
  backgroundDim: palette.neutral300,  // Dimmed background
  
  // Border colors
  border: palette.neutral400,         // Standard borders (lighter for visibility)
  borderDim: palette.neutral300,      // Light borders
  
  // Legacy color names for compatibility
  tint: palette.primary500,           // Main tint color
  success: palette.success500,        // Success color
  error: palette.error500,            // Error color
  warning: palette.warning500,        // Warning color
  info: palette.info500,              // Info color
  
  // Healthcare-specific legacy colors - use appropriate dark theme colors
  biancaBackground: palette.neutral200,  // Dark gray instead of black
  biancaButtonSelected: palette.primary500,
  biancaButtonUnselected: palette.neutral400,
  biancaHeader: palette.neutral800,       // Light text
  biancaBorder: palette.neutral400,      // Visible borders
  biancaError: palette.error500,
  biancaErrorBackground: palette.error100,
  biancaSuccess: palette.success500,
  biancaSuccessBackground: palette.success100,
  biancaWarning: palette.warning500,
  biancaExplanation: palette.neutral600,
} as const

export { colors }
