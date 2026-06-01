import type { ApiAlertRecord, Client, SentimentSummary } from "../services/api/api.types"
import { clientDisplayName } from "./clientDisplayName"
import { apiRecordId, mapClientToResident } from "./liveData"

export type LiveResidentReportView = {
  clientId: string
  displayName: string
  room: string
  statusLabel: string
  lastCallLabel: string
  openAlertCount: number
  riskLabel: string
  sentimentLabel: string
  sentimentInsights: string[]
}

export function countOpenAlertsByClient(alerts: ApiAlertRecord[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const alert of alerts) {
    if (alert.resolvedAt) continue
    const clientId = alert.relatedClient != null ? String(alert.relatedClient).trim() : ""
    if (!clientId) continue
    counts.set(clientId, (counts.get(clientId) ?? 0) + 1)
  }
  return counts
}

export function formatClientLastCall(client: Client, notAvailable: string): string {
  const iso = client.lastAnsweredCallAt || client.lastCallAttemptAt
  if (!iso) return notAvailable
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return notAvailable
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function liveRiskLabel(
  client: Client,
  notAvailable: string,
  labels: { high: string; medium: string; low: string; none: string },
): string {
  const resident = mapClientToResident(client)
  switch (resident.riskLevel) {
    case "high":
      return labels.high
    case "medium":
      return labels.medium
    case "low":
      return labels.low
    case "none":
      if (client.latestOverallRiskScore != null || client.sentimentTrendDirection === "declining") {
        return labels.none
      }
      return notAvailable
    default:
      return notAvailable
  }
}

export function liveSentimentLabel(
  client: Client,
  summary: SentimentSummary | undefined,
  notAvailable: string,
  labels: { improving: string; stable: string; declining: string },
): string {
  const dir = summary?.trendDirection ?? client.sentimentTrendDirection
  if (!dir) {
    if ((client.sentimentAnalyzedConversations ?? 0) === 0 && !summary) return notAvailable
    return notAvailable
  }
  if (dir === "improving") return labels.improving
  if (dir === "declining") return labels.declining
  return labels.stable
}

export function buildLiveResidentReportView(args: {
  client: Client
  openAlertCount: number
  summary: SentimentSummary | undefined
  notAvailable: string
  statusLabel: string
  riskLabels: { high: string; medium: string; low: string; none: string }
  sentimentLabels: { improving: string; stable: string; declining: string }
}): LiveResidentReportView {
  const { client, openAlertCount, summary, notAvailable, statusLabel, riskLabels, sentimentLabels } = args
  const resident = mapClientToResident(client)
  return {
    clientId: apiRecordId(client),
    displayName: clientDisplayName(client),
    room: resident.room,
    statusLabel,
    lastCallLabel: formatClientLastCall(client, notAvailable),
    openAlertCount,
    riskLabel: liveRiskLabel(client, notAvailable, riskLabels),
    sentimentLabel: liveSentimentLabel(client, summary, notAvailable, sentimentLabels),
    sentimentInsights: summary?.keyInsights?.slice(0, 3) ?? [],
  }
}
