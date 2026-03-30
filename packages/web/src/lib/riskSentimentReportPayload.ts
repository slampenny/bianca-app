import type { ReportPayload } from "../data/reportsMock"
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

/** Same risk/sentiment signals as the Residents list and mobile home (merged client payload). */
export function buildRiskSentimentReportPayload(
  clients: Client[],
  opts: { facilityLine: string; generatedAtLabel: string },
): ReportPayload {
  const rows = [...clients]
    .map((c) => {
      const r = mapClientToResident(c)
      const name = (c.preferredName || c.name || "—").trim()
      const room = (c.room && String(c.room).trim()) || "—"
      const risk = riskLevelLabel(r.riskLevel)
      const sentiment = sentimentLabel(c.sentimentTrendDirection)
      let notes = "—"
      if (
        (c.sentimentAnalyzedConversations ?? 0) === 0 &&
        c.latestOverallRiskScore == null &&
        !c.sentimentTrendDirection
      ) {
        notes = "No analysis yet"
      } else if (r.riskType === "sentiment") {
        notes = "Sentiment-driven risk signal"
      }
      return [name, room, risk, sentiment, notes]
    })
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))

  return {
    id: "risk_sentiment",
    title: "Risk & sentiment trend",
    subtitle: `All residents (${clients.length})`,
    facilityLine: opts.facilityLine,
    generatedAtLabel: opts.generatedAtLabel,
    narrative: [
      "Figures below match the Residents list and the mobile app home screen: latest fraud/abuse risk score and recent conversation sentiment summary.",
      'Residents with no completed analyses yet show "None" / "—" until data exists.',
    ],
    tables: [
      {
        caption: "Roster · current signals",
        headers: ["Resident", "Room", "Risk level", "Sentiment", "Notes"],
        rows,
      },
    ],
  }
}
