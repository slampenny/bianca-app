import {
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react"
import { getDefaultApiConfig } from "./api"
import type { RootState } from "../../store/store"

type FetchBaseQueryImpl = ReturnType<typeof fetchBaseQuery>
type BaseQueryApi = Parameters<FetchBaseQueryImpl>[1]

interface PendingRequest {
  args: string | FetchArgs
  api: BaseQueryApi
  extraOptions: unknown
  resolve: (result: unknown) => void
  reject: (error: unknown) => void
}

let pendingRequests: PendingRequest[] = []
let isSessionPromptActive = false
let sessionExpiredMessage: string | null = null

const AUTH_MODAL_COOLDOWN_MS = 60_000
let lastSessionPromptAt = 0

let onSessionExpired: ((message?: string) => void) | null = null

export function setSessionExpiredHandler(handler: ((message?: string) => void) | null) {
  onSessionExpired = handler
}

export function getSessionExpiredMessage(): string | null {
  return sessionExpiredMessage
}

export function clearSessionExpiredMessage() {
  sessionExpiredMessage = null
}

export function notifyAuthSuccess() {
  const requests = [...pendingRequests]
  pendingRequests = []
  isSessionPromptActive = false
  lastSessionPromptAt = 0
  clearSessionExpiredMessage()

  setTimeout(() => {
    requests.forEach(async ({ args, api, extraOptions, resolve }) => {
      try {
        const baseQuery = fetchBaseQuery({
          baseUrl: getDefaultApiConfig().url,
          prepareHeaders: (headers, { getState }) => {
            const token = (getState() as RootState).auth.tokens?.access?.token
            if (token) headers.set("authorization", `Bearer ${token}`)
            return headers
          },
        })
        const retryResult = await baseQuery(args, api, extraOptions)
        resolve(retryResult)
      } catch (error) {
        resolve({ error: { status: "FETCH_ERROR", error: String(error) } })
      }
    })
  }, 100)
}

export function notifyAuthCancelled() {
  const requests = [...pendingRequests]
  pendingRequests = []
  isSessionPromptActive = false
  clearSessionExpiredMessage()
  requests.forEach(({ reject }) => {
    reject({ error: { status: "CUSTOM_ERROR", error: "Authentication cancelled" } })
  })
}

function baseQueryWithReauth(
  baseUrl: string | null = null,
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  const effectiveBaseUrl = baseUrl || getDefaultApiConfig().url
  const baseQuery = fetchBaseQuery({
    baseUrl: effectiveBaseUrl,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access?.token
      if (token) headers.set("authorization", `Bearer ${token}`)
      return headers
    },
  })

  return async (args, api, extraOptions) => {
    let result = await baseQuery(args, api, extraOptions)

    if (result.error && result.error.status === 401) {
      const url = typeof args === "string" ? args : (args as FetchArgs).url || ""
      const isLoginEndpoint = url.includes("/auth/login") || url.includes("/v1/auth/login")
      const isVerifyEmailEndpoint =
        url.includes("/auth/verify-email") || url.includes("/v1/auth/verify-email")
      const isRefreshTokensEndpoint =
        url.includes("/auth/refresh-tokens") || url.includes("/v1/auth/refresh-tokens")
      const isLogoutEndpoint = url.includes("/auth/logout") || url.includes("/v1/auth/logout")

      if (
        isLoginEndpoint ||
        isVerifyEmailEndpoint ||
        isRefreshTokensEndpoint ||
        isLogoutEndpoint
      ) {
        return result
      }

      const errorMessage =
        result.error.data && typeof result.error.data === "object" && "message" in result.error.data
          ? String((result.error.data as { message: string }).message)
          : result.error.data && typeof result.error.data === "string"
            ? result.error.data
            : "Your session has expired. Please sign in again."

      const now = Date.now()
      const inCooldown = now - lastSessionPromptAt < AUTH_MODAL_COOLDOWN_MS
      if (onSessionExpired && !isSessionPromptActive && !inCooldown) {
        isSessionPromptActive = true
        lastSessionPromptAt = now
        sessionExpiredMessage = errorMessage
        onSessionExpired(errorMessage)
        return new Promise((resolve, reject) => {
          pendingRequests.push({ args, api, extraOptions, resolve, reject })
        })
      }
      if (isSessionPromptActive) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({ args, api, extraOptions, resolve, reject })
        })
      }
      return result
    }

    return result
  }
}

export default baseQueryWithReauth
