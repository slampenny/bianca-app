/** Dev-only illustrative report payloads — not imported by production pages. */

import type { ReportPayload, ReportTemplateId } from "./reportCatalog"

export type { ReportPayload, ReportTemplateId, ReportTemplate, ReportTable, ReportPayloadSourceId } from "./reportCatalog"
export { reportTemplates } from "./reportCatalog"

export const facilityReportStats = {
  generatedThisMonth: 186,
  scheduledDeliveries: 12,
  residentsFlaggedInReports: 8,
  lastFacilityReportLabel: "Mar 24, 2026 · 06:15",
  complianceScoreLabel: "Strong",
}

const FACILITY = "Sunrise Memory Care (sample)"
const NOW_LABEL = new Date().toLocaleString(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

export function getReportPayload(id: ReportTemplateId): ReportPayload {
  const base = {
    id,
    facilityLine: FACILITY,
    generatedAtLabel: NOW_LABEL,
  }
  switch (id) {
    case "wellness_daily":
      return {
        ...base,
        title: "Daily wellness digest",
        subtitle: "Wing B · Morning handoff",
        narrative: [
          "For care-team use inside Bianca / facility workflows only. Do not forward externally without minimum-necessary review.",
          "Summaries are synthesized from scheduled check-in calls — not raw recordings.",
        ],
        tables: [
          {
            caption: "Residents · overnight",
            headers: ["Resident", "Room", "Mood / tone", "Follow-up"],
            rows: [
              ["Eleanor Briggs", "204A", "Upbeat; engaged", "None"],
              ["James Okoro", "118", "Tired; sleep concerns", "Nursing touchpoint"],
              ["Margaret Liu", "312", "Calm; social", "Activities — walking group"],
            ],
          },
        ],
      }
    case "call_log":
      return {
        ...base,
        title: "Call completion log",
        subtitle: "Facility-wide · Last 48 hours",
        tables: [
          {
            headers: ["Date", "Time", "Resident", "Outcome", "Duration"],
            rows: [
              ["Apr 6, 2026", "06:12", "E. Briggs", "Completed", "4 min"],
              ["Apr 6, 2026", "06:30", "J. Okoro", "No answer", "—"],
              ["Apr 6, 2026", "07:05", "M. Liu", "Completed", "6 min"],
              ["Apr 6, 2026", "07:22", "R. Santos", "Completed", "3 min"],
            ],
          },
        ],
      }
    case "alert_audit":
      return {
        ...base,
        title: "Alert audit trail",
        subtitle: "March 2026 (sample window)",
        tables: [
          {
            headers: ["Alert ID", "Type", "Resident", "Raised", "Acknowledged by"],
            rows: [
              ["ALT-1042", "Financial concern", "—", "Mar 20", "M. Chen"],
              ["ALT-1048", "Clinical signal", "J. Okoro", "Mar 22", "J. Okonkwo"],
            ],
          },
        ],
      }
    case "consent_roster":
      return {
        ...base,
        title: "Consent & program roster",
        subtitle: "Active Bianca schedules",
        tables: [
          {
            headers: ["Resident", "Consent", "Schedule", "Last successful call"],
            rows: [
              ["Eleanor Briggs", "On file", "Daily 09:00", "Today"],
              ["James Okoro", "On file", "Daily 10:00", "Mar 25"],
              ["Margaret Liu", "On file", "Weekly Tue", "Mar 24"],
            ],
          },
        ],
      }
    case "family_weekly_digest":
      return {
        ...base,
        title: "Weekly call digest for families",
        subtitle: "For Sarah M. (daughter) · Your loved one: Eleanor",
        facilityLine: `${FACILITY} · Recipient-verified send (sample)`,
        narrative: [
          "You are receiving this because you are listed as an authorized contact. It describes wellness check-in calls only — not clinical care or medications.",
          "If this reached you by mistake, please contact the front desk and do not forward.",
        ],
        tables: [
          {
            caption: "Week at a glance · Mar 21–27, 2026",
            headers: ["Metric", "Detail"],
            rows: [
              ["Wellness calls placed", "5"],
              ["Times Eleanor answered", "4"],
              ["Typical conversation", "~4–6 minutes when connected"],
            ],
          },
          {
            caption: "Calls this week (plain-language summaries)",
            headers: ["Day", "Connected", "How it went"],
            rows: [
              ["Monday", "Yes", "Upbeat; chatted about nice weather and breakfast"],
              ["Tuesday", "Yes", "Engaged; mentioned the garden and walking group"],
              ["Wednesday", "No", "No answer — we’ll try again (normal)"],
              ["Thursday", "Yes", "Asked about your visit this weekend"],
              ["Friday", "Yes", "Relaxed tone; said she’d had a better night’s rest"],
            ],
          },
          {
            caption: "What’s not in this email",
            headers: ["Topic", "Instead"],
            rows: [
              ["Diagnoses, meds, vitals", "Call the care team or nurse line"],
              ["Full call recordings / word-for-word transcripts", "Not included by design"],
              ["Other residents or families", "Never — each send is scoped to one recipient"],
            ],
          },
        ],
      }
    case "risk_sentiment":
      return {
        ...base,
        title: "Risk & sentiment trend",
        subtitle: "James Okoro · Room 118",
        narrative: ["Rolling window: last 30 days (illustrative)."],
        tables: [
          {
            headers: ["Week", "Risk level", "Sentiment", "Notes"],
            rows: [
              ["Mar 3–9", "Medium", "Stable", "Baseline"],
              ["Mar 10–16", "Medium", "Stable", "—"],
              ["Mar 17–23", "High", "Declining", "Sleep complaints"],
            ],
          },
        ],
      }
  }
}

export type ReportDeliveryChannel = "Viewed" | "Printed" | "CSV" | "PDF"

export interface RecentReportActivityRow {
  id: string
  reportName: string
  scope: string
  whenLabel: string
  lastDelivery: ReportDeliveryChannel
  requestedBy: string
  status: "Ready" | "Scheduled"
}

export const recentReportActivity: RecentReportActivityRow[] = [
  {
    id: "1",
    reportName: "Daily wellness digest",
    scope: "All residents · Wing B",
    whenLabel: "Mar 27, 6:02 AM",
    lastDelivery: "PDF",
    requestedBy: "System",
    status: "Ready",
  },
  {
    id: "2",
    reportName: "Call completion log",
    scope: "Facility",
    whenLabel: "Mar 26, 5:40 PM",
    lastDelivery: "Viewed",
    requestedBy: "M. Chen",
    status: "Ready",
  },
  {
    id: "3",
    reportName: "Alert audit trail",
    scope: "Mar 1–Mar 26",
    whenLabel: "Mar 26, 9:00 AM",
    lastDelivery: "Printed",
    requestedBy: "J. Okonkwo",
    status: "Ready",
  },
  {
    id: "4",
    reportName: "Weekly family call digest",
    scope: "12 authorized contacts",
    whenLabel: "Mar 23, 8:00 PM",
    lastDelivery: "PDF",
    requestedBy: "System",
    status: "Ready",
  },
]

export const weeklyReportRuns = [
  { day: "Mon", runs: 28 },
  { day: "Tue", runs: 24 },
  { day: "Wed", runs: 31 },
  { day: "Thu", runs: 22 },
  { day: "Fri", runs: 26 },
  { day: "Sat", runs: 18 },
  { day: "Sun", runs: 14 },
]

export interface ResidentReportSnapshot {
  id: string
  displayName: string
  room: string
  riskLabel: "Low" | "Medium" | "High"
  sentimentLabel: "Stable" | "Improving" | "Declining"
  lastDigest: string
  openAlertsInReports: number
  highlights: string[]
}

export const residentReportSnapshots: ResidentReportSnapshot[] = [
  {
    id: "demo-1",
    displayName: "Eleanor Briggs",
    room: "204A",
    riskLabel: "Medium",
    sentimentLabel: "Stable",
    lastDigest: "Mar 27, 2026",
    openAlertsInReports: 1,
    highlights: [
      "Completed daily check-in · mood described as positive",
      "Mentioned family visit this weekend — note for activities",
    ],
  },
  {
    id: "demo-2",
    displayName: "James Okoro",
    room: "118",
    riskLabel: "High",
    sentimentLabel: "Declining",
    lastDigest: "Mar 26, 2026",
    openAlertsInReports: 2,
    highlights: [
      "Repeated concern about sleep — aligned with nursing note from Mar 25",
      "Suggested follow-up: medication review window this week",
    ],
  },
  {
    id: "demo-3",
    displayName: "Margaret Liu",
    room: "312",
    riskLabel: "Low",
    sentimentLabel: "Improving",
    lastDigest: "Mar 27, 2026",
    openAlertsInReports: 0,
    highlights: ["Consistent engagement · no new risk flags", "Participation in group call program up vs last week"],
  },
]

export { downloadReportCsv as downloadMockCsv, downloadReportPayloadCsv, printReportFromPayload } from "../lib/reportExport"
import { downloadReportCsv } from "../lib/reportExport"

function escapeCsvCell(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`
}

/** CSV from the same payload used for preview and print. */
export function downloadReportDataFile(id: ReportTemplateId): void {
  const p = getReportPayload(id)
  const day = new Date().toISOString().slice(0, 10)
  if (id === "family_weekly_digest") {
    const headers = ["Section", "Col 1", "Col 2", "Col 3"]
    const rows: string[][] = []
    for (const tab of p.tables) {
      const label = tab.caption ?? p.title
      for (const r of tab.rows) {
        rows.push([label, r[0] ?? "", r[1] ?? "", r[2] ?? ""])
      }
    }
    downloadReportCsv(`bianca-${id}-${day}.csv`, headers, rows)
    return
  }
  const primary = p.tables[0]
  if (!primary) return
  downloadReportCsv(`bianca-${id}-${day}.csv`, primary.headers, primary.rows)
}

/** Optional combined CSV for managers — still derived from payloads. */
export function downloadFacilitySnapshotCsv(): void {
  const day = new Date().toISOString().slice(0, 10)
  const w = getReportPayload("wellness_daily").tables[0]
  const c = getReportPayload("call_log").tables[0]
  const a = getReportPayload("alert_audit").tables[0]
  const lines: string[] = []
  lines.push(["Section", "Col1", "Col2", "Col3", "Col4"].map(escapeCsvCell).join(","))
  if (w) {
    lines.push(
      ...w.rows.map((r) =>
        ["Wellness", ...r].map(escapeCsvCell).join(","),
      ),
    )
  }
  if (c) {
    lines.push(
      ...c.rows.map((r) =>
        ["Calls", ...r].map(escapeCsvCell).join(","),
      ),
    )
  }
  if (a) {
    lines.push(
      ...a.rows.map((r) =>
        ["Alerts", ...r].map(escapeCsvCell).join(","),
      ),
    )
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const el = document.createElement("a")
  el.href = url
  el.download = `bianca-facility-snapshot-${day}.csv`
  el.click()
  URL.revokeObjectURL(url)
}

/** Staff-facing snapshot on the Per resident tab — not the same document families receive. */
export function getResidentDigestPayload(r: ResidentReportSnapshot): ReportPayload {
  return {
    id: "resident_care_snapshot",
    title: "Care team snapshot",
    subtitle: `${r.displayName} · Room ${r.room}`,
    facilityLine: FACILITY,
    generatedAtLabel: NOW_LABEL,
    narrative: [
      "Internal use — includes signals that must not be copied into a family digest without review.",
      ...r.highlights,
    ],
    tables: [
      {
        caption: "Signals",
        headers: ["Signal", "Value"],
        rows: [
          ["Risk", r.riskLabel],
          ["Sentiment", r.sentimentLabel],
          ["Open items in report queue", String(r.openAlertsInReports)],
          ["Last digest generated", r.lastDigest],
        ],
      },
    ],
  }
}

export function printResidentDigest(r: ResidentReportSnapshot): void {
  printReportFromPayload(getResidentDigestPayload(r))
}

export function downloadResidentDigestCsv(r: ResidentReportSnapshot): void {
  const p = getResidentDigestPayload(r)
  const t = p.tables[0]
  if (!t) return
  const day = new Date().toISOString().slice(0, 10)
  downloadReportCsv(`bianca-resident-${r.displayName.replace(/\s+/g, "-").toLowerCase()}-${day}.csv`, t.headers, t.rows)
}
