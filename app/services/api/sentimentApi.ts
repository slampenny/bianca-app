import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { DEFAULT_API_CONFIG } from "./api"
import { RootState } from "../../store/store"
import { SentimentTrend, SentimentSummary, SentimentAnalysis } from "./api.types"

export const sentimentApi = createApi({
  reducerPath: "sentimentApi",
  baseQuery: fetchBaseQuery({
    baseUrl: DEFAULT_API_CONFIG.url,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.access.token
      if (token) {
        headers.set("authorization", `Bearer ${token}`)
      }
      return headers
    },
  }),
  tagTypes: ["SentimentTrend", "SentimentSummary", "SentimentAnalysis"],
  endpoints: (builder) => ({
    // Get sentiment trend for a patient over time
    getSentimentTrend: builder.query<
      SentimentTrend,
      { patientId: string; timeRange?: "lastCall" | "month" | "lifetime" }
    >({
      query: ({ patientId, timeRange = "lastCall" }) => ({
        url: `/sentiment/patient/${patientId}/trend`,
        params: { timeRange },
      }),
      providesTags: (result, error, { patientId, timeRange }) => [
        { type: "SentimentTrend", id: `${patientId}-${timeRange}` },
      ],
    }),

    // Get sentiment summary for a patient
    getSentimentSummary: builder.query<SentimentSummary, { patientId: string }>({
      query: ({ patientId }) => ({
        url: `/sentiment/patient/${patientId}/summary`,
      }),
      providesTags: (result, error, { patientId }) => [
        { type: "SentimentSummary", id: patientId },
      ],
    }),

    // Get sentiment analysis for a specific conversation
    getConversationSentiment: builder.query<
      {
        conversationId: string
        sentiment: SentimentAnalysis | null
        sentimentAnalyzedAt: string | null
        hasSentimentAnalysis: boolean
      },
      { conversationId: string }
    >({
      query: ({ conversationId }) => ({
        url: `/sentiment/conversation/${conversationId}`,
      }),
      providesTags: (result, error, { conversationId }) => [
        { type: "SentimentAnalysis", id: conversationId },
      ],
    }),

    // Trigger sentiment analysis for a conversation
    analyzeConversationSentiment: builder.mutation<
      {
        success: boolean
        conversationId: string
        sentiment: SentimentAnalysis
        analyzedAt: string
      },
      { conversationId: string }
    >({
      query: ({ conversationId }) => ({
        url: `/sentiment/conversation/${conversationId}/analyze`,
        method: "POST",
      }),
      invalidatesTags: (result, error, { conversationId }) => [
        { type: "SentimentAnalysis", id: conversationId },
        { type: "SentimentTrend", id: "LIST" },
        { type: "SentimentSummary", id: "LIST" },
      ],
    }),

    // Debug conversation data for a patient
    debugConversationData: builder.mutation<
      {
        success: boolean
        debugType: string
        summary: {
          totalConversations: number
          recentConversations: number
          conversationsWithSentiment: number
          recentWithSentiment: number
          testConversationFound: boolean
        }
        data: {
          allConversations: any[]
          recentConversations: any[]
          conversationsWithSentiment: any[]
          testConversation: any
          thirtyDaysAgo: string
        }
      },
      { patientId: string }
    >({
      query: ({ patientId }) => ({
        url: `/test/debug-conversation-data`,
        method: "POST",
        body: { patientId },
      }),
    }),

    // Debug sentiment analysis for recent conversations
    debugSentimentAnalysis: builder.mutation<
      {
        success: boolean
        debugType: string
        summary: {
          totalConversations: number
          conversationsWithoutSentiment: number
          successfullyAnalyzed: number
          failedAnalyses: number
        }
        conversations: Array<{
          conversationId: string
          patientName: string
          endTime: string
          hadSentiment: boolean
          messageCount: number
          analysisResult: {
            success: boolean
            sentiment?: string
            score?: number
            confidence?: number
            mood?: string
            emotions?: string[]
            concernLevel?: string
            error?: string
          } | null
        }>
      },
      {
        hoursBack?: number
        maxConversations?: number
        forceReanalyze?: boolean
      }
    >({
      query: (params = {}) => ({
        url: `/test/debug-sentiment-analysis`,
        method: "POST",
        body: params,
      }),
      invalidatesTags: [
        { type: "SentimentTrend", id: "LIST" },
        { type: "SentimentSummary", id: "LIST" },
        { type: "SentimentAnalysis", id: "LIST" },
      ],
    }),
  }),
})

export const {
  useGetSentimentTrendQuery,
  useGetSentimentSummaryQuery,
  useGetConversationSentimentQuery,
  useAnalyzeConversationSentimentMutation,
  useDebugConversationDataMutation,
  useDebugSentimentAnalysisMutation,
} = sentimentApi

