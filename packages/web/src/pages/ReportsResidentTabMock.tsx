import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { AuthSelectField } from "../components/AuthSelectField"
import { MockDataBanner } from "../components/MockDataBanner"
import { ReportDocumentBody } from "../components/ReportDocumentBody"
import {
  downloadResidentDigestCsv,
  getResidentDigestPayload,
  printResidentDigest,
  residentReportSnapshots,
  type ResidentReportSnapshot,
} from "../data/reportsMock"
import { DownloadIcon, PrintIcon } from "../icons"

function riskStyles(label: ResidentReportSnapshot["riskLabel"]): { bg: string; color: string } {
  switch (label) {
    case "High":
      return { bg: "var(--va-red-50)", color: "var(--va-red-700)" }
    case "Medium":
      return { bg: "var(--va-amber-50)", color: "var(--va-amber-700)" }
    default:
      return { bg: "var(--va-emerald-100)", color: "var(--va-emerald-700)" }
  }
}

function sentimentStyles(label: ResidentReportSnapshot["sentimentLabel"]): { bg: string; color: string } {
  switch (label) {
    case "Declining":
      return { bg: "var(--va-red-50)", color: "var(--va-red-700)" }
    case "Improving":
      return { bg: "var(--va-emerald-100)", color: "var(--va-emerald-700)" }
    default:
      return { bg: "var(--va-slate-100)", color: "var(--va-slate-600)" }
  }
}

function localizedRiskLabel(t: (key: string) => string, label: ResidentReportSnapshot["riskLabel"]): string {
  const map: Record<ResidentReportSnapshot["riskLabel"], string> = {
    High: t("reports.riskHigh"),
    Medium: t("reports.riskMedium"),
    Low: t("reports.riskLow"),
  }
  return map[label] ?? label
}

function localizedSentimentLabel(t: (key: string) => string, label: ResidentReportSnapshot["sentimentLabel"]): string {
  const map: Record<ResidentReportSnapshot["sentimentLabel"], string> = {
    Declining: t("reports.sentimentDeclining"),
    Improving: t("reports.sentimentImproving"),
    Stable: t("reports.sentimentStable"),
  }
  return map[label] ?? label
}

/** Dev-only mock resident tab — not imported in production builds. */
export function ReportsResidentTabMock() {
  const { t } = useTranslation()
  const [residentId, setResidentId] = useState(residentReportSnapshots[0]?.id ?? "")

  const selectedResident = useMemo(
    () => residentReportSnapshots.find((r) => r.id === residentId) ?? residentReportSnapshots[0],
    [residentId],
  )

  const residentPayload = useMemo(
    () => (selectedResident ? getResidentDigestPayload(selectedResident) : null),
    [selectedResident],
  )

  if (!selectedResident || !residentPayload) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <MockDataBanner testId="reports-resident-tab-mock-banner" />
      <AuthSelectField
        label={t("reports.residentLabel")}
        labelClassName="va-reports-field-label"
        selectClassName="va-reports-select"
        selectTestId="reports-resident-select"
        style={{ maxWidth: 360 }}
        value={selectedResident.id}
        onChange={(e) => setResidentId(e.target.value)}
      >
        {residentReportSnapshots.map((r) => (
          <option key={r.id} value={r.id}>
            {t("reports.residentOption", { name: r.displayName, room: r.room })}
          </option>
        ))}
      </AuthSelectField>

      <div className="va-card" style={{ overflow: "hidden" }}>
        <div
          style={{
            padding: "1.25rem 1.5rem",
            background: "linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, var(--va-slate-50) 100%)",
            borderBottom: "1px solid var(--va-slate-100)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--va-navy)", margin: 0 }}>{selectedResident.displayName}</h2>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
                {t("reports.lastDigest", { room: selectedResident.room, digest: selectedResident.lastDigest })}
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <span
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: 999,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  ...riskStyles(selectedResident.riskLabel),
                }}
              >
                {t("reports.riskChip", { label: localizedRiskLabel(t, selectedResident.riskLabel) })}
              </span>
              <span
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: 999,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  ...sentimentStyles(selectedResident.sentimentLabel),
                }}
              >
                {t("reports.sentimentChip", { label: localizedSentimentLabel(t, selectedResident.sentimentLabel) })}
              </span>
            </div>
          </div>
        </div>
        <div className="va-card-pad" style={{ paddingTop: "1.25rem" }}>
          <p style={{ margin: "0 0 1rem", fontSize: "0.8125rem", color: "var(--va-slate-500)", lineHeight: 1.5 }}>
            {t("reports.snapshotNote")}
          </p>
          <ReportDocumentBody payload={residentPayload} />
          <div className="va-report-modal-actions" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
            <button type="button" className="va-btn-secondary" onClick={() => printResidentDigest(selectedResident)}>
              <PrintIcon size={18} />
              {t("reports.printPdf")}
            </button>
            <button type="button" className="va-btn-secondary" onClick={() => downloadResidentDigestCsv(selectedResident)}>
              <DownloadIcon size={18} />
              {t("reports.downloadDataCsv")}
            </button>
            <Link
              to="/residents"
              className="va-btn-secondary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              {t("reports.residentsList")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
