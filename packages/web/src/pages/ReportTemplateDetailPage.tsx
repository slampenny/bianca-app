import { skipToken } from "@reduxjs/toolkit/query"
import { useMemo } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import {
  downloadReportPayloadCsv,
  getReportPayload,
  printReportFromPayload,
  reportTemplates,
  type ReportPayload,
  type ReportTemplateId,
} from "../data/reportsMock"
import { ReportDocumentBody } from "../components/ReportDocumentBody"
import { buildRiskSentimentReportPayload } from "../lib/riskSentimentReportPayload"
import { buildConsentRosterReportPayload } from "../lib/consentRosterReportPayload"
import { useGetAllClientsQuery } from "../services/api/clientApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { ChevronLeftIcon, DownloadIcon, PrintIcon } from "../icons"
import "../app.css"

function isReportTemplateId(id: string | undefined): id is ReportTemplateId {
  return id !== undefined && reportTemplates.some((t) => t.id === id)
}

const LIVE_CLIENT_TEMPLATES = new Set<ReportTemplateId>(["risk_sentiment", "consent_roster"])

function liveFilenameBase(id: ReportTemplateId): string {
  if (id === "risk_sentiment") return "bianca-risk-sentiment"
  if (id === "consent_roster") return "bianca-consent-roster"
  return "bianca-report"
}

export function ReportTemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const authed = useAppSelector(isAuthenticated)
  const org = useAppSelector((s) => s.org)

  const validId = isReportTemplateId(templateId) ? templateId : undefined
  const loadLiveClients = Boolean(validId && LIVE_CLIENT_TEMPLATES.has(validId) && authed)

  const { data: pages, isLoading, isFetching, isError } = useGetAllClientsQuery(
    loadLiveClients ? { limit: 500, page: 1 } : skipToken,
  )

  if (!validId) {
    return <Navigate to="/reports" replace />
  }

  const mockPayload = useMemo(() => getReportPayload(validId), [validId])

  const livePayload = useMemo((): ReportPayload | null => {
    if (!loadLiveClients) return null
    if (isLoading || isFetching || !pages) return null
    const results = pages.results ?? []
    const opts = {
      facilityLine: org?.name?.trim() || "Your organization",
      generatedAtLabel: new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    }
    if (validId === "risk_sentiment") return buildRiskSentimentReportPayload(results, opts)
    if (validId === "consent_roster") return buildConsentRosterReportPayload(results, opts)
    return null
  }, [loadLiveClients, validId, isLoading, isFetching, pages, org?.name])

  const payload: ReportPayload | null = loadLiveClients ? livePayload : mockPayload

  const showSampleBanner = LIVE_CLIENT_TEMPLATES.has(validId) && !authed

  const showLiveError = loadLiveClients && authed && isError
  const showLiveLoading = loadLiveClients && authed && payload === null && !isError

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 900, margin: "0 auto", paddingBottom: 48 }}>
      <button type="button" className="va-btn-ghost" onClick={() => navigate("/reports")}>
        <ChevronLeftIcon size={16} />
        Back to Reports
      </button>

      {showSampleBanner ? (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)" }}>
          Illustrative sample data. Sign in to generate this report from your live roster (same sources as the Residents
          list).
        </p>
      ) : null}

      <div className="va-card va-card-pad">
        {showLiveError ? (
          <p style={{ margin: 0, color: "var(--va-red-600)" }}>
            Could not load clients. Check your connection and try again.
          </p>
        ) : showLiveLoading ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>Loading roster…</p>
        ) : payload ? (
          <>
            <ReportDocumentBody payload={payload} />
            <div className="va-report-modal-actions">
              <button type="button" className="va-btn-secondary" onClick={() => printReportFromPayload(payload)}>
                <PrintIcon size={18} />
                Print / Save as PDF
              </button>
              <button
                type="button"
                className="va-btn-secondary"
                onClick={() => downloadReportPayloadCsv(payload, liveFilenameBase(validId))}
              >
                <DownloadIcon size={18} />
                Download data (CSV)
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
