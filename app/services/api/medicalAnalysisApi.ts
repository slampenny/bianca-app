import { Api, ApiResponse } from "./api"
import { 
  MedicalAnalysisResult, 
  MedicalAnalysisTrend, 
  MedicalAnalysisSummary,
  MedicalAnalysisConfidence 
} from "./api.types"

export interface MedicalAnalysisApi {
  getMedicalAnalysisResults: (patientId: string, limit?: number) => Promise<MedicalAnalysisResult[]>
  getMedicalAnalysisTrend: (patientId: string, timeRange?: "month" | "quarter" | "year") => Promise<MedicalAnalysisTrend>
  getMedicalAnalysisSummary: (patientId: string) => Promise<MedicalAnalysisSummary>
  triggerMedicalAnalysis: (patientId: string) => Promise<{ success: boolean; message: string; jobId?: string }>
  triggerAllMedicalAnalysis: () => Promise<{ success: boolean; message: string; patientsAnalyzed: number; jobsScheduled: number }>
  getMedicalAnalysisStatus: () => Promise<{ success: boolean; status: any }>
}

export const medicalAnalysisApi: MedicalAnalysisApi = {
  /**
   * Get medical analysis results for a specific patient
   */
  getMedicalAnalysisResults: async (patientId: string, limit: number = 10): Promise<MedicalAnalysisResult[]> => {
    const response = await Api.get(`/test/medical-analysis/results/${patientId}?limit=${limit}`)
    return response.data.results
  },

  /**
   * Get medical analysis trend for a specific patient
   */
  getMedicalAnalysisTrend: async (patientId: string, timeRange: "month" | "quarter" | "year" = "month"): Promise<MedicalAnalysisTrend> => {
    const response = await Api.get(`/medical-analysis/trend/${patientId}?timeRange=${timeRange}`)
    return response.data.trend
  },

  /**
   * Get medical analysis summary for a specific patient
   */
  getMedicalAnalysisSummary: async (patientId: string): Promise<MedicalAnalysisSummary> => {
    const response = await Api.get(`/medical-analysis/summary/${patientId}`)
    return response.data.summary
  },

  /**
   * Trigger medical analysis for a specific patient
   */
  triggerMedicalAnalysis: async (patientId: string): Promise<{ success: boolean; message: string; jobId?: string }> => {
    const response = await Api.post(`/test/medical-analysis/trigger-patient/${patientId}`)
    return response.data
  },

  /**
   * Trigger medical analysis for all patients
   */
  triggerAllMedicalAnalysis: async (): Promise<{ success: boolean; message: string; patientsAnalyzed: number; jobsScheduled: number }> => {
    const response = await Api.post("/test/medical-analysis/trigger-all")
    return response.data
  },

  /**
   * Get medical analysis scheduler status
   */
  getMedicalAnalysisStatus: async (): Promise<{ success: boolean; status: any }> => {
    const response = await Api.get("/test/medical-analysis/status")
    return response.data
  }
}

export default medicalAnalysisApi
