import { describe, expect, it } from "vitest"
import {
  familyWeeklyDigestWeekMeta,
  localDateInputValue,
  weekReferenceFromDateInput,
} from "../familyWeeklyDigestWeek"
import type { FamilyWeeklyDigestPreviewResponse } from "../../services/api/familyWeeklyDigestApi"

function previewResponse(overrides: Partial<FamilyWeeklyDigestPreviewResponse> = {}): FamilyWeeklyDigestPreviewResponse {
  return {
    localWeekKey: "2026-03-16",
    weekStart: "2026-03-16T07:00:00.000Z",
    eligibility: { ok: true, reasons: [], warnings: [] },
    payload: {
      version: 1,
      title: "Weekly call digest for families",
      subtitleParts: { recipientLine: "For Sarah", residentLine: "Your loved one: Eleanor" },
      facilityName: "Test Org",
      generatedAt: "2026-03-25T12:00:00.000Z",
      localWeekKey: "2026-03-16",
      timezoneAtBuild: "America/Vancouver",
      weekStart: "2026-03-16T07:00:00.000Z",
      weekEnd: "2026-03-23T06:59:59.999Z",
      narrative: [],
      atAGlance: {
        weekRangeLabel: "Mar 16, 2026 – Mar 22, 2026",
        callsPlaced: 1,
        answeredCount: 1,
        typicalMinutesWhenConnected: 4,
      },
      callRows: [],
      exclusions: [],
      eligibility: { ok: true, reasons: [], warnings: [] },
    },
    ...overrides,
  }
}

describe("familyWeeklyDigestWeek", () => {
  describe("weekReferenceFromDateInput", () => {
    it("returns YYYY-MM-DD unchanged without UTC conversion", () => {
      expect(weekReferenceFromDateInput("2026-03-22")).toBe("2026-03-22")
      expect(weekReferenceFromDateInput("2026-03-22")).not.toContain("T")
      expect(weekReferenceFromDateInput("2026-03-22")).not.toContain("Z")
    })

    it("falls back to localDateInputValue for invalid input", () => {
      const fallback = weekReferenceFromDateInput("not-a-date")
      expect(fallback).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe("localDateInputValue", () => {
    it("formats using local calendar components", () => {
      const d = new Date(2026, 2, 22, 20, 0, 0)
      expect(localDateInputValue(d)).toBe("2026-03-22")
    })
  })

  describe("familyWeeklyDigestWeekMeta", () => {
    it("prefers top-level localWeekKey and payload weekRangeLabel", () => {
      const meta = familyWeeklyDigestWeekMeta(previewResponse())
      expect(meta.localWeekKey).toBe("2026-03-16")
      expect(meta.weekRangeLabel).toBe("Mar 16, 2026 – Mar 22, 2026")
      expect(meta.timezone).toBe("America/Vancouver")
      expect(meta.legacyUtcWeek).toBe(false)
    })

    it("detects legacyUtcWeek from response or payload", () => {
      expect(familyWeeklyDigestWeekMeta(previewResponse({ legacyUtcWeek: true })).legacyUtcWeek).toBe(true)
      expect(
        familyWeeklyDigestWeekMeta(
          previewResponse({ payload: { ...previewResponse().payload, legacyUtcWeek: true } }),
        ).legacyUtcWeek,
      ).toBe(true)
    })
  })
})
