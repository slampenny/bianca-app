import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { DEFAULT_API_CONFIG } from "./api"

export interface MFAStatus {
  mfaEnabled: boolean
  mfaEnrolledAt?: string
  backupCodesRemaining: number
}

export interface EnableMFAResponse {
  message: string
  qrCode: string // Base64 encoded QR code image
  secret: string // Secret key for manual entry
  backupCodes: string[] // Backup codes (only shown once)
}

export interface VerifyMFAResponse {
  message: string
  mfaEnabled: boolean
}

export interface RegenerateBackupCodesResponse {
  message: string
  backupCodes: string[]
}

export const mfaApi = createApi({
  reducerPath: "mfaApi",
  baseQuery: baseQueryWithReauth(DEFAULT_API_CONFIG.url),
  tagTypes: ["MFAStatus"],
  endpoints: (builder) => ({
    getMFAStatus: builder.query<MFAStatus, void>({
      query: () => "/mfa/status",
      providesTags: ["MFAStatus"],
    }),
    enableMFA: builder.mutation<EnableMFAResponse, void>({
      query: () => ({
        url: "/mfa/enable",
        method: "POST",
      }),
      invalidatesTags: ["MFAStatus"],
    }),
    verifyAndEnableMFA: builder.mutation<VerifyMFAResponse, { token: string }>({
      query: ({ token }) => ({
        url: "/mfa/verify",
        method: "POST",
        body: { token },
      }),
      invalidatesTags: ["MFAStatus"],
    }),
    disableMFA: builder.mutation<VerifyMFAResponse, { token: string }>({
      query: ({ token }) => ({
        url: "/mfa/disable",
        method: "POST",
        body: { token },
      }),
      invalidatesTags: ["MFAStatus"],
    }),
    regenerateBackupCodes: builder.mutation<RegenerateBackupCodesResponse, { token: string }>({
      query: ({ token }) => ({
        url: "/mfa/backup-codes",
        method: "POST",
        body: { token },
      }),
    }),
  }),
})

export const {
  useGetMFAStatusQuery,
  useEnableMFAMutation,
  useVerifyAndEnableMFAMutation,
  useDisableMFAMutation,
  useRegenerateBackupCodesMutation,
} = mfaApi

