import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export type FamilyWeeklyDigest = {
  id: string
  client: string
  weekStart: string
  weekEnd: string
  localWeekKey: string
  status: "draft" | "sent"
  payload: {
    title: string
    atAGlance: {
      weekRangeLabel: string
      callsPlaced: number
      answeredCount: number
    }
    callRows: Array<{ dayLabel: string; dateLabel: string; connected: boolean; summary: string }>
    narrative: string[]
  }
  sentAt?: string | null
}

export type FamilyWeeklyDigestPages = {
  results: FamilyWeeklyDigest[]
  page: number
  limit: number
  totalPages: number
  totalResults: number
}

export const familyWeeklyDigestApi = createApi({
  reducerPath: "familyWeeklyDigestApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["FamilyWeeklyDigest"],
  endpoints: (builder) => ({
    listFamilyWeeklyDigests: builder.query<
      FamilyWeeklyDigestPages,
      { clientId: string; limit?: number; page?: number }
    >({
      query: ({ clientId, limit, page }) => ({
        url: "/family-weekly-digests",
        params: { clientId, limit, page, sortBy: "weekStart:desc" },
      }),
      providesTags: (_r, _e, { clientId }) => [{ type: "FamilyWeeklyDigest", id: `LIST-${clientId}` }],
    }),
    getFamilyWeeklyDigest: builder.query<FamilyWeeklyDigest, { digestId: string }>({
      query: ({ digestId }) => `/family-weekly-digests/${digestId}`,
      providesTags: (_r, _e, { digestId }) => [{ type: "FamilyWeeklyDigest", id: digestId }],
    }),
  }),
})

export const { useListFamilyWeeklyDigestsQuery, useGetFamilyWeeklyDigestQuery } = familyWeeklyDigestApi
