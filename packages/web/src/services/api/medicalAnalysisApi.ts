import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

type MedicalSeverity = "low" | "medium" | "high" | "critical"
type MedicalConfidence = "none" | "low" | "medium" | "high"

export interface MedicalAnalysisSummaryResponse {
  success: boolean
  data: {
    clientId: string
    clientName: string
    hasData: boolean
    summary: {
      totalConversations: number
      lastAnalysisDate: string | null
      overallHealthScore: number | null
      riskIndicators: Array<{ category: string; severity: MedicalSeverity; description: string }>
      positiveTrends: Array<{ category: string; description: string }>
      concerns: Array<{ category: string; description: string }>
    }
    lastAnalysisDate?: string
    conversationCount?: number
    messageCount?: number
  }
}

export interface MedicalAnalysisResult {
  analysisDate?: string
  conversationCount?: number
  messageCount?: number
  confidence?: MedicalConfidence
  cognitiveMetrics?: { riskScore?: number }
  psychiatricMetrics?: { depressionScore?: number; anxietyScore?: number; overallRiskScore?: number }
  vocabularyMetrics?: { complexityScore?: number }
  recommendations?: Array<{ title?: string; severity?: MedicalSeverity; description?: string }>
}

export interface MedicalAnalysisResultsResponse {
  success: boolean
  results: MedicalAnalysisResult[]
  count: number
}

export const medicalAnalysisApi = createApi({
  reducerPath: "medicalAnalysisApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["MedicalAnalysis"],
  endpoints: (builder) => ({
    getMedicalAnalysisSummary: builder.query<MedicalAnalysisSummaryResponse, { clientId: string }>({
      query: ({ clientId }) => ({
        url: `/medical-analysis/${clientId}/summary`,
        method: "GET",
      }),
      providesTags: (_r, _e, { clientId }) => [{ type: "MedicalAnalysis", id: clientId }],
    }),
    getMedicalAnalysisResults: builder.query<MedicalAnalysisResultsResponse, { clientId: string; limit?: number }>({
      query: ({ clientId, limit = 1 }) => ({
        url: `/medical-analysis/results/${clientId}?limit=${limit}`,
        method: "GET",
      }),
      providesTags: (_r, _e, { clientId }) => [{ type: "MedicalAnalysis", id: clientId }],
    }),
  }),
})

export const { useGetMedicalAnalysisSummaryQuery, useGetMedicalAnalysisResultsQuery } = medicalAnalysisApi

