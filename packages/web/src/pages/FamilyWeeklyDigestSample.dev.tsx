import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ReportDocumentBody } from "../components/ReportDocumentBody"
import { MockDataBanner } from "../components/MockDataBanner"
import { getReportPayload } from "../data/reportsMock"
import { downloadReportPayloadCsv, printReportFromPayload } from "../lib/reportExport"
import { ChevronLeftIcon, DownloadIcon, PrintIcon } from "../icons"
import "../app.css"

/** Dev-only sample family digest preview (mock layout data). */
export function FamilyWeeklyDigestSample() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const payload = useMemo(() => getReportPayload("family_weekly_digest"), [])

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

      <MockDataBanner testId="family-weekly-digest-sample-banner" />

      <div className="va-card va-card-pad">
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
      </div>
    </div>
  )
}
