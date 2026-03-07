import { createApi } from "@reduxjs/toolkit/query/react"
import { FraudAbuseAnalysisResult } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { getDefaultApiConfig } from "./api"
import { logger } from "../../utils/logger"

export const fraudAbuseAnalysisApi = createApi({
  reducerPath: "fraudAbuseAnalysisApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["FraudAbuseAnalysisResult"],
  endpoints: (builder) => ({
    getFraudAbuseAnalysisResults: builder.query<
      { success: boolean; results: FraudAbuseAnalysisResult[] },
      { clientId: string; limit?: number }
    >({
      query: ({ clientId, limit = 10 }) => {
        const url = `/fraud-abuse-analysis/results/${clientId}`
        logger.debug('Fraud Abuse Analysis API - getFraudAbuseAnalysisResults:', {
          baseUrl: getDefaultApiConfig().url,
          fullUrl: getDefaultApiConfig().url + url,
          clientId,
          limit
        })
        return {
          url,
          params: { limit },
        }
      },
      providesTags: (result, error, { clientId }) => [
        { type: "FraudAbuseAnalysisResult", id: clientId },
      ],
    }),

    getFraudAbuseAnalysis: builder.query<
      { 
        success: boolean
        data: {
          clientId: string
          clientName: string
          timeRange: string
          startDate: string
          endDate: string
          conversationCount: number
          messageCount: number
          totalWords: number
          analysis: FraudAbuseAnalysisResult
          recommendations: Array<{
            category: string
            priority: string
            action: string
            description: string
          }>
          generatedAt: string
        }
      },
      { clientId: string; timeRange?: "month" | "quarter" | "year" | "custom"; startDate?: string; endDate?: string }
    >({
      query: ({ clientId, timeRange = "month", startDate, endDate }) => ({
        url: `/fraud-abuse-analysis/${clientId}`,
        params: { timeRange, startDate, endDate },
      }),
      providesTags: (result, error, { clientId }) => [
        { type: "FraudAbuseAnalysisResult", id: clientId },
      ],
    }),

    triggerFraudAbuseAnalysis: builder.mutation<
      { success: boolean; message: string; result?: FraudAbuseAnalysisResult },
      { clientId: string }
    >({
      query: ({ clientId }) => {
        const url = `/fraud-abuse-analysis/trigger-client/${clientId}`
        logger.debug('Fraud Abuse Analysis API - triggerFraudAbuseAnalysis:', {
          baseUrl: getDefaultApiConfig().url,
          fullUrl: getDefaultApiConfig().url + url,
          clientId
        })
        return {
          url,
          method: "POST",
        }
      },
      async onQueryStarted({ clientId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          dispatch(fraudAbuseAnalysisApi.util.invalidateTags([
            { type: "FraudAbuseAnalysisResult", id: clientId }
          ]))
        } catch (error) {
          logger.error('Trigger failed, not invalidating cache:', error)
        }
      },
    }),
  }),
})

export const {
  useGetFraudAbuseAnalysisResultsQuery,
  useGetFraudAbuseAnalysisQuery,
  useTriggerFraudAbuseAnalysisMutation,
} = fraudAbuseAnalysisApi

