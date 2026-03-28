/** Illustrative data for Reports UI — replace with API when ready. */

export const facilityReportStats = {
  generatedThisMonth: 186,
  scheduledDeliveries: 12,
  residentsFlaggedInReports: 8,
  lastFacilityReportLabel: "Mar 24, 2026 · 06:15",
  complianceScoreLabel: "Strong",
}

export type ReportTemplateId =
  | "wellness_daily"
  | "call_log"
  | "alert_audit"
  | "consent_roster"
  | "family_weekly_digest"
  | "risk_sentiment"

/** Payloads generated outside the template library (e.g. per-resident care snapshot). */
export type ReportPayloadSourceId = ReportTemplateId | "resident_care_snapshot"

export interface ReportTemplate {
  id: ReportTemplateId
  title: string
  subtitle: string
  description: string
  cadence: string
  tags: string[]
}

export const reportTemplates: ReportTemplate[] = [
  {
    id: "wellness_daily",
    title: "Daily wellness digest",
    subtitle: "Per resident",
    description:
      "Narrative summary of check-in calls, mood cues, and follow-ups suggested by Bianca for handoff at shift change.",
    cadence: "Daily · 06:00",
    tags: ["Clinical", "Handoff"],
  },
  {
    id: "call_log",
    title: "Call completion log",
    subtitle: "Facility or wing",
    description:
      "Attempted vs completed calls, duration buckets, and no-answer streaks for QA and staffing reviews.",
    cadence: "Weekly",
    tags: ["Operations", "QA"],
  },
  {
    id: "alert_audit",
    title: "Alert audit trail",
    subtitle: "Facility-wide",
    description:
      "Every alert raised, severity, related resident, who acknowledged it, and timestamps for governance.",
    cadence: "On demand",
    tags: ["Compliance", "Risk"],
  },
  {
    id: "consent_roster",
    title: "Consent & program roster",
    subtitle: "Directory",
    description:
      "Residents on Bianca schedules, consent on file, primary contact, and last successful engagement.",
    cadence: "Monthly",
    tags: ["Admin", "PII"],
  },
  {
    id: "family_weekly_digest",
    title: "Weekly family call digest",
    subtitle: "One authorized recipient · one resident",
    description:
      "High-level recap of wellness check-in calls for the week: whether they connected, tone in plain language, and benign themes — no transcripts, no clinical detail.",
    cadence: "Weekly · e.g. Sunday evening",
    tags: ["Family", "Calls"],
  },
  {
    id: "risk_sentiment",
    title: "Risk & sentiment trend",
    subtitle: "Per resident",
    description:
      "Rolling risk level, sentiment direction, and notable themes compared to the prior 30 days.",
    cadence: "Weekly",
    tags: ["Clinical", "Trend"],
  },
]

export interface ReportTable {
  caption?: string
  headers: string[]
  rows: string[][]
}

/** Single source for on-screen preview, print dialog, and CSV download. */
export interface ReportPayload {
  id: ReportPayloadSourceId
  title: string
  subtitle: string
  facilityLine: string
  generatedAtLabel: string
  narrative?: string[]
  tables: ReportTable[]
}

/** Shown on Reports — explains daily (staff) vs weekly (family) without implying unsafe blast sends. */
export const staffVersusFamilyDigestCopy = {
  title: "Why staff digests can be daily, but family updates are weekly",
  body: [
    "Daily handoff digests for care teams are meant to stay inside the facility’s authenticated tools. The audience is known: staff with role-based access to the resident record. Nothing is emailed to a broad list by default.",
    "When you contact families, you cross a privacy boundary. A weekly digest is built for one authorized relationship at a time (verified on file, with consent). Content stays high-level — connected or not, general mood, safe themes — not raw transcripts or clinical detail.",
    "If something urgent comes up, the safer pattern is a direct call or charted outreach from staff — not an automated daily blast to “family” where routing could be wrong.",
  ],
} as const

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
            headers: ["Time", "Resident", "Outcome", "Duration"],
            rows: [
              ["06:12", "E. Briggs", "Completed", "4 min"],
              ["06:30", "J. Okoro", "No answer", "—"],
              ["07:05", "M. Liu", "Completed", "6 min"],
              ["07:22", "R. Santos", "Completed", "3 min"],
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

function escapeCsvCell(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`
}

export function downloadMockCsv(filename: string, headers: string[], rows: string[][]): void {
  const lines = [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
    downloadMockCsv(`bianca-${id}-${day}.csv`, headers, rows)
    return
  }
  const primary = p.tables[0]
  if (!primary) return
  downloadMockCsv(`bianca-${id}-${day}.csv`, primary.headers, primary.rows)
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function payloadToPrintableHtml(p: ReportPayload): string {
  const narrativeBlock =
    p.narrative && p.narrative.length > 0
      ? `<ul>${p.narrative.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
      : ""
  const tablesBlock = p.tables
    .map((tab) => {
      const cap = tab.caption ? `<p class="cap">${escapeHtml(tab.caption)}</p>` : ""
      const head = `<tr>${tab.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`
      const body = tab.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")
      return `${cap}<table><thead>${head}</thead><tbody>${body}</tbody></table>`
    })
    .join("")

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(p.title)}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding: 28px; color: #0f172a; max-width: 720px; margin: 0 auto; line-height: 1.45; }
  .brand { font-weight: 700; font-size: 1.05rem; letter-spacing: 0.02em; margin-bottom: 20px; }
  .brand .dot { color: #14b8a6; }
  h1 { font-size: 1.35rem; margin: 0 0 6px; font-weight: 700; }
  .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 18px; }
  .cap { font-weight: 600; font-size: 0.875rem; margin: 18px 0 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 0.8125rem; margin-bottom: 8px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 600; }
  ul { font-size: 0.875rem; margin: 0 0 16px; padding-left: 1.25rem; }
</style></head><body>
  <div class="brand">bianca<span class="dot">.</span></div>
  <h1>${escapeHtml(p.title)}</h1>
  <p class="meta">${escapeHtml(p.subtitle)} · ${escapeHtml(p.facilityLine)} · ${escapeHtml(p.generatedAtLabel)}</p>
  ${narrativeBlock}
  ${tablesBlock}
</body></html>`
}

/** Same structured report as on screen; opens the browser print dialog (save as PDF from there). */
export function printReportFromPayload(p: ReportPayload): void {
  const html = payloadToPrintableHtml(p)
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  })
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) {
    iframe.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  const cleanup = () => {
    try {
      iframe.remove()
    } catch {
      /* ignore */
    }
  }
  win.addEventListener("afterprint", cleanup)
  win.focus()
  requestAnimationFrame(() => {
    win.print()
    setTimeout(cleanup, 2_000)
  })
}

export function printReport(id: ReportTemplateId): void {
  printReportFromPayload(getReportPayload(id))
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
  downloadMockCsv(`bianca-resident-${r.displayName.replace(/\s+/g, "-").toLowerCase()}-${day}.csv`, t.headers, t.rows)
}
