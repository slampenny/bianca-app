import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { ReportDocumentBody } from "../components/ReportDocumentBody"
import { isDevDemoEnabled } from "../lib/devDemo"
import { downloadReportPayloadCsv, printReportFromPayload } from "../lib/reportExport"
import { familyWeeklyDigestPreviewToReportPayload } from "../lib/familyWeeklyDigestReportPayload"
import { usePreviewFamilyWeeklyDigestMutation } from "../services/api/familyWeeklyDigestApi"
import { isAuthenticated } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { ChevronLeftIcon, DownloadIcon, PrintIcon } from "../icons"
import "../app.css"

const FamilyWeeklyDigestSample = import.meta.env.DEV
  ? lazy(() => import("./FamilyWeeklyDigestSample.dev").then((m) => ({ default: m.FamilyWeeklyDigestSample })))
  : null

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

  if (!clientId) {
    return <Navigate to="/reports/family_weekly_digest" replace />
  }

  if (isSample) {
    if (!isDevDemoEnabled() || !FamilyWeeklyDigestSample) {
      return <Navigate to="/reports/family_weekly_digest" replace />
    }
    const Sample = FamilyWeeklyDigestSample
    return (
      <Suspense fallback={null}>
        <Sample />
      </Suspense>
    )
  }

  return <FamilyWeeklyDigestLive clientId={clientId} authed={authed} navigate={navigate} t={t} />
}

function FamilyWeeklyDigestLive({
  clientId,
  authed,
  navigate,
  t,
}: {
  clientId: string
  authed: boolean
  navigate: ReturnType<typeof useNavigate>
  t: ReturnType<typeof useTranslation>["t"]
}) {
  const [weekRef, setWeekRef] = useState(() => {
    const d = new Date()
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  })

  const [preview, { data, isLoading, isError, reset }] = usePreviewFamilyWeeklyDigestMutation()

  const loadLive = useCallback(() => {
    void preview({ clientId, weekStart: utcWeekReferenceFromDateInput(weekRef) })
  }, [clientId, preview, weekRef])

  useEffect(() => {
    if (!clientId || !authed) {
      reset()
      return
    }
    loadLive()
  }, [authed, clientId, loadLive, reset])

  const livePayload = useMemo(() => {
    if (!data?.payload) return null
    return familyWeeklyDigestPreviewToReportPayload(data.payload)
  }, [data?.payload])

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

      {authed ? (
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
        {authed && isError ? (
          <p style={{ margin: 0, color: "var(--va-red-600)" }} role="alert">
            {t("familyWeeklyDigest.loadError")}
          </p>
        ) : authed && isLoading && !data ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("familyWeeklyDigest.loadingPreview")}</p>
        ) : livePayload ? (
          <>
            <ReportDocumentBody payload={livePayload} />
            <div className="va-report-modal-actions">
              <button type="button" className="va-btn-secondary" onClick={() => printReportFromPayload(livePayload)}>
                <PrintIcon size={18} />
                {t("reportDetail.printPdf")}
              </button>
              <button
                type="button"
                className="va-btn-secondary"
                onClick={() => downloadReportPayloadCsv(livePayload, "bianca-weekly-family-digest")}
              >
                <DownloadIcon size={18} />
                {t("reportDetail.downloadCsv")}
              </button>
            </div>
          </>
        ) : authed ? (
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>{t("familyWeeklyDigest.loadingPreview")}</p>
        ) : null}
      </div>
    </div>
  )
}
