import { createApi } from "@reduxjs/toolkit/query/react"
import baseQueryWithReauth from "./baseQueryWithAuth"

export interface CallCompletionLogRow {
  startTime: string | null
  resident: string
  callType: string
  outcome: string
  duration: string
  status: string
}

export interface CallCompletionLogPagination {
  page: number
  limit: number
  totalPages: number
  totalResults: number
}

export interface CallCompletionLogResponse {
  reportType: string
  title: string
  generatedAt: string
  dateFrom: string
  dateTo: string
  summary: {
    totalCalls: number
    answeredCount: number
    orgId: string
  }
  rows: CallCompletionLogRow[]
  pagination: CallCompletionLogPagination
}

export interface CallCompletionLogQueryArgs {
  dateFrom?: string
  dateTo?: string
  clientId?: string
  orgId?: string
  page?: number
  limit?: number
}

export interface AlertAuditTrailRow {
  alertId: string
  alertType: string
  importance: string
  resident: string
  message: string
  createdAt: string | null
  acknowledgedBy: string
  readCount: number
}

export interface AlertAuditTrailResponse {
  reportType: string
  title: string
  generatedAt: string
  dateFrom: string
  dateTo: string
  summary: { totalAlerts: number; orgId: string }
  rows: AlertAuditTrailRow[]
}

export interface AlertAuditTrailQueryArgs {
  dateFrom?: string
  dateTo?: string
  orgId?: string
}

export interface WeeklyReportRunBucket {
  day: string
  runs: number
}

export interface ReportsSummaryResponse {
  reportType: string
  generatedAt: string
  orgId: string
  generatedThisMonth: number
  scheduledDeliveries: number
  residentsWithOpenFollowUps: number
  lastFacilityReportAt: string | null
  lastFacilityReportLabel: string
  complianceScoreLabel: string
  weeklyReportRuns: WeeklyReportRunBucket[]
}

export interface ReportsSummaryQueryArgs {
  orgId?: string
}

export const facilityReportsApi = createApi({
  reducerPath: "facilityReportsApi",
  baseQuery: baseQueryWithReauth(),
  tagTypes: ["CallCompletionLog", "AlertAuditTrail", "ReportsSummary"],
  endpoints: (builder) => ({
    getCallCompletionLog: builder.query<CallCompletionLogResponse, CallCompletionLogQueryArgs | void>({
      query: (arg) => {
        const params = new URLSearchParams()
        if (arg && typeof arg === "object") {
          if (arg.dateFrom) params.set("dateFrom", arg.dateFrom)
          if (arg.dateTo) params.set("dateTo", arg.dateTo)
          if (arg.clientId) params.set("clientId", arg.clientId)
          if (arg.orgId) params.set("orgId", arg.orgId)
          if (arg.page != null && arg.page > 0) params.set("page", String(arg.page))
          if (arg.limit != null && arg.limit > 0) params.set("limit", String(arg.limit))
        }
        const q = params.toString()
        return { url: `/facility-reports/call-completion-log${q ? `?${q}` : ""}`, method: "GET" }
      },
      providesTags: ["CallCompletionLog"],
    }),
    getAlertAuditTrail: builder.query<AlertAuditTrailResponse, AlertAuditTrailQueryArgs | void>({
      query: (arg) => {
        const params = new URLSearchParams()
        if (arg && typeof arg === "object") {
          if (arg.dateFrom) params.set("dateFrom", arg.dateFrom)
          if (arg.dateTo) params.set("dateTo", arg.dateTo)
          if (arg.orgId) params.set("orgId", arg.orgId)
        }
        const q = params.toString()
        return { url: `/facility-reports/alert-audit-trail${q ? `?${q}` : ""}`, method: "GET" }
      },
      providesTags: ["AlertAuditTrail"],
    }),
    getReportsSummary: builder.query<ReportsSummaryResponse, ReportsSummaryQueryArgs | void>({
      query: (arg) => {
        const params = new URLSearchParams()
        if (arg && typeof arg === "object" && arg.orgId) params.set("orgId", arg.orgId)
        const q = params.toString()
        return { url: `/facility-reports/summary${q ? `?${q}` : ""}`, method: "GET" }
      },
      providesTags: ["ReportsSummary"],
    }),
  }),
})

export const {
  useGetCallCompletionLogQuery,
  useGetAlertAuditTrailQuery,
  useGetReportsSummaryQuery,
} = facilityReportsApi
