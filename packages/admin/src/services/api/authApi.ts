import { createApi } from "@reduxjs/toolkit/query/react"
import type { AuthTokens, Caregiver, Org } from "./api.types"
import baseQueryWithAuth from "./baseQueryWithAuth"

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: baseQueryWithAuth(),
  endpoints: (builder) => ({
    login: builder.mutation<
      | { org?: Org; caregiver: Caregiver; tokens: AuthTokens }
      | { requireMFA: true; tempToken: string; message: string },
      { email: string; password: string; mfaToken?: string }
    >({
      query: (data) => ({
        url: "/auth/login",
        method: "POST",
        body: data,
      }),
    }),
    logout: builder.mutation<void, { refreshToken: string }>({
      query: ({ refreshToken }) => ({
        url: "/auth/logout",
        method: "POST",
        body: { refreshToken },
      }),
    }),
    refreshTokens: builder.mutation<{ tokens: AuthTokens }, { refreshToken: string }>({
      query: ({ refreshToken }) => ({
        url: "/auth/refresh-tokens",
        method: "POST",
        body: { refreshToken },
      }),
    }),
    getInviteInfo: builder.query<{ name: string; email: string; phone: string }, { token: string }>({
      query: ({ token }) => ({
        url: "/auth/invite-info",
        params: { token },
      }),
    }),
    registerWithInvite: builder.mutation<
      { caregiver: Caregiver; tokens: AuthTokens },
      { token: string; password: string; name: string; email: string; phone: string }
    >({
      query: (body) => ({
        url: "/auth/registerWithInvite",
        method: "POST",
        body,
      }),
    }),
  }),
})

export const {
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokensMutation,
  useGetInviteInfoQuery,
  useRegisterWithInviteMutation,
} = authApi
