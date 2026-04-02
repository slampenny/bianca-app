import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { themes, defaultThemeType } from "@bianca-app/shared"
import { logger } from "../utils/logger"
import type { ThemeColors, Theme, ThemeType } from "@bianca-app/shared"

export type { ThemeType, Theme }
export { themes, defaultThemeType }

export const defaultTheme: ThemeType = defaultThemeType

interface ThemeContextType {
  currentTheme: ThemeType
  setTheme: (theme: ThemeType) => void
  colors: ThemeColors
  themeInfo: Theme
  isLoading: boolean
  fontScale: number
  setFontScale: (scale: number) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = "@myphonefriend_theme"
const FONT_SCALE_STORAGE_KEY = "@myphonefriend_font_scale"

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(defaultTheme)
  const [fontScale, setFontScaleState] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState(true)

  // Load theme and font scale from storage on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Load theme
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY)
        if (savedTheme && savedTheme in themes) {
          setCurrentTheme(savedTheme as ThemeType)
        } else {
          // Auto-detect colorblind preference
          const prefersColorblind = detectColorblindPreference()
          setCurrentTheme(prefersColorblind ? "colorblind" : "healthcare")
        }
        
        // Load font scale
        const savedFontScale = await AsyncStorage.getItem(FONT_SCALE_STORAGE_KEY)
        if (savedFontScale) {
          const scale = parseFloat(savedFontScale)
          if (!isNaN(scale) && scale >= 0.8 && scale <= 2.0) {
            setFontScaleState(scale)
          }
        }
      } catch (error) {
        logger.warn("Failed to load preferences:", error)
        setCurrentTheme(defaultTheme)
      } finally {
        setIsLoading(false)
      }
    }
    loadPreferences()
  }, [])

  // Save theme to storage when it changes
  const setTheme = async (theme: ThemeType) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme)
      setCurrentTheme(theme)
    } catch (error) {
      logger.warn("Failed to save theme:", error)
      setCurrentTheme(theme) // Still update locally even if storage fails
    }
  }

  // Save font scale to storage when it changes
  const setFontScale = async (scale: number) => {
    try {
      // Clamp between 0.8 and 2.0
      const clampedScale = Math.max(0.8, Math.min(2.0, scale))
      await AsyncStorage.setItem(FONT_SCALE_STORAGE_KEY, clampedScale.toString())
      setFontScaleState(clampedScale)
    } catch (error) {
      logger.warn("Failed to save font scale:", error)
      setFontScaleState(scale) // Still update locally even if storage fails
    }
  }

  const currentThemeData = themes[currentTheme]

  const contextValue: ThemeContextType = {
    currentTheme,
    setTheme,
    colors: currentThemeData.colors,
    themeInfo: currentThemeData,
    isLoading,
    fontScale,
    setFontScale,
  }

  // Always render children with theme context, even during loading
  // This prevents components from crashing when they use useTheme()
  // The theme will update once loading completes
  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    // Return default theme if context is not available (e.g., during initialization)
    // This prevents crashes when components render before ThemeProvider is mounted
    const defaultThemeData = themes[defaultTheme]
    return {
      currentTheme: defaultTheme,
      setTheme: () => {
        logger.warn("setTheme called outside ThemeProvider")
      },
      colors: defaultThemeData.colors,
      themeInfo: defaultThemeData,
      isLoading: true,
      fontScale: 1.0,
      setFontScale: () => {
        logger.warn("setFontScale called outside ThemeProvider")
      },
    }
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
    logger.warn("Error detecting colorblind preference:", error)
  }
  
  return false
}