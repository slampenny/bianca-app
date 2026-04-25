import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

type MedicalSeverity = "low" | "medium" | "high" | "critical"
export type MedicalConfidence = "none" | "low" | "medium" | "high"

/** Matches API / mobile — used for full report UI on web. */
export interface MedicalCognitiveMetrics {
  riskScore?: number
  fillerWordDensity?: number
  vagueReferenceDensity?: number
  repetitionScore?: number
  temporalConfusionCount?: number
  wordFindingDifficultyCount?: number
  informationDensity?: { score?: number }
  indicators?: Array<{ severity?: string; message?: string }>
}

export interface MedicalPsychiatricMetrics {
  depressionScore?: number
  anxietyScore?: number
  overallRiskScore?: number
  crisisIndicators?: { hasCrisisIndicators?: boolean }
  emotionalTone?: { dominantTone?: string; negativeRatio?: number }
  protectiveFactors?: number | string
}

export interface MedicalVocabularyMetrics {
  complexityScore?: number
  typeTokenRatio?: number
  avgWordLength?: number
  avgSentenceLength?: number
  uniqueWords?: number
}

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
  totalWords?: number
  confidence?: MedicalConfidence
  cognitiveMetrics?: MedicalCognitiveMetrics
  psychiatricMetrics?: MedicalPsychiatricMetrics
  vocabularyMetrics?: MedicalVocabularyMetrics
  warnings?: string[]
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

