import { useEffect, useRef } from "react"
import { useSelector } from "react-redux"
import { isAuthenticated } from "../store/authSlice"

/**
 * Hook that clears a local error state when authentication succeeds.
 * This is useful for screens that show error messages from 401 responses,
 * so the errors disappear after the user logs in via the auth modal.
 * 
 * @param clearError - Callback function to clear the error state
 * @param error - The current error value (to check if it's a 401 error)
 */
export function useClearErrorsOnAuth<T extends { status?: number } | string | null>(
  clearError: () => void,
  error?: T
) {
  const isAuthenticatedUser = useSelector(isAuthenticated)
  const wasAuthenticatedRef = useRef(false)

  useEffect(() => {
    // If user just became authenticated and we had an error, clear it
    if (isAuthenticatedUser && !wasAuthenticatedRef.current) {
      // Check if error is a 401 or related to authentication
      const isAuthError = 
        (error && typeof error === 'object' && 'status' in error && error.status === 401) ||
        (typeof error === 'string' && (error.toLowerCase().includes('authenticate') || error.toLowerCase().includes('unauthorized')))
      
      if (isAuthError || error) {
        // Clear the error when auth succeeds
        clearError()
      }
    }
    
    wasAuthenticatedRef.current = isAuthenticatedUser
  }, [isAuthenticatedUser, error, clearError])
}

