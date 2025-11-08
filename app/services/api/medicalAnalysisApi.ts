import { createApi } from "@reduxjs/toolkit/query/react"
import { 
  MedicalAnalysisResult, 
  MedicalAnalysisTrend, 
  MedicalAnalysisSummary 
} from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { DEFAULT_API_CONFIG } from "./api"
import { logger } from "../../utils/logger"

export const medicalAnalysisApi = createApi({
  reducerPath: "medicalAnalysisApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["MedicalAnalysisResult", "MedicalAnalysisTrend", "MedicalAnalysisSummary"],
  endpoints: (builder) => ({
    // Get medical analysis results for a specific patient
    getMedicalAnalysisResults: builder.query<
      { success: boolean; results: MedicalAnalysisResult[]; count: number },
      { patientId: string; limit?: number }
    >({
      query: ({ patientId, limit = 10 }) => {
        const url = `/medical-analysis/results/${patientId}`
        logger.debug('Medical Analysis API - getMedicalAnalysisResults:', {
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
        { type: "MedicalAnalysisResult", id: patientId },
      ],
    }),

    // Get medical analysis trend for a specific patient
    getMedicalAnalysisTrend: builder.query<
      { success: boolean; trend: MedicalAnalysisTrend },
      { patientId: string; timeRange?: "month" | "quarter" | "year" }
    >({
      query: ({ patientId, timeRange = "month" }) => ({
        url: `/medical-analysis/trend/${patientId}`,
        params: { timeRange },
      }),
      providesTags: (result, error, { patientId, timeRange }) => [
        { type: "MedicalAnalysisTrend", id: `${patientId}-${timeRange}` },
      ],
    }),

    // Get medical analysis summary for a specific patient
    getMedicalAnalysisSummary: builder.query<
      { success: boolean; summary: MedicalAnalysisSummary },
      { patientId: string }
    >({
      query: ({ patientId }) => ({
        url: `/medical-analysis/summary/${patientId}`,
      }),
      providesTags: (result, error, { patientId }) => [
        { type: "MedicalAnalysisSummary", id: patientId },
      ],
    }),

    // Trigger medical analysis for a specific patient
    triggerMedicalAnalysis: builder.mutation<
      { success: boolean; message: string; jobId?: string; batchId?: string },
      { patientId: string }
    >({
      query: ({ patientId }) => {
        const url = `/medical-analysis/trigger-patient/${patientId}`
        logger.debug('Medical Analysis API - triggerMedicalAnalysis:', {
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
        let timeoutId: NodeJS.Timeout | null = null
        try {
          await queryFulfilled
          // Wait 10 seconds before invalidating cache to give job time to complete
          timeoutId = setTimeout(() => {
            dispatch(medicalAnalysisApi.util.invalidateTags([
              { type: "MedicalAnalysisResult", id: patientId },
              { type: "MedicalAnalysisTrend", id: `${patientId}-month` }
            ]))
            timeoutId = null
          }, 10000)
        } catch (error) {
          // Don't invalidate cache if the trigger failed
          // Clean up timeout if mutation was cancelled
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          logger.error('Trigger failed, not invalidating cache:', error)
        }
        
        // Return cleanup function to clear timeout if query is cancelled
        return () => {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
        }
      },
    }),

    // Trigger medical analysis for all patients
    triggerAllMedicalAnalysis: builder.mutation<
      { 
        success: boolean; 
        message: string; 
        patientsAnalyzed: number; 
        jobsScheduled: number;
        batchId?: string;
        patients?: Array<{ id: string; name: string }>;
        errors?: Array<{ patientId: string; error: string }>;
      },
      void
    >({
      query: () => ({
        url: "/medical-analysis/trigger-all",
        method: "POST",
      }),
      invalidatesTags: ["MedicalAnalysisResult"],
    }),

    // Get medical analysis scheduler status
    getMedicalAnalysisStatus: builder.query<
      { success: boolean; status: any },
      void
    >({
      query: () => ({
        url: "/medical-analysis/status",
      }),
    }),
  }),
})

export const {
  useGetMedicalAnalysisResultsQuery,
  useGetMedicalAnalysisTrendQuery,
  useGetMedicalAnalysisSummaryQuery,
  useTriggerMedicalAnalysisMutation,
  useTriggerAllMedicalAnalysisMutation,
  useGetMedicalAnalysisStatusQuery,
} = medicalAnalysisApi
