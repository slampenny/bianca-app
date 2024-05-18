import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { Org, Caregiver } from './api.types';
import type { AuthTokens } from '../../store/authSlice'

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({ baseUrl: DEFAULT_API_CONFIG.url }),
  endpoints: (builder) => ({
    register: builder.mutation<{org: Org, tokens: any}, { name: string, email: string, password: string, phone: string }>({
      query: (data) => ({
        url: '/auth/register',
        method: 'POST',
        body: data,
      }),
    }),
    login: builder.mutation<{caregiver: Caregiver, tokens: any}, { email: string, password: string }>({
      query: (data) => ({
        url: '/auth/login',
        method: 'POST',
        body: data,
      }),
    }),
    logout: builder.mutation({
      query: (authTokens: AuthTokens | null) => {
        if (authTokens === null) {
          throw new Error("No auth tokens provided");
        }
        return {
          url: '/auth/logout',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authTokens.access.token}`, // Include the authToken in the request headers
          },
          body: { refreshToken: authTokens.refresh.token },
        }
      }
    }),
    refreshTokens: builder.mutation<{ tokens: any }, { refreshToken: string }>({
      query: ({ refreshToken }) => ({
        url: '/auth/refresh-tokens',
        method: 'POST',
        body: { refreshToken },
      }),
    }),
    forgotPassword: builder.mutation<void, { email: string }>({
      query: (data) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: data,
      }),
    }),
    resetPassword: builder.mutation<void, { password: string }>({
      query: (data) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body: data,
      }),
    }),
    sendVerificationEmail: builder.mutation<void, Caregiver>({
      query: (data) => ({
        url: '/auth/send-verification-email',
        method: 'POST',
        body: data,
      }),
    }),
    verifyEmail: builder.mutation<void, { token: string }>({
      query: (data) => ({
        url: '/auth/verify-email',
        method: 'POST',
        body: data,
      }),
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokensMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useSendVerificationEmailMutation,
  useVerifyEmailMutation,
} = authApi;