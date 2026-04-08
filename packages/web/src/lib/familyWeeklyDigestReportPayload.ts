import type { ReportPayload } from "../data/reportsMock"
import type { FamilyWeeklyDigestPreviewPayload } from "../services/api/familyWeeklyDigestApi"

/**
 * Maps API preview payload to the shared report document shape (screen, print, CSV).
 */
export function familyWeeklyDigestPreviewToReportPayload(p: FamilyWeeklyDigestPreviewPayload): ReportPayload {
  const { eligibility } = p
  const narrativeExtras: string[] = []
  if (eligibility?.warnings?.length) {
    narrativeExtras.push(...eligibility.warnings)
  }
  if (!eligibility?.ok && eligibility?.reasons?.length) {
    narrativeExtras.push(...eligibility.reasons.map((r) => `Not ready to email: ${r}`))
  }

  const generatedAtLabel = new Date(p.generatedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const typicalDetail =
    p.atAGlance.typicalMinutesWhenConnected == null
      ? "—"
      : `~${p.atAGlance.typicalMinutesWhenConnected} min when connected`

  return {
    id: "family_weekly_digest",
    title: p.title,
    subtitle: `${p.subtitleParts.recipientLine} · ${p.subtitleParts.residentLine}`,
    facilityLine: p.facilityName,
    generatedAtLabel,
    narrative: [...p.narrative, ...narrativeExtras],
    tables: [
      {
        caption: `Week at a glance · ${p.atAGlance.weekRangeLabel}`,
        headers: ["Metric", "Detail"],
        rows: [
          ["Wellness calls placed", String(p.atAGlance.callsPlaced)],
          ["Times answered", String(p.atAGlance.answeredCount)],
          ["Typical conversation", typicalDetail],
        ],
      },
      {
        caption: "Calls this week (plain-language summaries)",
        headers: ["Day", "Connected", "How it went"],
        rows: p.callRows.map((r) => [
          `${r.dayLabel} ${r.dateLabel}`,
          r.connected ? "Yes" : "No",
          r.summary,
        ]),
      },
      {
        caption: "What’s not in this email",
        headers: ["Topic", "Instead"],
        rows: p.exclusions.map((e) => [e.topic, e.instead]),
      },
    ],
  }
}
