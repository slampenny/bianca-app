import { skipToken } from "@reduxjs/toolkit/query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { RiskSentimentReportLive } from "../components/RiskSentimentReportLive"
import { ReportDocumentBody } from "../components/ReportDocumentBody"
import { downloadReportPayloadCsv, getReportPayload, printReportFromPayload, reportTemplates, type ReportPayload, type ReportTemplateId } from "../data/reportsMock"
import { buildCallCompletionReportPayload } from "../lib/callCompletionReportPayload"
import { buildConsentRosterReportPayload } from "../lib/consentRosterReportPayload"
import { filterClientsToCaregiverRoster, seesWholeFacilityInReports } from "../lib/caregiverClientFilter"
import { buildAlertAuditReportPayload } from "../lib/alertAuditReportPayload"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import {
  useGetAlertAuditTrailQuery,
  useGetCallCompletionLogQuery,
  type AlertAuditTrailQueryArgs,
  type CallCompletionLogQueryArgs,
} from "../services/api/facilityReportsApi"
import { useGetCaregiverQuery } from "../services/api/caregiverApi"
import { isAuthenticated, getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { ChevronLeftIcon, DownloadIcon, PrintIcon } from "../icons"
import "../app.css"

function isReportTemplateId(id: string | undefined): id is ReportTemplateId {
  return id !== undefined && reportTemplates.some((t) => t.id === id)
}

const LIVE_CLIENT_TEMPLATES = new Set<ReportTemplateId>(["risk_sentiment", "consent_roster"])

const CALL_LOG_PAGE_SIZE = 50

function liveFilenameBase(id: ReportTemplateId): string {
  if (id === "risk_sentiment") return "bianca-risk-sentiment"
  if (id === "consent_roster") return "bianca-consent-roster"
  if (id === "call_log") return "bianca-call-completion-log"
  if (id === "alert_audit") return "bianca-alert-audit-trail"
  return "bianca-report"
}

export function ReportTemplateDetailPage() {
  const { t } = useTranslation()
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const authed = useAppSelector(isAuthenticated)
  const org = useAppSelector((s) => s.org)
  const currentUser = useAppSelector(getCurrentUser)
  const userId = currentUser?.id != null ? String(currentUser.id) : ""

  const validId = isReportTemplateId(templateId) ? templateId : undefined
  const loadLiveClients = Boolean(validId && LIVE_CLIENT_TEMPLATES.has(validId) && authed)

  const { data: caregiverFresh } = useGetCaregiverQuery(
    { id: userId },
    { skip: !authed || !userId || !loadLiveClients },
  )
  const rosterUser = useMemo(() => {
    if (caregiverFresh && currentUser) return { ...currentUser, ...caregiverFresh }
    return caregiverFresh ?? currentUser
  }, [caregiverFresh, currentUser])

  const { data: pages, isLoading, isFetching, isError } = useGetAllClientsQuery(
    loadLiveClients ? { limit: 500, page: 1 } : skipToken,
  )

  const wantsLiveCallLog = Boolean(validId === "call_log" && authed)
  const callLogOrgMissing = Boolean(
    wantsLiveCallLog && currentUser?.role === "superAdmin" && !(org?.id != null && String(org.id).trim() !== ""),
  )
  const skipCallLogQuery = !wantsLiveCallLog || callLogOrgMissing

  const wantsLiveAlertAudit = Boolean(validId === "alert_audit" && authed)
  const alertAuditOrgMissing = Boolean(
    wantsLiveAlertAudit && currentUser?.role === "superAdmin" && !(org?.id != null && String(org.id).trim() !== ""),
  )
  const skipAlertAuditQuery = !wantsLiveAlertAudit || alertAuditOrgMissing

  const [callLogPage, setCallLogPage] = useState(1)
  useEffect(() => {
    setCallLogPage(1)
  }, [templateId])

  const callLogQueryArg = useMemo((): CallCompletionLogQueryArgs => {
    const arg: CallCompletionLogQueryArgs = { page: callLogPage, limit: CALL_LOG_PAGE_SIZE }
    if (currentUser?.role === "superAdmin" && org?.id != null && String(org.id).trim() !== "") {
      arg.orgId = String(org.id)
    }
    return arg
  }, [callLogPage, currentUser?.role, org?.id])

  const {
    data: callLogData,
    isLoading: callLogLoading,
    isFetching: callLogFetching,
    isError: callLogError,
  } = useGetCallCompletionLogQuery(callLogQueryArg, { skip: skipCallLogQuery })

  const alertAuditQueryArg = useMemo((): AlertAuditTrailQueryArgs => {
    const arg: AlertAuditTrailQueryArgs = {}
    if (currentUser?.role === "superAdmin" && org?.id != null && String(org.id).trim() !== "") {
      arg.orgId = String(org.id)
    }
    return arg
  }, [currentUser?.role, org?.id])

  const {
    data: alertAuditData,
    isLoading: alertAuditLoading,
    isFetching: alertAuditFetching,
    isError: alertAuditError,
  } = useGetAlertAuditTrailQuery(alertAuditQueryArg, { skip: skipAlertAuditQuery })

  if (!validId) {
    return <Navigate to="/reports" replace />
  }

  if (validId === "family_weekly_digest") {
    return <Navigate to="/reports/family_weekly_digest" replace />
  }

  if (validId === "wellness_daily") {
    return <Navigate to="/reports/daily-digest" replace />
  }

  const mockPayload = useMemo(() => getReportPayload(validId), [validId])

  const scopeFullOrganization = seesWholeFacilityInReports(currentUser?.role)

  const sortedRiskClients = useMemo(() => {
    if (!pages?.results) return []
    const filtered = filterClientsToCaregiverRoster(pages.results, rosterUser)
    return [...filtered].sort((a, b) => {
      const an = (a.preferredName || a.name || "").trim()
      const bn = (b.preferredName || b.name || "").trim()
      return an.localeCompare(bn, undefined, { sensitivity: "base" })
    })
  }, [pages?.results, rosterUser])

  const livePayload = useMemo((): ReportPayload | null => {
    if (!loadLiveClients) return null
    if (isLoading || isFetching || !pages) return null
    const opts = {
      facilityLine: org?.name?.trim() || t("reportDetail.defaultOrgName"),
      generatedAtLabel: new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    }
    if (validId === "consent_roster") return buildConsentRosterReportPayload(pages.results, opts)
    return null
  }, [loadLiveClients, validId, isLoading, isFetching, pages, org?.name])

  const callLogPayload = useMemo((): ReportPayload | null => {
    if (!callLogData || validId !== "call_log") return null
    return buildCallCompletionReportPayload(callLogData, {
      facilityLine: org?.name?.trim() || t("reportDetail.defaultOrgName"),
      generatedAtLabel: new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
      scopeFacilityWide: seesWholeFacilityInReports(currentUser?.role),
    })
  }, [callLogData, validId, org?.name, currentUser?.role])

  const alertAuditPayload = useMemo((): ReportPayload | null => {
    if (!alertAuditData || validId !== "alert_audit") return null
    return buildAlertAuditReportPayload(alertAuditData, {
      facilityLine: org?.name?.trim() || t("reportDetail.defaultOrgName"),
      generatedAtLabel: new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
      scopeFacilityWide: seesWholeFacilityInReports(currentUser?.role),
    })
  }, [alertAuditData, validId, org?.name, currentUser?.role])

  const payload: ReportPayload | null = useMemo(() => {
    if (validId === "call_log" && authed) return callLogPayload
    if (validId === "alert_audit" && authed) return alertAuditPayload
    if (loadLiveClients && validId !== "risk_sentiment") return livePayload
    return mockPayload
  }, [validId, authed, callLogPayload, alertAuditPayload, loadLiveClients, mockPayload, livePayload])

  const showSampleBanner = LIVE_CLIENT_TEMPLATES.has(validId) && !authed

  const showLiveError = loadLiveClients && authed && isError
  const showLiveLoading = loadLiveClients && authed && (isLoading || isFetching || !pages) && !isError

  const showCallLogOrgHint = wantsLiveCallLog && callLogOrgMissing
  const showCallLogError = wantsLiveCallLog && !callLogOrgMissing && callLogError
  const showCallLogLoading =
    wantsLiveCallLog && !callLogOrgMissing && !callLogError && (callLogLoading || callLogFetching)

  const showAlertAuditOrgHint = wantsLiveAlertAudit && alertAuditOrgMissing
  const showAlertAuditError = wantsLiveAlertAudit && !alertAuditOrgMissing && alertAuditError
  const showAlertAuditLoading =
    wantsLiveAlertAudit && !alertAuditOrgMissing && !alertAuditError && (alertAuditLoading || alertAuditFetching)

  const facilityLine = org?.name?.trim() || t("reportDetail.defaultOrgName")
  const generatedAtLabel = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

  const showRiskSentimentLive = validId === "risk_sentiment" && loadLiveClients && authed && !isError && !showLiveLoading

  return (
    <div data-testid="report-detail-page" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 900, margin: "0 auto", paddingBottom: 48 }}>
      <button type="button" className="va-btn-ghost va-no-print" data-testid="report-detail-back" onClick={() => navigate("/reports")}>
        <ChevronLeftIcon size={16} />
        {t("reportDetail.backToReports")}
      </button>

      {showSampleBanner ? (
        <p className="va-no-print" style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)" }}>
          {t("reportDetail.sampleBanner")}
        </p>
      ) : null}

      <div className="va-card va-card-pad">
        {showCallLogOrgHint ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("reportDetail.callLogOrgHint")}</p>
        ) : showCallLogError ? (
          <p style={{ margin: 0, color: "var(--va-red-600)" }}>{t("reportDetail.callLogLoadError")}</p>
        ) : showCallLogLoading ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("reportDetail.callLogLoading")}</p>
        ) : showAlertAuditOrgHint ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("reportDetail.alertAuditOrgHint")}</p>
        ) : showAlertAuditError ? (
          <p style={{ margin: 0, color: "var(--va-red-600)" }}>{t("reportDetail.alertAuditLoadError")}</p>
        ) : showAlertAuditLoading ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("reportDetail.alertAuditLoading")}</p>
        ) : showLiveError ? (
          <p style={{ margin: 0, color: "var(--va-red-600)" }}>{t("reportDetail.rosterLoadError")}</p>
        ) : showRiskSentimentLive ? (
          <RiskSentimentReportLive
            clients={sortedRiskClients}
            facilityLine={facilityLine}
            generatedAtLabel={generatedAtLabel}
            scopeFullOrganization={scopeFullOrganization}
            filenameBase={liveFilenameBase(validId)}
          />
        ) : showLiveLoading ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("reportDetail.rosterLoading")}</p>
        ) : payload ? (
          <>
            <ReportDocumentBody payload={payload} />
            {validId === "call_log" && callLogData?.pagination && callLogData.pagination.totalResults > 0 ? (
              <div
                className="va-no-print"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginTop: "1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--va-slate-100)",
                }}
              >
                <span style={{ fontSize: "0.875rem", color: "var(--va-slate-600)" }}>
                  {(() => {
                    const pg = callLogData.pagination
                    const fromN = (pg.page - 1) * pg.limit + 1
                    const toN = Math.min(pg.page * pg.limit, pg.totalResults)
                    return t("reportDetail.paginationShowing", { from: fromN, to: toN, total: pg.totalResults })
                  })()}
                </span>
                <button
                  type="button"
                  className="va-btn-secondary"
                  disabled={callLogData.pagination.page <= 1}
                  onClick={() => setCallLogPage((p) => Math.max(1, p - 1))}
                >
                  {t("reportDetail.previous")}
                </button>
                <span style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
                  {t("reportDetail.paginationPage", {
                    page: callLogData.pagination.page,
                    totalPages: Math.max(1, callLogData.pagination.totalPages),
                  })}
                </span>
                <button
                  type="button"
                  className="va-btn-secondary"
                  disabled={callLogData.pagination.page >= callLogData.pagination.totalPages}
                  onClick={() => setCallLogPage((p) => p + 1)}
                >
                  {t("reportDetail.next")}
                </button>
              </div>
            ) : null}
            <div className="va-report-modal-actions va-no-print">
              <button type="button" className="va-btn-secondary" onClick={() => printReportFromPayload(payload)}>
                <PrintIcon size={18} />
                {t("reportDetail.printPdf")}
              </button>
              <button
                type="button"
                className="va-btn-secondary"
                onClick={() => downloadReportPayloadCsv(payload, liveFilenameBase(validId))}
              >
                <DownloadIcon size={18} />
                {t("reportDetail.downloadCsv")}
              </button>
            </div>
            {validId === "call_log" && callLogData?.pagination && callLogData.pagination.totalResults > 0 ? (
              <p className="va-no-print" style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--va-slate-500)" }}>
                {t("reportDetail.exportHint")}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
