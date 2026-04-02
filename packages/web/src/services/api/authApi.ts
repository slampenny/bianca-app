import { createApi } from "@reduxjs/toolkit/query/react"
import type {
  ApiAlertRecord,
  AuthTokens,
  Caregiver,
  Client,
  Org,
  RegisterResult,
  VerifyEmailSuccess,
} from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    login: builder.mutation<
      | { org: Org; caregiver: Caregiver; clients: Client[]; alerts: ApiAlertRecord[]; tokens: AuthTokens }
      | { requireMFA: true; tempToken: string; message: string },
      { email: string; password: string; mfaToken?: string }
    >({
      query: (data) => ({
        url: "/auth/login",
        method: "POST",
        body: data,
      }),
    }),

    register: builder.mutation<
      RegisterResult,
      { name: string; email: string; password: string; phone: string; country?: string }
    >({
      query: (body) => ({
        url: "/auth/register",
        method: "POST",
        body,
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

    forgotPassword: builder.mutation<void, { email: string }>({
      query: (body) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body,
      }),
    }),

    resetPassword: builder.mutation<void, { token: string; password: string }>({
      query: ({ token, password }) => ({
        url: "/auth/reset-password",
        method: "POST",
        params: { token },
        body: { password },
      }),
    }),

    resendVerificationEmail: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({
        url: "/auth/resend-verification-email",
        method: "POST",
        body,
      }),
    }),

    verifyEmail: builder.query<VerifyEmailSuccess, { token: string }>({
      query: ({ token }) => ({
        url: "/auth/verify-email",
        method: "GET",
        params: { token },
        headers: { Accept: "application/json" },
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
  }),
})

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetInviteInfoQuery,
  useRegisterWithInviteMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useResendVerificationEmailMutation,
  useVerifyEmailQuery,
  useLogoutMutation,
  useRefreshTokensMutation,
} = authApi
