import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export type ActivityFeedItemType = "call" | "alert"

export interface ActivityFeedItem {
  id: string
  type: ActivityFeedItemType
  occurredAt: string
  clientId: string
  residentName: string
  callOutcome: string | null
  callType: string | null
  status: string | null
  durationSec: number
  alertSummary: string | null
}

export interface ActivityFeedResponse {
  results: ActivityFeedItem[]
}

export interface CallsByHourBucket {
  hour: number
  label: string
  calls: number
}

export interface CallsByHourTodayResponse {
  timezone: string
  dateLabel: string
  buckets: CallsByHourBucket[]
}

export const activityApi = createApi({
  reducerPath: "activityApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["ActivityFeed", "CallsByHourToday"],
  endpoints: (builder) => ({
    getRecentActivity: builder.query<
      ActivityFeedResponse,
      { limit?: number; sinceDays?: number; orgId?: string } | void
    >({
      query: (arg) => {
        const params = new URLSearchParams()
        if (arg && typeof arg === "object") {
          if (arg.limit != null) params.set("limit", String(arg.limit))
          if (arg.sinceDays != null) params.set("sinceDays", String(arg.sinceDays))
          if (arg.orgId) params.set("orgId", arg.orgId)
        }
        const q = params.toString()
        return { url: `/activity/recent${q ? `?${q}` : ""}`, method: "GET" }
      },
      providesTags: ["ActivityFeed"],
    }),
    getCallsByHourToday: builder.query<CallsByHourTodayResponse, { orgId?: string } | void>({
      query: (arg) => {
        const params = new URLSearchParams()
        if (arg && typeof arg === "object" && arg.orgId) params.set("orgId", arg.orgId)
        const q = params.toString()
        return { url: `/activity/calls-by-hour-today${q ? `?${q}` : ""}`, method: "GET" }
      },
      providesTags: ["CallsByHourToday"],
    }),
  }),
})

export const { useGetRecentActivityQuery, useGetCallsByHourTodayQuery } = activityApi
