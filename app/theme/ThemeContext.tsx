import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { colors as healthcareColors } from "./colors"
import { colors as colorblindColors } from "./colors.colorblind"

export type ThemeType = "healthcare" | "colorblind"

export interface Theme {
  name: string
  description: string
  colors: typeof healthcareColors | typeof colorblindColors
  accessibility: {
    wcagLevel: "AA" | "AAA"
    colorblindFriendly: boolean
    highContrast: boolean
    description: string
  }
}

export const themes: Record<ThemeType, Theme> = {
  healthcare: {
    name: "Healthcare",
    description: "Professional medical theme with blue and green colors",
    colors: healthcareColors,
    accessibility: {
      wcagLevel: "AA",
      colorblindFriendly: false,
      highContrast: false,
      description: "Standard healthcare theme with medical blue and green colors"
    }
  },
  colorblind: {
    name: "Color-Blind Friendly",
    description: "High contrast theme optimized for color vision deficiency",
    colors: colorblindColors,
    accessibility: {
      wcagLevel: "AAA",
      colorblindFriendly: true,
      highContrast: true,
      description: "High contrast theme with distinct colors and patterns for users with color vision deficiency"
    }
  }
}

export const defaultTheme: ThemeType = "healthcare"

interface ThemeContextType {
  currentTheme: ThemeType
  setTheme: (theme: ThemeType) => void
  colors: typeof healthcareColors | typeof colorblindColors
  themeInfo: Theme
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = "@myphonefriend_theme"

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(defaultTheme)
  const [isLoading, setIsLoading] = useState(true)

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY)
        if (savedTheme && savedTheme in themes) {
          setCurrentTheme(savedTheme as ThemeType)
        } else {
          // Auto-detect colorblind preference
          const prefersColorblind = detectColorblindPreference()
          setCurrentTheme(prefersColorblind ? "colorblind" : "healthcare")
        }
      } catch (error) {
        console.warn("Failed to load theme:", error)
        setCurrentTheme(defaultTheme)
      } finally {
        setIsLoading(false)
      }
    }
    loadTheme()
  }, [])

  // Save theme to storage when it changes
  const setTheme = async (theme: ThemeType) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme)
      setCurrentTheme(theme)
    } catch (error) {
      console.warn("Failed to save theme:", error)
      setCurrentTheme(theme) // Still update locally even if storage fails
    }
  }

  const currentThemeData = themes[currentTheme]

  const contextValue: ThemeContextType = {
    currentTheme,
    setTheme,
    colors: currentThemeData.colors,
    themeInfo: currentThemeData,
    isLoading,
  }

  if (isLoading) {
    return null // Don't render children until theme is loaded
  }

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

// Auto-detect colorblind preference
export const detectColorblindPreference = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  
  try {
    // Check for prefers-color-scheme: high-contrast
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      return true
    }
    
    // Check for forced-colors media query (Windows High Contrast Mode)
    if (window.matchMedia('(forced-colors: active)').matches) {
      return true
    }
    
    // Check for reduced motion preference (often correlates with accessibility needs)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true
    }
  } catch (error) {
    console.warn("Error detecting colorblind preference:", error)
  }
  
  return false
}