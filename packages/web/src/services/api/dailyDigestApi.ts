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
  digestDayStartIso?: string
  /** @deprecated Legacy payloads only; prefer digestDayStartIso */
  digestDateUtc?: string
  /** Org-local calendar date YYYY-MM-DD (also on digest root) */
  localDateKey?: string
  /** IANA timezone snapshot when payload was built */
  timezone?: string
  /** True when PHI was redacted for compliance */
  phiRedacted?: boolean
  labels: {
    conversationSummary: string
    sentiment: string
    callsToday: string
    noActivity: string
    emailScreenHint: string
  }
  entries: CaregiverDailyDigestEntry[]
  generatedAt: string
}

export type CaregiverDailyDigest = {
  id: string
  org: string
  caregiver: string
  digestDate: string
  /** Org-local calendar date YYYY-MM-DD */
  localDateKey?: string | null
  /** IANA timezone snapshot when the digest was built */
  timezoneAtBuild?: string | null
  legacyUtcDay?: boolean
  version?: number
  builtAt?: string
  locale: string
  status: "draft" | "sent" | string
  payload: CaregiverDailyDigestPayload
  payloadHash?: string | null
  sentAt?: string | null
  sentPayloadHash?: string | null
  emailMessageId?: string | null
  emailRecipient?: string | null
  emailSubject?: string | null
  previousDigest?: string | null
  supersedesDigest?: string | null
  supersedesDigestMeta?: { id: string; version: number; status: string } | null
  phiRedactedAt?: string | null
  phiRedactedReason?: string | null
  listScope?: "latestPerDigestDate" | "allVersions" | string
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
      { caregiverId?: string; digestDate?: string; includeAllVersions?: boolean; limit?: number; page?: number; sortBy?: string }
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
    generateCaregiverDailyDigest: builder.mutation<
      CaregiverDailyDigest,
      { digestDate?: string; sendEmail?: boolean }
    >({
      query: (body) => ({
        url: "/caregiver-daily-digests",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CaregiverDailyDigest"],
    }),
    sendCaregiverDailyDigest: builder.mutation<CaregiverDailyDigest, { digestId: string }>({
      query: ({ digestId }) => ({
        url: `/caregiver-daily-digests/${digestId}/send`,
        method: "POST",
      }),
      invalidatesTags: ["CaregiverDailyDigest"],
    }),
  }),
})

export const {
  useListCaregiverDailyDigestsQuery,
  useGetCaregiverDailyDigestQuery,
  useGenerateCaregiverDailyDigestMutation,
  useSendCaregiverDailyDigestMutation,
} = dailyDigestApi
