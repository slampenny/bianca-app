import { formatReportDateRange } from "./callCompletionReportPayload"
import type { AlertAuditTrailResponse } from "../services/api/facilityReportsApi"
import type { ReportPayload } from "../data/reportCatalog"

function formatRaisedDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatAlertType(alertType: string): string {
  const t = String(alertType || "").trim()
  if (!t) return "—"
  if (t === "conversation" || t === "client" || t === "system") {
    return t.charAt(0).toUpperCase() + t.slice(1)
  }
  return t
}

export function buildAlertAuditReportPayload(
  data: AlertAuditTrailResponse,
  opts: { facilityLine: string; generatedAtLabel: string; scopeFacilityWide: boolean },
): ReportPayload {
  const rangeLabel = formatReportDateRange(data.dateFrom, data.dateTo)
  const scopeLabel = opts.scopeFacilityWide ? "Facility-wide" : "Your access"
  return {
    id: "alert_audit",
    title: data.title || "Alert audit trail",
    subtitle: `${scopeLabel} · ${rangeLabel} · Newest first`,
    facilityLine: opts.facilityLine,
    generatedAtLabel: opts.generatedAtLabel,
    tables: [
      {
        headers: ["Alert ID", "Type", "Resident", "Raised", "Acknowledged by"],
        rows: data.rows.map((r) => [
          r.alertId,
          formatAlertType(r.alertType),
          r.resident || "—",
          formatRaisedDate(r.createdAt),
          r.acknowledgedBy || "—",
        ]),
      },
    ],
  }
}
