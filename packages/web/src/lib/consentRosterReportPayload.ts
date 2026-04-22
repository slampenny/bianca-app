import type { ReportPayload } from "../data/reportsMock"
import type { Client, Schedule } from "../services/api/api.types"
import { clientDisplayName } from "./clientDisplayName"

function schedulesList(c: Client): Schedule[] {
  const raw = c.schedules
  if (!Array.isArray(raw)) return []
  return raw.filter((s): s is Schedule => typeof s === "object" && s != null && "isActive" in s)
}

function formatScheduleSummary(c: Client): string {
  const active = schedulesList(c).filter((s) => s.isActive)
  if (active.length === 0) return "—"
  return active
    .map((s) => `${s.frequency.charAt(0).toUpperCase() + s.frequency.slice(1)} ${s.time}`)
    .join("; ")
}

function formatLastSuccessfulCall(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const today = new Date()
  const sameDay =
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  if (sameDay) return "Today"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function consentLabel(c: Client): string {
  if (c.consented === true) return "On file"
  if (c.consented === false) return "Not on file"
  return "Pending"
}

/** Live consent + schedule summary from GET /clients (same roster as Residents). */
export function buildConsentRosterReportPayload(
  clients: Client[],
  opts: { facilityLine: string; generatedAtLabel: string },
): ReportPayload {
  const rows = [...clients]
    .map((c) => {
      const room = (c.room && String(c.room).trim()) || "—"
      return [
        clientDisplayName(c),
        room,
        consentLabel(c),
        formatScheduleSummary(c),
        formatLastSuccessfulCall(c.lastAnsweredCallAt ?? undefined),
      ]
    })
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))

  return {
    id: "consent_roster",
    title: "Consent & program roster",
    subtitle: `All residents (${clients.length})`,
    facilityLine: opts.facilityLine,
    generatedAtLabel: opts.generatedAtLabel,
    narrative: [
      "Consent status comes from each client record (whether they have completed the consent flow).",
      "Schedule shows active Bianca call schedules; last successful call uses the most recent answered call timestamp.",
    ],
    tables: [
      {
        caption: "Roster · consent and schedules",
        headers: ["Resident", "Room", "Consent", "Schedule", "Last successful call"],
        rows,
      },
    ],
  }
}
