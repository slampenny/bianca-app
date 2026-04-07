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
  weekStart: string
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
}

export type FamilyWeeklyDigestPreviewResponse = {
  payload: FamilyWeeklyDigestPreviewPayload
  eligibility: FamilyWeeklyDigestEligibility
  weekStart: string
}

export const familyWeeklyDigestApi = createApi({
  reducerPath: "familyWeeklyDigestApi",
  baseQuery: baseQueryWithReauth(),
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
  }),
})

export const { usePreviewFamilyWeeklyDigestMutation } = familyWeeklyDigestApi
