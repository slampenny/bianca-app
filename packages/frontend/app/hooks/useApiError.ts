import { useEffect } from 'react'
import { ApiError, ErrorResponse } from '../types'
import { logger } from '../utils/logger'

/**
 * Extract error message from various error formats
 */
export function extractErrorMessage(error: ApiError | ErrorResponse | string | null | undefined): string {
  if (!error) return 'An error occurred'
  
  if (typeof error === 'string') return error
  
  // RTK Query error format
  if ('data' in error && error.data) {
    const data = error.data as ErrorResponse
    if (data.message) return data.message
    if (typeof data === 'string') return data
  }
  
  // Serialized error format
  if ('message' in error && error.message) {
    return error.message
  }
  
  return 'An error occurred'
}

/**
 * Hook to handle API errors consistently
 * 
 * @param error - The error from RTK Query or API call
 * @param onError - Optional callback when error occurs
 * @param logError - Whether to log the error (default: true)
 */
export function useApiError(
  error: ApiError | ErrorResponse | string | null | undefined,
  onError?: (message: string) => void,
  logError: boolean = true
) {
  useEffect(() => {
    if (error) {
      const message = extractErrorMessage(error)
      
      if (logError) {
        logger.error('API Error:', message, error)
      }
      
      onError?.(message)
    }
  }, [error, onError, logError])
}

