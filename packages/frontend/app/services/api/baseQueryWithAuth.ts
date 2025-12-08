import { fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react"
import { DEFAULT_API_CONFIG } from "./api"
import { RootState } from "../../store/store"

// Event emitter for auth modal - we'll use a simple callback pattern
let showAuthModalCallback: ((initialErrorMessage?: string) => void) | null = null

interface PendingRequest {
  args: string | FetchArgs
  api: unknown
  extraOptions: unknown
  resolve: (result: unknown) => void
  reject: (error: unknown) => void
}

let pendingRequests: PendingRequest[] = []
let isAuthModalShowing = false
let initialErrorMessage: string | null = null

export function setShowAuthModalCallback(callback: ((initialErrorMessage?: string) => void) | null) {
  showAuthModalCallback = callback
}

export function getInitialErrorMessage(): string | null {
  return initialErrorMessage
}

export function clearInitialErrorMessage() {
  initialErrorMessage = null
}

export function notifyAuthSuccess() {
  // Retry all pending requests
  const requests = [...pendingRequests]
  pendingRequests = []
  isAuthModalShowing = false
  clearInitialErrorMessage()
  
  // Use setTimeout to ensure this happens after auth state is updated
  setTimeout(() => {
    requests.forEach(async ({ args, api, extraOptions, resolve }) => {
      try {
        // Recreate baseQuery to get fresh token from updated state
        const baseQuery = fetchBaseQuery({
          baseUrl: DEFAULT_API_CONFIG.url,
          prepareHeaders: (headers, { getState }) => {
            const token = (getState() as RootState).auth.tokens?.access?.token
            if (token) {
              headers.set("authorization", `Bearer ${token}`)
            }
            return headers
          },
        })
        const retryResult = await baseQuery(args, api, extraOptions)
        resolve(retryResult)
      } catch (error) {
        resolve({ error: { status: 'FETCH_ERROR', error: String(error) } })
      }
    })
  }, 100) // Small delay to ensure Redux state is updated
}

export function notifyAuthCancelled() {
  // Reject all pending requests
  const requests = [...pendingRequests]
  pendingRequests = []
  isAuthModalShowing = false
  clearInitialErrorMessage()
  
  requests.forEach(({ reject }) => {
    reject({ error: { status: 'CUSTOM_ERROR', error: 'Authentication cancelled' } })
  })
}

// Create the base query with auth handling
function baseQueryWithReauth(
  baseUrl: string = DEFAULT_API_CONFIG.url,
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  const baseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access?.token
      if (token) {
        headers.set("authorization", `Bearer ${token}`)
      }
      return headers
    },
  })

  return async (args, api, extraOptions) => {
    let result = await baseQuery(args, api, extraOptions)

    // If we get a 401, show the login modal
    // BUT: Don't intercept 401s from the login endpoint itself (those are invalid credentials, not expired tokens)
    // Also don't intercept 401s from verify-email endpoint (those are invalid/expired verification tokens, not expired auth tokens)
    if (result.error && result.error.status === 401) {
      // Check if this is the login endpoint - if so, don't intercept (let the error propagate)
      const url = typeof args === 'string' ? args : (args as FetchArgs).url || ''
      const isLoginEndpoint = url.includes('/auth/login') || url.includes('/v1/auth/login')
      const isVerifyEmailEndpoint = url.includes('/auth/verify-email') || url.includes('/v1/auth/verify-email')
      
      if (isLoginEndpoint || isVerifyEmailEndpoint) {
        // Login endpoint 401 = invalid credentials, not expired token
        // Verify-email endpoint 401 = invalid/expired verification token, not expired auth token
        // Let the error propagate so the respective handlers can handle it
        return result
      }
      
      // Extract error message from the 401 response
      const errorMessage = 
        (result.error.data && typeof result.error.data === 'object' && 'message' in result.error.data)
          ? String(result.error.data.message)
          : (result.error.data && typeof result.error.data === 'string')
          ? result.error.data
          : 'Your session has expired. Please sign in again.'
      
      // Only show modal if callback is set (modal is ready)
      if (showAuthModalCallback && !isAuthModalShowing) {
        isAuthModalShowing = true
        // Store the initial error message
        initialErrorMessage = errorMessage
        // Show the modal immediately with the error message
        showAuthModalCallback(errorMessage)
        
        // Return a promise that will resolve when auth succeeds
        return new Promise((resolve, reject) => {
          // Store the request info for retry
          pendingRequests.push({ args, api, extraOptions, resolve, reject })
        })
      } else if (isAuthModalShowing) {
        // Modal is already showing, just queue this request
        // Don't update the initial error message - keep the original one
        return new Promise((resolve, reject) => {
          pendingRequests.push({ args, api, extraOptions, resolve, reject })
        })
      }
      // If modal isn't ready yet, just return the error
      return result
    }

    return result
  }
}

export default baseQueryWithReauth

