/**
 * Shared TypeScript types
 */

import { FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import type { SerializedError } from '@reduxjs/toolkit'

export type { ThemeColors, Theme, ThemeType } from "@bianca-app/shared"

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

