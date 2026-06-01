import type { FamilyWeeklyDigestPreviewResponse } from "../services/api/familyWeeklyDigestApi"

const LOCAL_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Default `<input type="date">` value using the browser's local calendar. */
export function localDateInputValue(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Send the picker value to the API as an org-local date reference (YYYY-MM-DD).
 * The backend resolves the facility's Monday–Sunday week from this date.
 */
export function weekReferenceFromDateInput(dateInput: string): string {
  const trimmed = dateInput.trim()
  if (LOCAL_DATE_KEY_PATTERN.test(trimmed)) {
    return trimmed
  }
  return localDateInputValue()
}

export type FamilyWeeklyDigestWeekMeta = {
  localWeekKey: string | null
  timezone: string | null
  weekRangeLabel: string | null
  legacyUtcWeek: boolean
  /** UTC instant for org-local Monday 00:00 (audit / debugging) */
  weekStart: string | null
}

export function familyWeeklyDigestWeekMeta(
  data: FamilyWeeklyDigestPreviewResponse | undefined,
): FamilyWeeklyDigestWeekMeta {
  if (!data) {
    return {
      localWeekKey: null,
      timezone: null,
      weekRangeLabel: null,
      legacyUtcWeek: false,
      weekStart: null,
    }
  }

  return {
    localWeekKey: data.localWeekKey ?? data.payload.localWeekKey ?? null,
    timezone: data.payload.timezoneAtBuild ?? data.timezoneAtBuild ?? null,
    weekRangeLabel: data.payload.atAGlance?.weekRangeLabel ?? null,
    legacyUtcWeek: data.legacyUtcWeek === true || data.payload.legacyUtcWeek === true,
    weekStart: data.weekStart ?? data.payload.weekStart ?? null,
  }
}
