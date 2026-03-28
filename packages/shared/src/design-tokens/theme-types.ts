/**
 * Theme contracts shared by mobile (ThemeContext) and web (CSS variables).
 * Aligns with packages/mobile ThemeContext + semantic color bundles.
 */
export type ThemeType = "healthcare" | "colorblind" | "dark" | "highcontrast"

export interface ThemeColors {
  palette: {
    biancaBackground: string
    biancaHeader: string
    biancaBorder: string
    biancaError?: string
    biancaSuccess?: string
    biancaWarning?: string
    biancaPrimary?: string
    neutral100: string
    neutral200: string
    neutral300: string
    neutral600: string
    neutral700: string
    neutral800: string
    neutral900: string
    angry100: string
    angry500: string
    success500?: string
    warning500?: string
    primary500?: string
    overlay20?: string
    overlay50?: string
    [key: string]: any
  }
  background: string
  text: string
  error: string
  border: string
  backgroundDim?: string
  transparent?: string
  [key: string]: any
}

export interface Theme {
  name: string
  description: string
  colors: ThemeColors
  accessibility: {
    wcagLevel: "AA" | "AAA"
    colorblindFriendly: boolean
    highContrast: boolean
    darkMode: boolean
    description: string
  }
}
