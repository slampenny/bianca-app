import { createApi } from "@reduxjs/toolkit/query/react"
import { SentimentTrend, SentimentSummary, SentimentAnalysis } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"

export const sentimentApi = createApi({
  reducerPath: "sentimentApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["SentimentTrend", "SentimentSummary", "SentimentAnalysis"],
  endpoints: (builder) => ({
    getSentimentTrend: builder.query<
      SentimentTrend,
      { clientId: string; timeRange?: "lastCall" | "month" | "lifetime" }
    >({
      query: ({ clientId, timeRange = "lastCall" }) => ({
        url: `/sentiment/client/${clientId}/trend`,
        params: { timeRange },
      }),
      providesTags: (result, error, { clientId, timeRange }) => [
        { type: "SentimentTrend", id: `${clientId}-${timeRange}` },
        { type: "SentimentTrend", id: "LIST" },
      ],
    }),

    getSentimentSummary: builder.query<SentimentSummary, { clientId: string }>({
      query: ({ clientId }) => ({
        url: `/sentiment/client/${clientId}/summary`,
      }),
      providesTags: (result, error, { clientId }) => [
        { type: "SentimentSummary", id: clientId },
        { type: "SentimentSummary", id: "LIST" },
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
      { clientId: string }
    >({
      query: ({ clientId }) => ({
        url: `/test/debug-conversation-data`,
        method: "POST",
        body: { clientId },
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
          clientName: string
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

