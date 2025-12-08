/**
 * Centralized style utilities for non-Ignite components
 * Following Ignite's pattern: styles accept theme colors and return StyleSheet
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { spacing } from '../theme'
import type { ThemeColors } from '../types'

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
      shadowColor: colors.palette.neutral900,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
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

