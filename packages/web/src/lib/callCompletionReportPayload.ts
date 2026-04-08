import type { CallCompletionLogResponse } from "../services/api/facilityReportsApi"
import type { ReportPayload } from "../data/reportsMock"

function formatReportDateRange(dateFromIso: string, dateToIso: string): string {
  const from = new Date(dateFromIso)
  const to = new Date(dateToIso)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return "Selected range"
  }
  const sameDay =
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate()
  const dOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
  if (sameDay) {
    return to.toLocaleDateString(undefined, { ...dOpts, weekday: "short" })
  }
  return `${from.toLocaleDateString(undefined, dOpts)} – ${to.toLocaleDateString(undefined, dOpts)}`
}

function formatDateCell(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatTimeCell(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatOutcomeLabel(raw: string): string {
  const s = String(raw || "").trim()
  if (!s) return "—"
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function buildCallCompletionReportPayload(
  data: CallCompletionLogResponse,
  opts: {
    facilityLine: string
    generatedAtLabel: string
    scopeFacilityWide: boolean
  },
): ReportPayload {
  const rangeLabel = formatReportDateRange(data.dateFrom, data.dateTo)
  const scopeLabel = opts.scopeFacilityWide ? "Facility-wide" : "Your residents"
  return {
    id: "call_log",
    title: data.title || "Call completion log",
    subtitle: `${scopeLabel} · ${rangeLabel} · Newest first`,
    facilityLine: opts.facilityLine,
    generatedAtLabel: opts.generatedAtLabel,
    tables: [
      {
        headers: ["Date", "Time", "Resident", "Outcome", "Duration"],
        rows: data.rows.map((r) => [
          formatDateCell(r.startTime),
          formatTimeCell(r.startTime),
          r.resident || "—",
          formatOutcomeLabel(r.outcome),
          r.duration || "—",
        ]),
      },
    ],
  }
}
