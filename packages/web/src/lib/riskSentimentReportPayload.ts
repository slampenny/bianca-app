import type { Client } from "../services/api/api.types"
import { mapClientToResident } from "./liveData"

function riskLevelLabel(riskLevel: ReturnType<typeof mapClientToResident>["riskLevel"]): string {
  switch (riskLevel) {
    case "high":
      return "High"
    case "medium":
      return "Medium"
    case "low":
      return "Low"
    default:
      return "None"
  }
}

function sentimentLabel(dir: Client["sentimentTrendDirection"]): string {
  if (dir === "improving") return "Improving"
  if (dir === "declining") return "Declining"
  if (dir === "stable") return "Stable"
  return "—"
}

export function riskSentimentReportSubtitle(clientCount: number, scopeFullOrganization: boolean): string {
  if (scopeFullOrganization) {
    return `All residents (${clientCount})`
  }
  return `Your residents (${clientCount})`
}

/** One table row (without per-resident trend series — use the live report for sparklines). */
export function buildRiskSentimentTableRowStrings(client: Client): [string, string, string, string, string] {
  const r = mapClientToResident(client)
  const name = (client.preferredName || client.name || "—").trim()
  const room = (client.room && String(client.room).trim()) || "—"
  const risk = riskLevelLabel(r.riskLevel)
  const sentiment = sentimentLabel(client.sentimentTrendDirection)
  let notes = "—"
  if (
    (client.sentimentAnalyzedConversations ?? 0) === 0 &&
    client.latestOverallRiskScore == null &&
    !client.sentimentTrendDirection
  ) {
    notes = "No analysis yet"
  } else if (r.riskType === "sentiment") {
    notes = "Sentiment-driven risk signal"
  }
  return [name, room, risk, sentiment, notes]
}

export function buildRiskSentimentCsvExport(clients: Client[]): { headers: string[]; rows: string[][] } {
  const headers = [
    "Resident",
    "Room",
    "Risk level",
    "Sentiment",
    "Sentiment trend (30d)",
    "Notes",
  ]
  const rows = [...clients]
    .map((c) => {
      const [name, room, risk, sentiment, notes] = buildRiskSentimentTableRowStrings(c)
      return [name, room, risk, sentiment, "", notes]
    })
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
  return { headers, rows }
}
