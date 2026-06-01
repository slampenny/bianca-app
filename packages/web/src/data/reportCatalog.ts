/** Report template metadata and payload shapes — no sample/mock row data. */

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

/** Structured report document used for on-screen render, print, and CSV export. */
export interface ReportPayload {
  id: ReportPayloadSourceId
  title: string
  subtitle: string
  facilityLine: string
  generatedAtLabel: string
  narrative?: string[]
  tables: ReportTable[]
}

export function isReportTemplateId(id: string | undefined): id is ReportTemplateId {
  return id !== undefined && reportTemplates.some((t) => t.id === id)
}
