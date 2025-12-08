import { useTheme } from "../theme/ThemeContext"

/**
 * Hook to get font scale and utility functions for scaling font sizes
 * Use this in components that have hardcoded fontSize values
 */
export function useFontScale() {
  const { fontScale } = useTheme()
  
  /**
   * Scale a font size by the current font scale
   * @param size - Base font size (e.g., 16)
   * @returns Scaled font size (e.g., 16 * 1.5 = 24 if fontScale is 1.5)
   */
  const scale = (size: number): number => {
    return size * fontScale
  }
  
  /**
   * Scale both fontSize and lineHeight proportionally
   * @param fontSize - Base font size
   * @param lineHeight - Base line height (optional, defaults to fontSize * 1.25)
   * @returns Object with scaled fontSize and lineHeight
   */
  const scaleWithLineHeight = (fontSize: number, lineHeight?: number): { fontSize: number; lineHeight: number } => {
    const baseLineHeight = lineHeight || fontSize * 1.25
    return {
      fontSize: fontSize * fontScale,
      lineHeight: baseLineHeight * fontScale,
    }
  }
  
  return {
    fontScale,
    scale,
    scaleWithLineHeight,
  }
}

