import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react"
import { getDefaultApiConfig } from "./api"
import type { RootState } from "../../store/store"

function isAuthPath(url: string): boolean {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh-tokens") ||
    url.includes("/auth/logout") ||
    url.includes("/auth/invite-info") ||
    url.includes("/auth/registerWithInvite")
  )
}

/**
 * Attaches JWT; on 401 (except auth endpoints) sends user to login.
 */
function baseQueryWithAuth(): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  const baseQuery = fetchBaseQuery({
    baseUrl: getDefaultApiConfig().url,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access?.token
      if (token) headers.set("authorization", `Bearer ${token}`)
      return headers
    },
  })

  return async (args, api, extraOptions) => {
    const result = await baseQuery(args, api, extraOptions)
    if (result.error && result.error.status === 401) {
      const url = typeof args === "string" ? args : (args as FetchArgs).url || ""
      if (!isAuthPath(url)) {
        const path = `${window.location.pathname}${window.location.search}`
        window.location.replace(`/login?next=${encodeURIComponent(path)}&expired=1`)
      }
    }
    return result
  }
}

export default baseQueryWithAuth
