import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { DEFAULT_API_CONFIG } from './api';
import { Org, Caregiver, AuthTokens } from './api.types';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({ 
    baseUrl: DEFAULT_API_CONFIG.url
  }),
  endpoints: (builder) => ({
    register: builder.mutation<{org: Org, caregiver: Caregiver, tokens: any}, { name: string, email: string, password: string, phone: string }>({
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
    logout: builder.mutation<void, { refreshToken: string }>({
      query: ({refreshToken}) => {
        return {
          url: '/auth/logout',
          method: 'POST',
          body: { refreshToken },
        }
      }
    }),
    refreshTokens: builder.mutation<{ tokens: AuthTokens }, { refreshToken: string }>({
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
    //this is backend functionality, not frontend
    // resetPassword: builder.mutation<void, { token: string, password: string }>({
    //   query: ({token, password}) => ({
    //     url: `/auth/reset-password?token=${token}`,
    //     method: 'POST',
    //     body: password,
    //   }),
    // }),
    sendVerificationEmail: builder.mutation<void, Caregiver>({
      query: (caregiver) => ({
        url: '/auth/send-verification-email',
        method: 'POST',
        body: {caregiver},
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
  useSendVerificationEmailMutation,
} = authApi;