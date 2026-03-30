import type { ApiAlertRecord, Client, Schedule } from "../services/api/api.types"
import type { Alert, Resident } from "../types"

function schedulesList(c: Client): Schedule[] {
  const raw = c.schedules
  if (!Array.isArray(raw)) return []
  return raw.filter((s): s is Schedule => typeof s === "object" && s != null && "isActive" in s)
}

export function apiRecordId(record: { id?: string; _id?: string }): string {
  return String(record.id ?? record._id ?? "")
}

function splitName(full: string): { firstName: string; lastName: string } {
  const t = full.trim()
  if (!t) return { firstName: "—", lastName: "" }
  const parts = t.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

function clientStatus(c: Client): Resident["status"] {
  const risk = c.latestOverallRiskScore
  if (risk != null && risk >= 65) return "at_risk"
  if (c.sentimentTrendDirection === "declining" && (c.sentimentAnalyzedConversations ?? 0) > 0) {
    return "at_risk"
  }
  const active = schedulesList(c).some((s) => s.isActive)
  return active ? "active" : "inactive"
}

function clientRiskLevel(c: Client): Resident["riskLevel"] {
  const risk = c.latestOverallRiskScore
  if (risk != null) {
    if (risk >= 75) return "high"
    if (risk >= 50) return "medium"
    if (risk >= 30) return "low"
  }
  if (c.sentimentTrendDirection === "declining") return "medium"
  return "none"
}

function formatLastCall(c: Client): { date: string; time: string; status: Resident["lastCallStatus"] } {
  const iso = c.lastAnsweredCallAt || c.lastCallAttemptAt
  if (!iso) return { date: "—", time: "", status: "no_answer" }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: "—", time: "", status: "no_answer" }
  return {
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    status: c.lastAnsweredCallAt ? "completed" : "no_answer",
  }
}

function formatMoveInDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function mapEmergencyContact(c: Client): Resident["emergencyContact"] {
  const ec = c.emergencyContact
  if (!ec) return { name: "—", relationship: "—", phone: "—" }
  const has = (ec.name || "").trim() || (ec.relationship || "").trim() || (ec.phone || "").trim()
  if (!has) return { name: "—", relationship: "—", phone: "—" }
  return {
    name: (ec.name || "").trim() || "—",
    relationship: (ec.relationship || "").trim() || "—",
    phone: (ec.phone || "").trim() || "—",
  }
}

/** Map API client → facility “resident” row. */
export function mapClientToResident(c: Client): Resident {
  const { firstName, lastName } = splitName(c.preferredName || c.name)
  const last = formatLastCall(c)
  const id = apiRecordId(c)
  const room = (c.room && String(c.room).trim()) || "—"
  return {
    id,
    firstName,
    lastName,
    age: c.age ?? 0,
    room,
    status: clientStatus(c),
    consentOnFile: c.consented !== false,
    phone: c.phone || "—",
    moveInDate: formatMoveInDate(c.moveInDate ?? undefined),
    lastCallDate: last.date,
    lastCallTime: last.time,
    lastCallStatus: last.status,
    riskLevel: clientRiskLevel(c),
    riskType: c.sentimentTrendDirection === "declining" ? "sentiment" : null,
    emergencyContact: mapEmergencyContact(c),
  }
}

function importanceConfidence(importance: string): number {
  switch (importance) {
    case "urgent":
      return 95
    case "high":
      return 85
    case "medium":
      return 70
    case "low":
      return 45
    default:
      return 55
  }
}

function defaultActions(): Alert["recommendedActions"] {
  return [
    {
      action: "Review the client profile and recent conversations",
      priority: "normal",
      assignTo: "Care team",
    },
  ]
}

/** Map GET /alerts row → facility alert card (confidence / structured risk: not in API — synthesized). */
export function mapApiAlertToFacilityAlert(
  a: ApiAlertRecord,
  clientNameById: Map<string, string>,
  currentCaregiverId: string | undefined,
): Alert {
  const id = apiRecordId(a as { id?: string; _id?: string })
  const clientId = a.relatedClient ? String(a.relatedClient) : ""
  const read =
    !!currentCaregiverId &&
    (a.readBy ?? []).some((r) => String(r) === String(currentCaregiverId))

  const indicators: string[] = []
  if (a.importance === "high" || a.importance === "urgent") {
    indicators.push(`Importance: ${a.importance}`)
  }
  if (a.alertType) indicators.push(`Type: ${a.alertType}`)
  if (a.evidence?.snippet) {
    indicators.push(`Context: ${a.evidence.snippet}`)
  }
  if (typeof a.evidence?.confidence === "number") {
    indicators.push(`Detector confidence: ${Math.round(a.evidence.confidence * 100)}%`)
  }

  const fromApiActions =
    a.recommendedActions?.map((r) => ({
      action: r.labelKey.replace(/^alertActions\./, "").replace(/([A-Z])/g, " $1").trim() || r.id,
      priority: (a.importance as string) || "medium",
      assignTo: "Care team",
    })) ?? []

  return {
    id,
    residentId: clientId,
    residentName: clientId ? clientNameById.get(clientId) ?? "Client" : "—",
    type: a.alertType || "system",
    severity: a.importance || "medium",
    confidence:
      typeof a.evidence?.confidence === "number"
        ? Math.min(1, Math.max(0, a.evidence.confidence))
        : importanceConfidence(a.importance || "medium"),
    status: read ? "acknowledged" : "new",
    detectedAt: a.createdAt ?? new Date().toISOString(),
    summary: a.message,
    riskIndicators: indicators.length ? indicators : ["See alert message for details"],
    baselineComparison: { baseline: {}, current: {} },
    recommendedActions: fromApiActions.length ? fromApiActions : defaultActions(),
  }
}

export function isAlertUnreadForCaregiver(a: ApiAlertRecord, caregiverId: string | undefined): boolean {
  if (!caregiverId) return true
  return !(a.readBy ?? []).some((r) => String(r) === String(caregiverId))
}
