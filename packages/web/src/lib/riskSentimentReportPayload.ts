import type { TFunction } from "i18next"
import type { Client } from "../services/api/api.types"
import { clientDisplayName } from "./clientDisplayName"
import { mapClientToResident } from "./liveData"

function riskLevelLabel(riskLevel: ReturnType<typeof mapClientToResident>["riskLevel"], t: TFunction): string {
  switch (riskLevel) {
    case "high":
      return t("riskSentimentReport.riskHigh")
    case "medium":
      return t("riskSentimentReport.riskMedium")
    case "low":
      return t("riskSentimentReport.riskLow")
    default:
      return t("riskSentimentReport.riskNone")
  }
}

function sentimentLabel(dir: Client["sentimentTrendDirection"], t: TFunction): string {
  if (dir === "improving") return t("riskSentimentReport.sentimentImproving")
  if (dir === "declining") return t("riskSentimentReport.sentimentDeclining")
  if (dir === "stable") return t("riskSentimentReport.sentimentStable")
  return t("common.emDash")
}

export function riskSentimentReportSubtitle(clientCount: number, scopeFullOrganization: boolean, t: TFunction): string {
  if (scopeFullOrganization) {
    return t("riskSentimentReport.scopeAll", { count: clientCount })
  }
  return t("riskSentimentReport.scopeYours", { count: clientCount })
}

/** One table row (without per-resident trend series — use the live report for sparklines). */
export function buildRiskSentimentTableRowStrings(client: Client, t: TFunction): [string, string, string, string, string] {
  const r = mapClientToResident(client)
  const name = clientDisplayName(client)
  const room = (client.room && String(client.room).trim()) || t("common.emDash")
  const risk = riskLevelLabel(r.riskLevel, t)
  const sentiment = sentimentLabel(client.sentimentTrendDirection, t)
  let notes = t("common.emDash")
  if (
    (client.sentimentAnalyzedConversations ?? 0) === 0 &&
    client.latestOverallRiskScore == null &&
    !client.sentimentTrendDirection
  ) {
    notes = t("riskSentimentReport.notesNoAnalysis")
  } else if (r.riskType === "sentiment") {
    notes = t("riskSentimentReport.notesSentimentDriven")
  }
  return [name, room, risk, sentiment, notes]
}

export function buildRiskSentimentCsvExport(clients: Client[], t: TFunction): { headers: string[]; rows: string[][] } {
  const headers = [
    t("riskSentimentReport.colResident"),
    t("riskSentimentReport.colRoom"),
    t("riskSentimentReport.colRisk"),
    t("riskSentimentReport.colSentiment"),
    t("riskSentimentReport.colTrend"),
    t("riskSentimentReport.colNotes"),
  ]
  const rows = [...clients]
    .map((c) => {
      const [name, room, risk, sentiment, notes] = buildRiskSentimentTableRowStrings(c, t)
      return [name, room, risk, sentiment, "", notes]
    })
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
  return { headers, rows }
}
