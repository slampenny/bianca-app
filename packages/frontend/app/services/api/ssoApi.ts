import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { DEFAULT_API_CONFIG } from "./api"
import { Caregiver, Org, AuthTokens } from "./api.types"

export interface SSOLoginRequest {
  provider: 'google' | 'microsoft'
  email: string
  name: string
  id: string
  picture?: string
}

export interface SSOLoginResponse {
  success: boolean
  message: string
  tokens: AuthTokens
  user: Caregiver
  org?: Org
}

export interface SSOVerifyRequest {
  provider: 'google' | 'microsoft'
  token: string
}

export interface SSOVerifyResponse {
  success: boolean
  userInfo: {
    id: string
    email: string
    name: string
    picture?: string
  }
}

export const ssoApi = createApi({
  reducerPath: "ssoApi",
  baseQuery: baseQueryWithReauth(DEFAULT_API_CONFIG.url),
  endpoints: (builder) => ({
    ssoLogin: builder.mutation<SSOLoginResponse, SSOLoginRequest>({
      query: (data) => ({
        url: "/sso/login",
        method: "POST",
        body: data,
      }),
    }),
    ssoVerify: builder.mutation<SSOVerifyResponse, SSOVerifyRequest>({
      query: (data) => ({
        url: "/sso/verify",
        method: "POST",
        body: data,
      }),
    }),
  }),
})

export const {
  useSSOLoginMutation,
  useSSOVerifyMutation,
} = ssoApi

