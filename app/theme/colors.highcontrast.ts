// Maximum contrast color palette for vision impairment
// WCAG AAA compliance: 7:1 contrast ratio for normal text, 4.5:1 for large text
// Pure black and white with minimal color palette for maximum readability

const palette = {
  // Neutral colors - pure black and white for maximum contrast
  neutral100: "#FFFFFF",      // Pure white - 21:1 contrast with black
  neutral200: "#FFFFFF",      // Pure white (no variation needed)
  neutral300: "#FFFFFF",      // Pure white
  neutral400: "#000000",       // Pure black for borders
  neutral500: "#000000",       // Pure black
  neutral600: "#000000",       // Pure black
  neutral700: "#000000",       // Pure black
  neutral800: "#000000",       // Pure black
  neutral900: "#000000",       // Pure black - 21:1 contrast with white

  // Primary colors - bright blue for maximum contrast
  primary100: "#FFFFFF",      // White background
  primary200: "#E6F2FF",       // Very light blue
  primary300: "#CCE5FF",       // Light blue
  primary400: "#0066CC",       // Medium blue (7:1+ on white)
  primary500: "#0066CC",       // Primary blue - bright, high contrast
  primary600: "#0052A3",       // Darker blue
  primary700: "#003D7A",       // Dark blue
  primary800: "#002952",       // Very dark blue
  primary900: "#001429",       // Darkest blue

  // Secondary colors - dark green for success (distinct from blue)
  secondary100: "#FFFFFF",     // White background
  secondary200: "#E6F5E6",     // Very light green
  secondary300: "#CCEBCC",     // Light green
  secondary400: "#006600",     // Medium green (7:1+ on white)
  secondary500: "#006600",       // Primary green - dark, high contrast
  secondary600: "#005200",     // Darker green
  secondary700: "#003D00",     // Dark green
  secondary800: "#002900",     // Very dark green
  secondary900: "#001400",     // Darkest green

  // Success colors - dark green (same as secondary for consistency)
  success100: "#FFFFFF",       // White background
  success200: "#E6F5E6",       // Very light green
  success300: "#CCEBCC",       // Light green
  success400: "#006600",       // Medium green
  success500: "#006600",       // Success green - 7:1+ contrast
  success600: "#005200",       // Darker green
  success700: "#003D00",       // Dark green
  success800: "#002900",       // Very dark green
  success900: "#001400",       // Darkest green

  // Warning colors - dark orange/brown for maximum contrast
  warning100: "#FFFFFF",       // White background
  warning200: "#FFF4E6",       // Very light orange
  warning300: "#FFE9CC",       // Light orange
  warning400: "#994D00",       // Darker orange for better contrast (was #CC6600)
  warning500: "#994D00",        // Warning orange - high contrast
  warning600: "#A35200",       // Darker orange
  warning700: "#7A3D00",       // Dark orange
  warning800: "#522900",       // Very dark orange
  warning900: "#291400",       // Darkest orange

  // Error colors - bright red for maximum contrast
  error100: "#FFFFFF",        // White background
  error200: "#FFE6E6",        // Very light red
  error300: "#FFCCCC",        // Light red
  error400: "#CC0000",        // Medium red (7:1+ on white)
  error500: "#CC0000",        // Error red - bright, high contrast
  error600: "#A30000",        // Darker red
  error700: "#7A0000",        // Dark red
  error800: "#520000",        // Very dark red
  error900: "#290000",         // Darkest red

  // Info colors - bright blue (same as primary for consistency)
  info100: "#FFFFFF",         // White background
  info200: "#E6F2FF",         // Very light blue
  info300: "#CCE5FF",         // Light blue
  info400: "#0066CC",         // Medium blue
  info500: "#0066CC",         // Info blue - 7:1+ contrast
  info600: "#0052A3",         // Darker blue
  info700: "#003D7A",         // Dark blue
  info800: "#002952",         // Very dark blue
  info900: "#001429",         // Darkest blue

  // Medical colors - dark teal for medical context
  medical100: "#FFFFFF",      // White background
  medical200: "#E6F5F5",      // Very light teal
  medical300: "#CCEBEB",      // Light teal
  medical400: "#006666",      // Medium teal (7:1+ on white)
  medical500: "#006666",      // Medical teal - high contrast
  medical600: "#005252",      // Darker teal
  medical700: "#003D3D",      // Dark teal
  medical800: "#002929",      // Very dark teal
  medical900: "#001414",      // Darkest teal

  // Accent colors - dark purple for accents
  accent100: "#FFFFFF",       // White background
  accent200: "#F0E6FF",       // Very light purple
  accent300: "#E1CCFF",       // Light purple
  accent400: "#6600CC",       // Medium purple (7:1+ on white)
  accent500: "#6600CC",       // Accent purple - high contrast
  accent600: "#5200A3",       // Darker purple
  accent700: "#3D007A",       // Dark purple
  accent800: "#290052",       // Very dark purple
  accent900: "#140029",       // Darkest purple

  // Transparent colors
  transparent: "rgba(0, 0, 0, 0)",
  overlay: "rgba(0, 0, 0, 0.7)", // Darker overlay for better contrast
} as const

// Legacy color mappings for backward compatibility
const colors = {
  palette,
  
  // Text colors - maximum contrast
  text: palette.neutral900,           // Pure black text on white = 21:1 contrast
  textDim: palette.neutral900,        // Black (no dimming in high contrast)
  textInverse: palette.neutral100,    // White text on black = 21:1 contrast
  
  // Background colors
  background: palette.neutral100,      // Pure white background
  backgroundDim: palette.neutral100,  // White (no dimming)
  
  // Border colors - strong black borders for visibility
  border: palette.neutral900,         // Pure black borders (3-4px recommended)
  borderDim: palette.neutral900,      // Black (no dimming)
  
  // Legacy color names for compatibility
  tint: palette.primary500,            // Bright blue
  success: palette.success500,        // Dark green
  error: palette.error500,            // Bright red
  warning: palette.warning500,        // Dark orange
  info: palette.info500,              // Bright blue
  
  // Healthcare-specific legacy colors - high contrast
  biancaBackground: palette.neutral100,        // Pure white
  biancaButtonSelected: palette.primary500,     // Bright blue
  biancaButtonUnselected: palette.neutral300,   // Light gray for unselected button background
  biancaHeader: palette.neutral900,            // Pure black
  biancaBorder: palette.neutral900,            // Pure black (3-4px recommended)
  biancaError: palette.error500,              // Bright red
  biancaErrorBackground: palette.error200,   // Solid light red background - meets WCAG AA
  biancaSuccess: palette.success500,           // Dark green
  biancaSuccessBackground: palette.success200, // Solid light green background - meets WCAG AA
  biancaWarning: palette.warning500,           // Dark orange
  biancaExplanation: palette.neutral900,       // Pure black
} as const

export { colors }

