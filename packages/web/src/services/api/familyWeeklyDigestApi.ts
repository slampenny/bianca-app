import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export type FamilyWeeklyDigestEligibility = {
  ok: boolean
  reasons: string[]
  warnings: string[]
}

export type FamilyWeeklyDigestPreviewPayload = {
  version: number
  title: string
  subtitleParts: { recipientLine: string; residentLine: string }
  facilityName: string
  generatedAt: string
  /** Org-local Monday date key (YYYY-MM-DD) */
  localWeekKey?: string
  /** IANA timezone used when the preview was built */
  timezoneAtBuild?: string | null
  /** True when this digest reflects legacy UTC Monday–Sunday semantics */
  legacyUtcWeek?: boolean
  /** UTC instant for org-local Monday 00:00:00 */
  weekStart: string
  /** UTC instant for last ms of org-local Sunday */
  weekEnd: string
  narrative: string[]
  atAGlance: {
    weekRangeLabel: string
    callsPlaced: number
    answeredCount: number
    typicalMinutesWhenConnected: number | null
  }
  callRows: Array<{ dayLabel: string; dateLabel: string; connected: boolean; summary: string }>
  exclusions: Array<{ topic: string; instead: string }>
  eligibility: FamilyWeeklyDigestEligibility
  /** Present when PHI was redacted for compliance */
  phiRedacted?: boolean
}

export type FamilyWeeklyDigestPreviewResponse = {
  payload: FamilyWeeklyDigestPreviewPayload
  eligibility: FamilyWeeklyDigestEligibility
  /** Org-local Monday date key resolved for this preview */
  localWeekKey: string
  /** UTC instant for org-local Monday 00:00:00 */
  weekStart: string
  timezoneAtBuild?: string | null
  legacyUtcWeek?: boolean
}

export type FamilyWeeklyDigestRecipient = {
  name: string
  relationship: string
  email: string
}

export type FamilyWeeklyDigest = {
  id: string
  client: string
  org: string
  weekStart: string
  weekEnd: string
  localWeekKey: string
  timezoneAtBuild?: string | null
  legacyUtcWeek?: boolean
  status: "draft" | "sent"
  recipient: FamilyWeeklyDigestRecipient
  payload: FamilyWeeklyDigestPreviewPayload
  sentAt?: string | null
  emailRecipient?: string | null
  emailSubject?: string | null
  phiRedactedAt?: string | null
  phiRedactedReason?: string | null
  createdAt?: string
  updatedAt?: string
}

export type FamilyWeeklyDigestPages = {
  results: FamilyWeeklyDigest[]
  page: number
  limit: number
  totalPages: number
  totalResults: number
}

export type CreateFamilyWeeklyDigestResponse = {
  digest: FamilyWeeklyDigest
  eligibility: FamilyWeeklyDigestEligibility
}

export const familyWeeklyDigestApi = createApi({
  reducerPath: "familyWeeklyDigestApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["FamilyWeeklyDigest"],
  endpoints: (builder) => ({
    previewFamilyWeeklyDigest: builder.mutation<
      FamilyWeeklyDigestPreviewResponse,
      { clientId: string; weekStart?: string }
    >({
      query: (body) => ({
        url: "/family-weekly-digests/preview",
        method: "POST",
        body,
      }),
    }),
    listFamilyWeeklyDigests: builder.query<
      FamilyWeeklyDigestPages,
      { clientId: string; limit?: number; page?: number; sortBy?: string }
    >({
      query: ({ clientId, limit, page, sortBy }) => ({
        url: "/family-weekly-digests",
        method: "GET",
        params: {
          clientId,
          ...(limit != null && { limit }),
          ...(page != null && { page }),
          ...(sortBy && { sortBy }),
        },
      }),
      providesTags: (result, _e, { clientId }) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: "FamilyWeeklyDigest" as const, id })),
              { type: "FamilyWeeklyDigest", id: `LIST-${clientId}` },
            ]
          : [{ type: "FamilyWeeklyDigest", id: `LIST-${clientId}` }],
    }),
    getFamilyWeeklyDigest: builder.query<FamilyWeeklyDigest, { digestId: string }>({
      query: ({ digestId }) => `/family-weekly-digests/${digestId}`,
      providesTags: (_r, _e, { digestId }) => [{ type: "FamilyWeeklyDigest", id: digestId }],
    }),
    createFamilyWeeklyDigest: builder.mutation<
      CreateFamilyWeeklyDigestResponse,
      { clientId: string; weekStart?: string }
    >({
      query: (body) => ({
        url: "/family-weekly-digests",
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { clientId }) => [{ type: "FamilyWeeklyDigest", id: `LIST-${clientId}` }],
    }),
    sendFamilyWeeklyDigest: builder.mutation<FamilyWeeklyDigest, { digestId: string; clientId: string }>({
      query: ({ digestId }) => ({
        url: `/family-weekly-digests/${digestId}/send`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { digestId, clientId }) => [
        { type: "FamilyWeeklyDigest", id: digestId },
        { type: "FamilyWeeklyDigest", id: `LIST-${clientId}` },
      ],
    }),
  }),
})

export const {
  usePreviewFamilyWeeklyDigestMutation,
  useListFamilyWeeklyDigestsQuery,
  useGetFamilyWeeklyDigestQuery,
  useCreateFamilyWeeklyDigestMutation,
  useSendFamilyWeeklyDigestMutation,
} = familyWeeklyDigestApi

export function isFamilyWeeklyDigestRedacted(digest: FamilyWeeklyDigest | null | undefined): boolean {
  if (!digest) return false
  return digest.phiRedactedAt != null || digest.payload?.phiRedacted === true
}
