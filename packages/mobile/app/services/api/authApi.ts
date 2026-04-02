import { createApi } from "@reduxjs/toolkit/query/react"
import { getDefaultApiConfig } from "./api"
import { Alert, Org, Caregiver, Client, AuthTokens, OnboardingPersona } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: baseQueryWithReauth(), // Use null to get dynamic Config.API_URL
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
    getInviteInfo: builder.query<
      { name: string; email: string; phone: string },
      { token: string }
    >({
      query: ({ token }) => ({
        url: `/auth/invite-info?token=${encodeURIComponent(token)}`,
        method: "GET",
      }),
    }),
    registerWithInvite: builder.mutation<
      { caregiver: Caregiver; tokens: any },
      { token: string; password: string; name: string; email: string; phone: string }
    >({
      query: (data) => ({
        url: "/auth/registerWithInvite",
        method: "POST",
        body: data,
      }),
    }),
    login: builder.mutation<
      { org: Org; caregiver: Caregiver; clients: Client[]; alerts: Alert[]; tokens: any } | { requireMFA: true; tempToken: string; message: string },
      { email: string; password: string; mfaToken?: string }
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
        body: { password },
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
    completeOnboarding: builder.mutation<
      { caregiver: Caregiver; message: string },
      { persona: OnboardingPersona; acceptTerms: boolean; singleConsentState?: boolean }
    >({
      query: (data) => ({
        url: "/auth/onboarding/complete",
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
    verifyEmail: builder.mutation<{ 
      success: boolean; 
      message?: string; 
      html?: string;
      caregiver?: any;
      tokens?: any;
      org?: any;
      clients?: any[];
    }, { token: string }>({
      query: ({ token }) => ({
        url: `/auth/verify-email?token=${encodeURIComponent(token)}`,
        method: "GET",
        headers: {
          'Accept': 'application/json',
        },
        responseHandler: async (response) => {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            // Backend returns JSON with tokens for auto-login
            const json = await response.json()
            return { 
              success: json.success || response.ok, 
              message: json.message || json.error, // Backend returns 'error' field on failure
              error: json.error, // Also include error field directly
              caregiver: json.caregiver,
              tokens: json.tokens,
              org: json.org,
              clients: json.clients,
              status: response.status 
            }
          } else {
            // Backend returns HTML (fallback for direct link clicks)
            const text = await response.text()
            return { success: response.ok, html: text, status: response.status }
          }
        },
        validateStatus: (response, result) => {
          // Accept all responses (including errors) so we can parse HTML or JSON
          return true
        },
      }),
    }),
    sendPhoneVerificationCode: builder.mutation<
      { success: boolean; message: string; expiresAt: string; phoneNumber: string },
      { phoneNumber?: string }
    >({
      query: (data) => ({
        url: "/phone-verification/send-code",
        method: "POST",
        body: data,
      }),
    }),
    verifyPhoneCode: builder.mutation<
      { success: boolean; message: string },
      { code: string }
    >({
      query: (data) => ({
        url: "/phone-verification/verify",
        method: "POST",
        body: data,
      }),
    }),
    resendPhoneVerificationCode: builder.mutation<
      { success: boolean; message: string; expiresAt: string; phoneNumber: string },
      void
    >({
      query: () => ({
        url: "/phone-verification/resend",
        method: "POST",
      }),
    }),
  }),
})

export const {
  useRegisterMutation,
  useGetInviteInfoQuery,
  useRegisterWithInviteMutation,
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokensMutation,
  useResetPasswordMutation,
  useForgotPasswordMutation,
  useSendVerificationEmailMutation,
  useResendVerificationEmailMutation,
  useCompleteOnboardingMutation,
  useSetPasswordForSSOMutation,
  useVerifyEmailMutation,
  useSendPhoneVerificationCodeMutation,
  useVerifyPhoneCodeMutation,
  useResendPhoneVerificationCodeMutation,
} = authApi
