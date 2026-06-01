import { skipToken } from "@reduxjs/toolkit/query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { AuthSelectField } from "../components/AuthSelectField"
import { clientDisplayName } from "../lib/clientDisplayName"
import { apiRecordId, mapClientToResident } from "../lib/liveData"
import {
  buildLiveResidentReportView,
  countOpenAlertsByClient,
  type LiveResidentReportView,
} from "../lib/residentReportLive"
import type { ApiAlertRecord, Client } from "../services/api/api.types"
import { useGetSentimentSummaryQuery } from "../services/api/sentimentApi"

type Props = {
  clients: Client[]
  alerts: ApiAlertRecord[]
  clientsLoading: boolean
  clientsError: boolean
  selectedClientId: string
  onSelectClientId: (id: string) => void
}

function statusLabelFor(
  t: (key: string) => string,
  status: ReturnType<typeof mapClientToResident>["status"],
): string {
  switch (status) {
    case "active":
      return t("reports.residentStatusActive")
    case "at_risk":
      return t("reports.residentStatusAtRisk")
    default:
      return t("reports.residentStatusInactive")
  }
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.5rem 0", borderBottom: "1px solid var(--va-slate-100)" }}>
      <span style={{ fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--va-navy)", textAlign: "right" }}>{value}</span>
    </div>
  )
}

function ResidentDetailCard({ view, t }: { view: LiveResidentReportView; t: (key: string, opts?: Record<string, unknown>) => string }) {
  return (
    <div className="va-card" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "1.25rem 1.5rem",
          background: "linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, var(--va-slate-50) 100%)",
          borderBottom: "1px solid var(--va-slate-100)",
        }}
      >
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--va-navy)", margin: 0 }}>{view.displayName}</h2>
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "var(--va-slate-500)" }}>
          {t("reports.residentRoomLine", { room: view.room })}
        </p>
      </div>
      <div className="va-card-pad" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <MetricRow label={t("reports.residentStatus")} value={view.statusLabel} />
        <MetricRow label={t("reports.residentLastCall")} value={view.lastCallLabel} />
        <MetricRow
          label={t("reports.residentOpenAlerts")}
          value={String(view.openAlertCount)}
        />
        <MetricRow label={t("reports.residentRisk")} value={view.riskLabel} />
        <MetricRow label={t("reports.residentSentiment")} value={view.sentimentLabel} />
        {view.sentimentInsights.length > 0 ? (
          <div style={{ marginTop: "0.75rem" }}>
            <p style={{ margin: "0 0 0.35rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--va-slate-600)" }}>
              {t("reports.residentInsights")}
            </p>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--va-slate-600)", lineHeight: 1.5 }}>
              {view.sentimentInsights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginTop: "1rem" }}>
          <Link
            to={`/residents/${view.clientId}`}
            className="va-btn-secondary"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            {t("reports.residentViewProfile")}
          </Link>
          <Link
            to="/residents"
            className="va-btn-ghost"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", fontSize: "0.8125rem" }}
          >
            {t("reports.residentsList")}
          </Link>
        </div>
      </div>
    </div>
  )
}

export function ReportsResidentTabLive({
  clients,
  alerts,
  clientsLoading,
  clientsError,
  selectedClientId,
  onSelectClientId,
}: Props) {
  const { t } = useTranslation()
  const notAvailable = t("reports.notAvailable")

  const openAlertsByClient = useMemo(() => countOpenAlertsByClient(alerts), [alerts])

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        clientDisplayName(a).localeCompare(clientDisplayName(b), undefined, { sensitivity: "base" }),
      ),
    [clients],
  )

  const effectiveClientId = selectedClientId || (sortedClients[0] ? apiRecordId(sortedClients[0]) : "")

  const selectedClient = useMemo(
    () => sortedClients.find((c) => apiRecordId(c) === effectiveClientId) ?? sortedClients[0],
    [sortedClients, effectiveClientId],
  )

  const { data: sentimentSummary, isLoading: sentimentLoading } = useGetSentimentSummaryQuery(
    selectedClient ? { clientId: apiRecordId(selectedClient) } : skipToken,
  )

  const view = useMemo((): LiveResidentReportView | null => {
    if (!selectedClient) return null
    const id = apiRecordId(selectedClient)
    return buildLiveResidentReportView({
      client: selectedClient,
      openAlertCount: openAlertsByClient.get(id) ?? 0,
      summary: sentimentSummary,
      notAvailable,
      statusLabel: statusLabelFor(t, mapClientToResident(selectedClient).status),
      riskLabels: {
        high: t("reports.riskHigh"),
        medium: t("reports.riskMedium"),
        low: t("reports.riskLow"),
        none: t("reports.riskLow"),
      },
      sentimentLabels: {
        improving: t("reports.sentimentImproving"),
        stable: t("reports.sentimentStable"),
        declining: t("reports.sentimentDeclining"),
      },
    })
  }, [selectedClient, openAlertsByClient, sentimentSummary, notAvailable, t])

  if (clientsLoading) {
    return <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem" }}>{t("reports.residentLoading")}</p>
  }

  if (clientsError) {
    return <p style={{ color: "var(--va-red-600)", fontSize: "0.875rem" }} role="alert">{t("reports.loadResidentsError")}</p>
  }

  if (sortedClients.length === 0) {
    return (
      <div className="va-card va-card-pad">
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--va-slate-600)", lineHeight: 1.55 }}>{t("reports.residentNoClients")}</p>
      </div>
    )
  }

  return (
    <div data-testid="reports-resident-tab-live" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-500)", lineHeight: 1.5 }}>{t("reports.residentLiveIntro")}</p>
      <AuthSelectField
        label={t("reports.residentLabel")}
        labelClassName="va-reports-field-label"
        selectClassName="va-reports-select"
        selectTestId="reports-resident-select"
        style={{ maxWidth: 360 }}
        value={effectiveClientId}
        onChange={(e) => onSelectClientId(e.target.value)}
      >
        {sortedClients.map((c) => {
          const id = apiRecordId(c)
          const resident = mapClientToResident(c)
          return (
            <option key={id} value={id}>
              {t("reports.residentOption", { name: clientDisplayName(c), room: resident.room })}
            </option>
          )
        })}
      </AuthSelectField>
      {sentimentLoading && !sentimentSummary ? (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--va-slate-500)" }}>{t("reports.residentSentimentLoading")}</p>
      ) : null}
      {view ? <ResidentDetailCard view={view} t={t} /> : null}
    </div>
  )
}
