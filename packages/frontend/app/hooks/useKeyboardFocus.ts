import { Platform, ViewStyle } from "react-native"
import { useTheme } from "../theme/ThemeContext"

/**
 * Hook to get keyboard focus styles for web accessibility
 * Returns empty styles on mobile (no visual changes)
 * Returns focus styles on web ONLY in high-contrast theme (for WCAG compliance)
 * 
 * WCAG 2.1 AA requires visible focus indicators, but we only show them
 * in high-contrast mode to avoid cluttering the UI in normal themes.
 * Users who need keyboard navigation can switch to high-contrast mode.
 * 
 * @example
 * ```tsx
 * const focusStyle = useKeyboardFocus()
 * <Pressable style={[baseStyle, focusStyle]}>
 * ```
 */
export function useKeyboardFocus(): ViewStyle {
  const { colors, currentTheme } = useTheme()
  
  // Only apply focus styles on web
  if (Platform.OS !== 'web') {
    return {}
  }
  
  // Only show focus outlines in high-contrast theme
  // This keeps the UI clean in normal themes while still meeting WCAG requirements
  // Users who need keyboard navigation can switch to high-contrast mode
  if (currentTheme !== 'highcontrast') {
    return {}
  }
  
  // Web + High Contrast: Add visible focus indicators for keyboard navigation
  return {
    // Use outline for web (better than border for focus)
    outlineWidth: 3,
    outlineColor: colors.palette.primary500,
    outlineStyle: 'solid',
    // Remove default browser outline
    outlineOffset: 2,
  } as ViewStyle
}

/**
 * Get focus styles for a specific color
 * Useful when you want a different focus color than the primary
 * Only shows in high-contrast theme (same as useKeyboardFocus)
 */
export function useKeyboardFocusColor(focusColor?: string): ViewStyle {
  const { colors, currentTheme } = useTheme()
  
  if (Platform.OS !== 'web') {
    return {}
  }
  
  // Only show focus outlines in high-contrast theme
  if (currentTheme !== 'highcontrast') {
    return {}
  }
  
  const color = focusColor || colors.palette.primary500
  
  return {
    outlineWidth: 3,
    outlineColor: color,
    outlineStyle: 'solid',
    outlineOffset: 2,
  } as ViewStyle
}

