import { createApi } from "@reduxjs/toolkit/query/react"
import { FraudAbuseAnalysisResult } from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { DEFAULT_API_CONFIG } from "./api"
import { logger } from "../../utils/logger"

export const fraudAbuseAnalysisApi = createApi({
  reducerPath: "fraudAbuseAnalysisApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["FraudAbuseAnalysisResult"],
  endpoints: (builder) => ({
    // Get fraud/abuse analysis results for a specific patient
    getFraudAbuseAnalysisResults: builder.query<
      { success: boolean; results: FraudAbuseAnalysisResult[] },
      { patientId: string; limit?: number }
    >({
      query: ({ patientId, limit = 10 }) => {
        const url = `/fraud-abuse-analysis/results/${patientId}`
        logger.debug('Fraud Abuse Analysis API - getFraudAbuseAnalysisResults:', {
          baseUrl: DEFAULT_API_CONFIG.url,
          fullUrl: DEFAULT_API_CONFIG.url + url,
          patientId,
          limit
        })
        return {
          url,
          params: { limit },
        }
      },
      providesTags: (result, error, { patientId }) => [
        { type: "FraudAbuseAnalysisResult", id: patientId },
      ],
    }),

    // Get fraud/abuse analysis for a patient with time range
    getFraudAbuseAnalysis: builder.query<
      { 
        success: boolean
        data: {
          patientId: string
          patientName: string
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
      { patientId: string; timeRange?: "month" | "quarter" | "year" | "custom"; startDate?: string; endDate?: string }
    >({
      query: ({ patientId, timeRange = "month", startDate, endDate }) => ({
        url: `/fraud-abuse-analysis/${patientId}`,
        params: { timeRange, startDate, endDate },
      }),
      providesTags: (result, error, { patientId }) => [
        { type: "FraudAbuseAnalysisResult", id: patientId },
      ],
    }),

    // Trigger fraud/abuse analysis for a specific patient (synchronous)
    triggerFraudAbuseAnalysis: builder.mutation<
      { success: boolean; message: string; result?: FraudAbuseAnalysisResult },
      { patientId: string }
    >({
      query: ({ patientId }) => {
        const url = `/fraud-abuse-analysis/trigger-patient/${patientId}`
        logger.debug('Fraud Abuse Analysis API - triggerFraudAbuseAnalysis:', {
          baseUrl: DEFAULT_API_CONFIG.url,
          fullUrl: DEFAULT_API_CONFIG.url + url,
          patientId
        })
        return {
          url,
          method: "POST",
        }
      },
      async onQueryStarted({ patientId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          // Immediately invalidate cache since analysis is synchronous
          dispatch(fraudAbuseAnalysisApi.util.invalidateTags([
            { type: "FraudAbuseAnalysisResult", id: patientId }
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

