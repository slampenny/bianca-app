import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export type FraudAbuseConfidence = "high" | "medium" | "low" | "none"

export interface FinancialRiskMetrics {
  riskScore?: number
  confidence?: FraudAbuseConfidence
  /** Parsed from patient text; $5K+ can create a dashboard alert */
  maxEstimatedUsd?: number
  largeAmountMentions?: number
  transferMethodMentions?: number
  scamIndicatorMentions?: number
  urgencyMentions?: number
  helpRequestMentions?: number
  relationshipMoneyMentions?: number
  temporalPatterns?: {
    hasEscalation?: boolean
    trend?: string
  }
}

export interface AbuseRiskMetrics {
  riskScore?: number
  confidence?: FraudAbuseConfidence
  physicalAbuseScore?: number
  emotionalAbuseScore?: number
  neglectScore?: number
  injuryMentions?: number
  isolationMentions?: number
  fearMentions?: number
  basicNeedsMentions?: number
}

export interface RelationshipRiskMetrics {
  riskScore?: number
  confidence?: FraudAbuseConfidence
  newPeopleCount?: number
  isolationCount?: number
  controlCount?: number
  dependencyCount?: number
  suspiciousBehaviorCount?: number
}

export interface FraudAbuseAnalysisResult {
  analysisDate?: string
  timeRange?: string
  financialRisk?: FinancialRiskMetrics
  abuseRisk?: AbuseRiskMetrics
  relationshipRisk?: RelationshipRiskMetrics
  overallRiskScore?: number
  confidence?: FraudAbuseConfidence
  warnings?: string[]
  conversationCount?: number
  messageCount?: number
  totalWords?: number
}

export type FraudAbuseTimeRange = "month" | "quarter" | "year" | "custom"

export interface GetFraudAbuseAnalysisResponse {
  success: boolean
  data: {
    clientId: string
    clientName?: string
    timeRange: string
    startDate?: string
    endDate?: string
    conversationCount: number
    messageCount: number
    totalWords?: number
    analysis: FraudAbuseAnalysisResult
    recommendations: Array<{
      category?: string
      priority?: string
      action: string
      description: string
    }>
    generatedAt?: string
  }
}

export const fraudAbuseAnalysisApi = createApi({
  reducerPath: "fraudAbuseAnalysisApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["FraudAbuseAnalysis"],
  endpoints: (builder) => ({
    getFraudAbuseAnalysis: builder.query<
      GetFraudAbuseAnalysisResponse,
      { clientId: string; timeRange?: FraudAbuseTimeRange; startDate?: string; endDate?: string }
    >({
      query: ({ clientId, timeRange = "month", startDate, endDate }) => ({
        url: `/fraud-abuse-analysis/${clientId}`,
        method: "GET",
        params: { timeRange, startDate, endDate },
      }),
      providesTags: (_r, _e, { clientId }) => [{ type: "FraudAbuseAnalysis", id: clientId }],
    }),
    getFraudAbuseAnalysisResults: builder.query<
      { success: boolean; results: FraudAbuseAnalysisResult[] },
      { clientId: string; limit?: number }
    >({
      query: ({ clientId, limit = 10 }) => ({
        url: `/fraud-abuse-analysis/results/${clientId}`,
        method: "GET",
        params: { limit },
      }),
      providesTags: (_r, _e, { clientId }) => [{ type: "FraudAbuseAnalysis", id: clientId }],
    }),
    triggerFraudAbuseAnalysis: builder.mutation<{ success: boolean; message?: string }, { clientId: string }>({
      query: ({ clientId }) => ({
        url: `/fraud-abuse-analysis/trigger-client/${clientId}`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { clientId }) => [{ type: "FraudAbuseAnalysis", id: clientId }],
    }),
  }),
})

export const {
  useGetFraudAbuseAnalysisQuery,
  useGetFraudAbuseAnalysisResultsQuery,
  useTriggerFraudAbuseAnalysisMutation,
} = fraudAbuseAnalysisApi
