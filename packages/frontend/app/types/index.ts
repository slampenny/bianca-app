/**
 * Shared TypeScript types
 */

import { FetchBaseQueryError, SerializedError } from '@reduxjs/toolkit/query/react'

/**
 * Theme colors type - matches the structure from ThemeContext
 */
export interface ThemeColors {
  palette: {
    biancaBackground: string
    biancaHeader: string
    biancaBorder: string
    biancaError?: string
    biancaSuccess?: string
    biancaWarning?: string
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
    overlay20?: string
    overlay50?: string
    [key: string]: any
  }
  background: string
  text: string
  error: string
  border: string
  [key: string]: any
}

/**
 * API error types
 */
export type ApiError = FetchBaseQueryError | SerializedError

/**
 * Common error response structure
 */
export interface ErrorResponse {
  code?: number
  message?: string
  requiresPasswordLinking?: boolean
  ssoProvider?: string
}

