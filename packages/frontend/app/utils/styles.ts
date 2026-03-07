/**
 * Centralized style utilities for non-Ignite components
 * Following Ignite's pattern: styles accept theme colors and return StyleSheet
 */

import { StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native'
import { spacing } from '../theme'
import type { ThemeColors } from '../types'

/**
 * Platform-aware shadow: use boxShadow on web (shadow* are deprecated), shadow* on native.
 */
export function platformShadow(opts: {
  color?: string
  offset?: { width: number; height: number }
  opacity?: number
  radius?: number
}): ViewStyle {
  const { color = '#000', offset = { width: 0, height: 2 }, opacity = 0.1, radius = 4 } = opts
  if (Platform.OS === 'web') {
    const [r, g, b] = color.startsWith('#') && color.length === 7
      ? [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)]
      : [0, 0, 0]
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px rgba(${r},${g},${b},${opacity})`,
    } as ViewStyle
  }
  return {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
  }
}

/**
 * Common styles used across multiple screens
 * These are for cases where Ignite components don't exist
 */
export const createCommonStyles = (colors: ThemeColors) => {
  return StyleSheet.create({
    // Container styles
    container: {
      backgroundColor: colors.palette.biancaBackground,
      flex: 1,
    } as ViewStyle,

    contentContainer: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    } as ViewStyle,

    scrollView: {
      flex: 1,
    } as ViewStyle,

    // Card/Form styles
    formCard: {
      backgroundColor: colors.palette.neutral100,
      borderRadius: spacing.sm,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...platformShadow({
        color: colors.palette.neutral900,
        offset: { width: 0, height: 2 },
        opacity: 0.1,
        radius: 4,
      }),
      elevation: 3,
    } as ViewStyle,

    // Error styles
    error: {
      color: colors.palette.angry500 || colors.error,
      textAlign: 'center',
      marginBottom: spacing.md,
      fontSize: 15,
      fontWeight: '500',
      backgroundColor: colors.palette.angry100,
      padding: spacing.sm,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.palette.overlay20,
    } as TextStyle,

    fieldError: {
      color: colors.palette.angry500 || colors.error,
      fontSize: 13,
      marginBottom: spacing.sm,
      paddingLeft: spacing.xs,
    } as TextStyle,

    // Success styles
    success: {
      color: colors.palette.biancaSuccess || colors.palette.success500,
      fontSize: 16,
      marginBottom: spacing.sm,
      textAlign: 'center',
    } as TextStyle,

    // Input container styles
    inputContainer: {
      marginBottom: spacing.md,
    } as ViewStyle,

    // Button styles (for cases where Button component isn't used)
    button: {
      alignItems: 'center',
      borderRadius: 5,
      marginBottom: spacing.md,
      paddingVertical: spacing.md,
      justifyContent: 'center',
      minHeight: 50,
    } as ViewStyle,

    buttonDisabled: {
      opacity: 0.5,
      backgroundColor: colors.palette.neutral300,
    } as ViewStyle,

    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    } as TextStyle,

    // Header styles
    header: {
      alignItems: 'center',
      backgroundColor: colors.palette.neutral100,
      borderBottomWidth: 1,
      borderColor: colors.palette.biancaBorder,
      marginBottom: spacing.lg,
      paddingVertical: spacing.md,
    } as ViewStyle,

    headerTitle: {
      color: colors.palette.biancaHeader || colors.text,
      fontSize: 24,
      fontWeight: '600',
    } as TextStyle,

    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.palette.biancaHeader || colors.text,
      marginBottom: spacing.md,
    } as TextStyle,
  })
}

/**
 * Helper to get theme-aware color with fallback
 */
export const getThemeColor = (
  colors: ThemeColors,
  path: string,
  fallback: string
): string => {
  const keys = path.split('.')
  let value: unknown = colors
  for (const key of keys) {
    if (typeof value === 'object' && value !== null && key in value) {
      value = (value as Record<string, unknown>)[key]
    } else {
      return fallback
    }
    if (value === undefined) return fallback
  }
  return typeof value === 'string' ? value : fallback
}

