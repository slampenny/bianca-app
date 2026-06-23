import { describe, expect, it } from "vitest"
import {
  formatMetricPercent,
  formatRiskScore,
  getHealthLevel,
  getRiskLevel,
  invertRiskScore,
} from "../analysisScoreDisplay"

describe("analysisScoreDisplay", () => {
  describe("invertRiskScore", () => {
    it("inverts psychiatric overall risk for mental health headline", () => {
      expect(invertRiskScore(38)).toBe(62)
      expect(invertRiskScore(0)).toBe(100)
      expect(invertRiskScore(100)).toBe(0)
    })

    it("returns undefined for missing values", () => {
      expect(invertRiskScore(undefined)).toBeUndefined()
    })
  })

  describe("getHealthLevel", () => {
    it("maps inverted wellness scores to levels", () => {
      expect(getHealthLevel(75)).toBe("good")
      expect(getHealthLevel(55)).toBe("fair")
      expect(getHealthLevel(25)).toBe("poor")
    })
  })

  describe("getRiskLevel", () => {
    it("maps raw fraud/abuse and psychiatric sub-scores to risk bands", () => {
      expect(getRiskLevel(72)).toBe("critical")
      expect(getRiskLevel(55)).toBe("high")
      expect(getRiskLevel(35)).toBe("medium")
      expect(getRiskLevel(10)).toBe("low")
    })
  })

  describe("formatRiskScore / formatMetricPercent", () => {
    it("formats overall fraud risk as a rounded integer", () => {
      expect(formatRiskScore(47.6)).toBe("48")
      expect(formatRiskScore(undefined)).toBe("—")
    })

    it("formats depression and anxiety sub-metrics as percentages", () => {
      expect(formatMetricPercent(42.3)).toBe("42%")
      expect(formatMetricPercent(undefined)).toBe("0%")
    })
  })
})
