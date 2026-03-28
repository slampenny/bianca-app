import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const phoneVerificationApi = createApi({
  reducerPath: "phoneVerificationApi",
  baseQuery: baseQueryWithReauth(),
  endpoints: (builder) => ({
    sendPhoneVerificationCode: builder.mutation<
      { success: boolean; message: string; expiresAt: string; phoneNumber: string },
      { phoneNumber?: string }
    >({
      query: (body) => ({
        url: "/phone-verification/send-code",
        method: "POST",
        body,
      }),
    }),
    verifyPhoneCode: builder.mutation<{ success: boolean; message: string }, { code: string }>({
      query: (body) => ({
        url: "/phone-verification/verify",
        method: "POST",
        body,
      }),
    }),
    resendPhoneVerificationCode: builder.mutation<
      { success: boolean; message: string; expiresAt: string; phoneNumber: string },
      void
    >({
      query: () => ({ url: "/phone-verification/resend", method: "POST" }),
    }),
  }),
})

export const {
  useSendPhoneVerificationCodeMutation,
  useVerifyPhoneCodeMutation,
  useResendPhoneVerificationCodeMutation,
} = phoneVerificationApi
