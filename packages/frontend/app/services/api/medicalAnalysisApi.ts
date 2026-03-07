import { createApi } from "@reduxjs/toolkit/query/react"
import { 
  MedicalAnalysisResult, 
  MedicalAnalysisTrend, 
  MedicalAnalysisSummary 
} from "./api.types"
import baseQueryWithReauth from "./baseQueryWithAuth"
import { getDefaultApiConfig } from "./api"
import { logger } from "../../utils/logger"

export const medicalAnalysisApi = createApi({
  reducerPath: "medicalAnalysisApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["MedicalAnalysisResult", "MedicalAnalysisTrend", "MedicalAnalysisSummary"],
  endpoints: (builder) => ({
    getMedicalAnalysisResults: builder.query<
      { success: boolean; results: MedicalAnalysisResult[]; count: number },
      { clientId: string; limit?: number }
    >({
      query: ({ clientId, limit = 10 }) => {
        const url = `/medical-analysis/results/${clientId}`
        logger.debug('Medical Analysis API - getMedicalAnalysisResults:', {
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
        { type: "MedicalAnalysisResult", id: clientId },
      ],
    }),

    getMedicalAnalysisTrend: builder.query<
      { success: boolean; trend: MedicalAnalysisTrend },
      { clientId: string; timeRange?: "month" | "quarter" | "year" }
    >({
      query: ({ clientId, timeRange = "month" }) => ({
        url: `/medical-analysis/trend/${clientId}`,
        params: { timeRange },
      }),
      providesTags: (result, error, { clientId, timeRange }) => [
        { type: "MedicalAnalysisTrend", id: `${clientId}-${timeRange}` },
      ],
    }),

    getMedicalAnalysisSummary: builder.query<
      { success: boolean; summary: MedicalAnalysisSummary },
      { clientId: string }
    >({
      query: ({ clientId }) => ({
        url: `/medical-analysis/summary/${clientId}`,
      }),
      providesTags: (result, error, { clientId }) => [
        { type: "MedicalAnalysisSummary", id: clientId },
      ],
    }),

    triggerMedicalAnalysis: builder.mutation<
      { success: boolean; message: string; result?: any },
      { clientId: string }
    >({
      query: ({ clientId }) => {
        const url = `/medical-analysis/trigger-client/${clientId}`
        logger.debug('Medical Analysis API - triggerMedicalAnalysis:', {
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
          dispatch(medicalAnalysisApi.util.invalidateTags([
            { type: "MedicalAnalysisResult", id: clientId },
            { type: "MedicalAnalysisTrend", id: `${clientId}-month` }
          ]))
        } catch (error) {
          logger.error('Trigger failed, not invalidating cache:', error)
        }
      },
    }),

    // Trigger medical analysis for all clients
    triggerAllMedicalAnalysis: builder.mutation<
      { 
        success: boolean; 
        message: string; 
        clientsAnalyzed: number; 
        jobsScheduled: number;
        batchId?: string;
        clients?: Array<{ id: string; name: string }>;
        errors?: Array<{ clientId: string; error: string }>;
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
