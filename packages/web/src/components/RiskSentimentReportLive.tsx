import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { downloadMockCsv } from "../data/reportsMock"
import {
  buildRiskSentimentCsvExport,
  buildRiskSentimentTableRowStrings,
  riskSentimentReportSubtitle,
} from "../lib/riskSentimentReportPayload"
import type { Client } from "../services/api/api.types"
import { useGetSentimentTrendQuery } from "../services/api/sentimentApi"
import { SentimentTrendSparkline } from "./SentimentTrendSparkline"
import { PrintIcon, DownloadIcon } from "../icons"

function RiskSentimentTableRow({ client, t }: { client: Client; t: ReturnType<typeof useTranslation>["t"] }) {
  const id = String(client.id ?? "")
  const [name, room, risk, sentiment, notes] = useMemo(() => buildRiskSentimentTableRowStrings(client, t), [client, t])
  const { data, isLoading, isError } = useGetSentimentTrendQuery(
    { clientId: id, timeRange: "month" },
    { skip: !id },
  )

  const spark = useMemo(() => {
    if (isLoading) {
      return <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }}>…</span>
    }
    if (isError || !data) {
      return (
        <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }} title={t("riskSentimentReport.trendLoadError")}>
          {t("common.emDash")}
        </span>
      )
    }
    return <SentimentTrendSparkline points={data.dataPoints ?? []} />
  }, [data, isError, isLoading, t])

  return (
    <tr>
      <td>{name}</td>
      <td>{room}</td>
      <td>{risk}</td>
      <td>{sentiment}</td>
      <td style={{ minWidth: 96 }}>{spark}</td>
      <td>{notes}</td>
    </tr>
  )
}

type Props = {
  clients: Client[]
  facilityLine: string
  generatedAtLabel: string
  scopeFullOrganization: boolean
  filenameBase: string
}

export function RiskSentimentReportLive({
  clients,
  facilityLine,
  generatedAtLabel,
  scopeFullOrganization,
  filenameBase,
}: Props) {
  const { t } = useTranslation()
  const subtitle = riskSentimentReportSubtitle(clients.length, scopeFullOrganization, t)

  const onPrint = () => {
    window.print()
  }

  const onCsv = () => {
    const { headers, rows } = buildRiskSentimentCsvExport(clients, t)
    const day = new Date().toISOString().slice(0, 10)
    downloadMockCsv(`${filenameBase}-${day}.csv`, headers, rows)
  }

  return (
    <>
      <div className="va-report-doc va-report-risk-sentiment-print" data-testid="risk-sentiment-live-report">
        <div className="va-report-doc-brand">
          bianca<span className="va-report-doc-brand-dot">.</span>
        </div>
        <h2 className="va-report-doc-title">{t("riskSentimentReport.title")}</h2>
        <p className="va-report-doc-meta">
          {subtitle} · {facilityLine} · {generatedAtLabel}
        </p>
        <ul className="va-report-doc-narrative">
          <li>{t("riskSentimentReport.narrative0")}</li>
          <li>{t("riskSentimentReport.narrative1")}</li>
          <li>{t("riskSentimentReport.narrative2")}</li>
        </ul>
        <div className="va-report-doc-table-cap">{t("riskSentimentReport.rosterCaption")}</div>
        <table className="va-report-doc-table">
          <thead>
            <tr>
              <th>{t("riskSentimentReport.colResident")}</th>
              <th>{t("riskSentimentReport.colRoom")}</th>
              <th>{t("riskSentimentReport.colRisk")}</th>
              <th>{t("riskSentimentReport.colSentiment")}</th>
              <th>{t("riskSentimentReport.colTrend")}</th>
              <th>{t("riskSentimentReport.colNotes")}</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--va-slate-500)" }}>
                  {t("riskSentimentReport.emptyRoster")}
                </td>
              </tr>
            ) : (
              clients.map((c) => <RiskSentimentTableRow key={String(c.id ?? "")} client={c} t={t} />)
            )}
          </tbody>
        </table>
      </div>
      <div className="va-report-modal-actions va-no-print">
        <button type="button" className="va-btn-secondary" onClick={onPrint}>
          <PrintIcon size={18} />
          {t("riskSentimentReport.printPdf")}
        </button>
        <button type="button" className="va-btn-secondary" onClick={onCsv}>
          <DownloadIcon size={18} />
          {t("riskSentimentReport.downloadCsv")}
        </button>
      </div>
    </>
  )
}
