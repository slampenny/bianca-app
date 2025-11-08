import { fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react"
import { DEFAULT_API_CONFIG } from "./api"
import { RootState } from "../../store/store"

// Event emitter for auth modal - we'll use a simple callback pattern
let showAuthModalCallback: (() => void) | null = null

interface PendingRequest {
  args: string | FetchArgs
  api: unknown
  extraOptions: unknown
  resolve: (result: unknown) => void
  reject: (error: unknown) => void
}

let pendingRequests: PendingRequest[] = []
let isAuthModalShowing = false

export function setShowAuthModalCallback(callback: (() => void) | null) {
  showAuthModalCallback = callback
}

export function notifyAuthSuccess() {
  // Retry all pending requests
  const requests = [...pendingRequests]
  pendingRequests = []
  isAuthModalShowing = false
  
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
    if (result.error && result.error.status === 401) {
      // Only show modal if callback is set (modal is ready)
      if (showAuthModalCallback && !isAuthModalShowing) {
        isAuthModalShowing = true
        // Show the modal immediately
        showAuthModalCallback()
        
        // Return a promise that will resolve when auth succeeds
        return new Promise((resolve, reject) => {
          // Store the request info for retry
          pendingRequests.push({ args, api, extraOptions, resolve, reject })
        })
      } else if (isAuthModalShowing) {
        // Modal is already showing, just queue this request
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

