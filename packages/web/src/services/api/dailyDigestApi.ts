import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

/** Row for one resident in a caregiver daily digest (payload from API is already localized). */
export type CaregiverDailyDigestEntry = {
  clientId: string
  clientName: string
  clientPreferredLanguage: string
  caregiverPreferredLanguage: string
  languageMismatch: boolean
  languageMismatchExplanation: string | null
  conversationSummaryShort: string | null
  sentiment: Record<string, unknown> | null
  callsPlaced: number
  answeredCalls: number
  lastCallAt: string | null
}

export type CaregiverDailyDigestPayload = {
  version: number
  title: string
  subtitle: string
  dateLabel: string
  digestDateUtc: string
  labels: {
    conversationSummary: string
    sentiment: string
    callsToday: string
    noActivity: string
    emailSoon: string
  }
  entries: CaregiverDailyDigestEntry[]
  generatedAt: string
}

export type CaregiverDailyDigest = {
  id: string
  org: string
  caregiver: string
  digestDate: string
  locale: string
  status: string
  payload: CaregiverDailyDigestPayload
  createdAt?: string
  updatedAt?: string
}

export type CaregiverDailyDigestPages = {
  results: CaregiverDailyDigest[]
  page?: number
  limit?: number
  totalPages?: number
  totalResults?: number
}

export const dailyDigestApi = createApi({
  reducerPath: "dailyDigestApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["CaregiverDailyDigest"],
  endpoints: (builder) => ({
    listCaregiverDailyDigests: builder.query<
      CaregiverDailyDigestPages,
      { caregiverId?: string; digestDate?: string; limit?: number; page?: number; sortBy?: string }
    >({
      query: (params) => ({
        url: "/caregiver-daily-digests",
        method: "GET",
        params,
      }),
      providesTags: ["CaregiverDailyDigest"],
    }),
    getCaregiverDailyDigest: builder.query<CaregiverDailyDigest, { digestId: string }>({
      query: ({ digestId }) => `/caregiver-daily-digests/${digestId}`,
      providesTags: (_r, _e, { digestId }) => [{ type: "CaregiverDailyDigest", id: digestId }],
    }),
    generateCaregiverDailyDigest: builder.mutation<CaregiverDailyDigest, { digestDate?: string }>({
      query: (body) => ({
        url: "/caregiver-daily-digests",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CaregiverDailyDigest"],
    }),
  }),
})

export const {
  useListCaregiverDailyDigestsQuery,
  useGetCaregiverDailyDigestQuery,
  useGenerateCaregiverDailyDigestMutation,
} = dailyDigestApi
