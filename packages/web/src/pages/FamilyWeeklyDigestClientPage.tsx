import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { ReportDocumentBody } from "../components/ReportDocumentBody"
import {
  downloadReportPayloadCsv,
  getReportPayload,
  printReportFromPayload,
  type ReportPayload,
} from "../data/reportsMock"
import { familyWeeklyDigestPreviewToReportPayload } from "../lib/familyWeeklyDigestReportPayload"
import { usePreviewFamilyWeeklyDigestMutation } from "../services/api/familyWeeklyDigestApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { ChevronLeftIcon, DownloadIcon, PrintIcon } from "../icons"
import "../app.css"

function utcWeekReferenceFromDateInput(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

export function FamilyWeeklyDigestClientPage() {
  const { t } = useTranslation()
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const authed = useAppSelector(isAuthenticated)
  const isSample = clientId === "sample"

  const [weekRef, setWeekRef] = useState(() => {
    const d = new Date()
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  })

  const [preview, { data, isLoading, isError, reset }] = usePreviewFamilyWeeklyDigestMutation()

  const loadLive = useCallback(() => {
    if (!clientId || isSample) return
    void preview({ clientId, weekStart: utcWeekReferenceFromDateInput(weekRef) })
  }, [clientId, isSample, preview, weekRef])

  useEffect(() => {
    if (isSample || !clientId || !authed) {
      reset()
      return
    }
    loadLive()
  }, [authed, clientId, isSample, loadLive, reset])

  const mockPayload = useMemo((): ReportPayload | null => {
    if (!isSample) return null
    return getReportPayload("family_weekly_digest")
  }, [isSample])

  const livePayload = useMemo((): ReportPayload | null => {
    if (isSample || !data?.payload) return null
    return familyWeeklyDigestPreviewToReportPayload(data.payload)
  }, [data?.payload, isSample])

  const payload = isSample ? mockPayload : livePayload

  if (!clientId) {
    return <Navigate to="/reports/family_weekly_digest" replace />
  }

  return (
    <div
      data-testid="report-detail-page"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 900, margin: "0 auto", paddingBottom: 48 }}
    >
      <button
        type="button"
        className="va-btn-ghost"
        data-testid="report-detail-back"
        onClick={() => navigate("/reports/family_weekly_digest")}
      >
        <ChevronLeftIcon size={16} />
        {t("familyWeeklyDigest.back")}
      </button>

      {isSample ? (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)" }}>{t("familyWeeklyDigest.sampleBanner")}</p>
      ) : null}

      {!isSample && authed ? (
        <div className="va-card va-card-pad" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.75rem", color: "var(--va-slate-600)" }}>
            {t("familyWeeklyDigest.weekLabel")}
            <input
              type="date"
              className="va-input"
              value={weekRef}
              onChange={(e) => setWeekRef(e.target.value)}
              style={{ padding: "0.5rem 0.65rem", borderRadius: 6, border: "1px solid var(--va-slate-200)" }}
            />
          </label>
          <button type="button" className="va-btn-secondary" onClick={() => loadLive()} disabled={isLoading}>
            {isLoading ? t("familyWeeklyDigest.loadingPreview") : t("familyWeeklyDigest.refreshPreview")}
          </button>
        </div>
      ) : null}

      <div className="va-card va-card-pad">
        {!isSample && authed && isError ? (
          <p style={{ margin: 0, color: "var(--va-red-600)" }} role="alert">
            {t("familyWeeklyDigest.loadError")}
          </p>
        ) : !isSample && authed && isLoading && !data ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("familyWeeklyDigest.loadingPreview")}</p>
        ) : payload ? (
          <>
            <ReportDocumentBody payload={payload} />
            <div className="va-report-modal-actions">
              <button type="button" className="va-btn-secondary" onClick={() => printReportFromPayload(payload)}>
                <PrintIcon size={18} />
                {t("reportDetail.printPdf")}
              </button>
              <button
                type="button"
                className="va-btn-secondary"
                onClick={() => downloadReportPayloadCsv(payload, "bianca-weekly-family-digest")}
              >
                <DownloadIcon size={18} />
                {t("reportDetail.downloadCsv")}
              </button>
            </div>
          </>
        ) : !isSample && authed ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("familyWeeklyDigest.loadingPreview")}</p>
        ) : null}
      </div>
    </div>
  )
}
