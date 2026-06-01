import type { ActivityFeedItem } from "../services/api/activityApi"
import type { Client } from "../services/api/api.types"
import type { ReportsSummaryResponse } from "../services/api/facilityReportsApi"
import { clientDisplayName } from "./clientDisplayName"
import { mapClientToResident } from "./liveData"
import type { LiveResidentReportView } from "./residentReportLive"

function escapeCsvCell(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const lines = [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type LiveFacilityCsvInput = {
  orgName: string
  summary: ReportsSummaryResponse
  residents: LiveResidentReportView[]
  recentActivity: ActivityFeedItem[]
}

/** CSV built only from live API data already on the Reports page. */
export function downloadLiveFacilityReportsCsv(input: LiveFacilityCsvInput): void {
  const day = new Date().toISOString().slice(0, 10)
  const headers = ["Record type", "Col1", "Col2", "Col3", "Col4", "Col5", "Col6", "Col7"]
  const rows: string[][] = []

  rows.push(["Summary", "Organization", input.orgName, "", "", "", "", ""])
  rows.push(["Summary", "Digests generated this month", String(input.summary.generatedThisMonth), "", "", "", "", ""])
  rows.push(["Summary", "Active call schedules", String(input.summary.scheduledDeliveries), "", "", "", "", ""])
  rows.push(["Summary", "Residents with open follow-ups", String(input.summary.residentsWithOpenFollowUps), "", "", "", "", ""])
  rows.push(["Summary", "Last facility report", input.summary.lastFacilityReportLabel || "—", "", "", "", "", ""])
  rows.push(["Summary", "Compliance posture", input.summary.complianceScoreLabel || "—", "", "", "", "", ""])

  for (const item of input.recentActivity) {
    rows.push([
      "Activity",
      item.type,
      item.residentName || "—",
      item.occurredAt,
      item.alertSummary || item.callType || "—",
      "",
      "",
      "",
    ])
  }

  for (const r of input.residents) {
    rows.push([
      "Resident",
      r.displayName,
      r.room,
      r.statusLabel,
      r.lastCallLabel,
      String(r.openAlertCount),
      r.riskLabel,
      r.sentimentLabel,
    ])
  }

  downloadCsv(`bianca-facility-reports-${day}.csv`, headers, rows)
}

/** Build resident rows for CSV from client list + open alert counts. */
export function residentsForLiveCsv(
  clients: Client[],
  openAlertsByClient: Map<string, number>,
  labels: {
    status: (status: ReturnType<typeof mapClientToResident>["status"]) => string
    notAvailable: string
    risk: (level: ReturnType<typeof mapClientToResident>["riskLevel"]) => string | null
    sentiment: (dir: Client["sentimentTrendDirection"]) => string | null
    lastCall: (client: Client) => string
  },
): LiveResidentReportView[] {
  return clients.map((client) => {
    const resident = mapClientToResident(client)
    const id = resident.id
    const risk = labels.risk(resident.riskLevel)
    const sentiment = labels.sentiment(client.sentimentTrendDirection ?? null)
    return {
      clientId: id,
      displayName: resident.displayName,
      room: resident.room,
      statusLabel: labels.status(resident.status),
      lastCallLabel: labels.lastCall(client),
      openAlertCount: openAlertsByClient.get(id) ?? 0,
      riskLabel: risk ?? labels.notAvailable,
      sentimentLabel: sentiment ?? labels.notAvailable,
      sentimentInsights: [],
    }
  })
}
