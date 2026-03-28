import { createApi } from "@reduxjs/toolkit/query/react"
import type { SentimentSummary, SentimentTrend } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const sentimentApi = createApi({
  reducerPath: "sentimentApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["SentimentTrend", "SentimentSummary"],
  endpoints: (builder) => ({
    getSentimentTrend: builder.query<
      SentimentTrend,
      { clientId: string; timeRange?: "lastCall" | "month" | "lifetime" }
    >({
      query: ({ clientId, timeRange = "lastCall" }) => ({
        url: `/sentiment/client/${clientId}/trend`,
        params: { timeRange },
      }),
      providesTags: (_r, _e, { clientId, timeRange }) => [
        { type: "SentimentTrend", id: `${clientId}-${timeRange ?? "lastCall"}` },
      ],
    }),

    getSentimentSummary: builder.query<SentimentSummary, { clientId: string }>({
      query: ({ clientId }) => ({
        url: `/sentiment/client/${clientId}/summary`,
      }),
      providesTags: (_r, _e, { clientId }) => [{ type: "SentimentSummary", id: clientId }],
    }),
  }),
})

export const { useGetSentimentTrendQuery, useGetSentimentSummaryQuery } = sentimentApi
