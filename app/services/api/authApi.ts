import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { DEFAULT_API_CONFIG } from "./api"
import { Alert, Org, Caregiver, Patient, AuthTokens } from "./api.types"

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: DEFAULT_API_CONFIG.url,
  }),
  endpoints: (builder) => ({
    register: builder.mutation<
      { message: string; caregiver: Caregiver; requiresEmailVerification: boolean },
      { name: string; email: string; password: string; phone: string }
    >({
      query: (data) => ({
        url: "/auth/register",
        method: "POST",
        body: data,
      }),
    }),
    registerWithInvite: builder.mutation<
      { caregiver: Caregiver; tokens: any },
      { token: string; password: string }
    >({
      query: (data) => ({
        url: "/auth/registerWithInvite",
        method: "POST",
        body: data,
      }),
    }),
    login: builder.mutation<
      { org: Org; caregiver: Caregiver; patients: Patient[]; alerts: Alert[]; tokens: any },
      { email: string; password: string }
    >({
      query: (data) => ({
        url: "/auth/login",
        method: "POST",
        body: data,
      }),
    }),
    logout: builder.mutation<void, { refreshToken: string }>({
      query: ({ refreshToken }) => {
        return {
          url: "/auth/logout",
          method: "POST",
          body: { refreshToken },
        }
      },
    }),
    refreshTokens: builder.mutation<{ tokens: AuthTokens }, { refreshToken: string }>({
      query: ({ refreshToken }) => ({
        url: "/auth/refresh-tokens",
        method: "POST",
        body: { refreshToken },
      }),
    }),
    forgotPassword: builder.mutation<void, { email: string }>({
      query: (data) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body: data,
      }),
    }),
    resetPassword: builder.mutation<void, { token: string; password: string }>({
      query: ({ token, password }) => ({
        url: `/auth/reset-password?token=${token}`,
        method: "POST",
        body: password,
      }),
    }),
    sendVerificationEmail: builder.mutation<void, Caregiver>({
      query: (caregiver) => ({
        url: "/auth/send-verification-email",
        method: "POST",
        body: { caregiver },
      }),
    }),
    resendVerificationEmail: builder.mutation<{ message: string }, { email: string }>({
      query: (data) => ({
        url: "/auth/resend-verification-email",
        method: "POST",
        body: data,
      }),
    }),
    setPasswordForSSO: builder.mutation<{ message: string; success: boolean }, { email: string; password: string; confirmPassword: string }>({
      query: (data) => ({
        url: "/auth/set-password-for-sso",
        method: "POST",
        body: data,
      }),
    }),
  }),
})

export const {
  useRegisterMutation,
  useRegisterWithInviteMutation,
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokensMutation,
  useResetPasswordMutation,
  useForgotPasswordMutation,
  useSendVerificationEmailMutation,
  useResendVerificationEmailMutation,
  useSetPasswordForSSOMutation,
} = authApi
