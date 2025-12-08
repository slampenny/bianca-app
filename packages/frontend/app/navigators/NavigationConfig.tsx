import { DefaultTheme, DarkTheme } from "@react-navigation/native"
import { ThemeType } from "app/theme/ThemeContext"

// Get navigation theme based on current app theme and colors
export function getNavigationTheme(currentTheme: ThemeType, colors: any) {
  const isDarkTheme = currentTheme === "dark"
  
  if (isDarkTheme) {
    return {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: colors.palette.primary500,
        background: colors.palette.biancaBackground || colors.background, // Use theme-aware background
        card: colors.palette.neutral100, // Card background (black in dark mode)
        text: colors.text || colors.palette.biancaHeader, // Theme-aware text
        border: colors.palette.biancaBorder || colors.border, // Theme-aware border
      },
    }
  } else {
    // Light themes (healthcare, colorblind)
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.tint || colors.palette.primary500,
        background: colors.palette.biancaBackground || colors.background, // Use theme-aware background
        card: colors.palette.neutral100, // Card background (white in light mode)
        text: colors.text || colors.palette.biancaHeader, // Theme-aware text
        border: colors.palette.biancaBorder || colors.border, // Theme-aware border
      },
    }
  }
}

export const screenOptions = {
  headerShown: false,
}
