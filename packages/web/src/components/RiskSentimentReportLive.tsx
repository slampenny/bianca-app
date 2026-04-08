import { useMemo } from "react"
import { downloadMockCsv } from "../data/reportsMock"
import { buildRiskSentimentCsvExport, buildRiskSentimentTableRowStrings, riskSentimentReportSubtitle } from "../lib/riskSentimentReportPayload"
import type { Client } from "../services/api/api.types"
import { useGetSentimentTrendQuery } from "../services/api/sentimentApi"
import { SentimentTrendSparkline } from "./SentimentTrendSparkline"
import { PrintIcon, DownloadIcon } from "../icons"

function RiskSentimentTableRow({ client }: { client: Client }) {
  const id = String(client.id ?? "")
  const [name, room, risk, sentiment, notes] = useMemo(() => buildRiskSentimentTableRowStrings(client), [client])
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
        <span style={{ color: "var(--va-slate-400)", fontSize: "0.75rem" }} title="Could not load trend">
          —
        </span>
      )
    }
    return <SentimentTrendSparkline points={data.dataPoints ?? []} />
  }, [data, isError, isLoading])

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
  const subtitle = riskSentimentReportSubtitle(clients.length, scopeFullOrganization)

  const onPrint = () => {
    window.print()
  }

  const onCsv = () => {
    const { headers, rows } = buildRiskSentimentCsvExport(clients)
    const day = new Date().toISOString().slice(0, 10)
    downloadMockCsv(`${filenameBase}-${day}.csv`, headers, rows)
  }

  return (
    <>
      <div className="va-report-doc va-report-risk-sentiment-print" data-testid="risk-sentiment-live-report">
        <div className="va-report-doc-brand">
          bianca<span className="va-report-doc-brand-dot">.</span>
        </div>
        <h2 className="va-report-doc-title">Risk & sentiment trend</h2>
        <p className="va-report-doc-meta">
          {subtitle} · {facilityLine} · {generatedAtLabel}
        </p>
        <ul className="va-report-doc-narrative">
          <li>
            Figures below match the Residents list and the mobile app home screen: latest fraud/abuse risk score and
            recent conversation sentiment summary.
          </li>
          <li>Residents with no completed analyses yet show &quot;None&quot; / &quot;—&quot; until data exists.</li>
          <li>
            Sparklines use sentiment scores from analyzed calls in the past month (same data as the resident detail
            sentiment tab).
          </li>
        </ul>
        <div className="va-report-doc-table-cap">Roster · current signals</div>
        <table className="va-report-doc-table">
          <thead>
            <tr>
              <th>Resident</th>
              <th>Room</th>
              <th>Risk level</th>
              <th>Sentiment</th>
              <th>Sentiment trend (30d)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--va-slate-500)" }}>
                  No assigned residents match this report.
                </td>
              </tr>
            ) : (
              clients.map((c) => <RiskSentimentTableRow key={String(c.id ?? "")} client={c} />)
            )}
          </tbody>
        </table>
      </div>
      <div className="va-report-modal-actions va-no-print">
        <button type="button" className="va-btn-secondary" onClick={onPrint}>
          <PrintIcon size={18} />
          Print / Save as PDF
        </button>
        <button type="button" className="va-btn-secondary" onClick={onCsv}>
          <DownloadIcon size={18} />
          Download data (CSV)
        </button>
      </div>
    </>
  )
}
