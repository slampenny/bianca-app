import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MedicalAnalysisReportPanel } from "../../components/MedicalAnalysisReportPanel"
import type { MedicalAnalysisResult } from "../../services/api/medicalAnalysisApi"

function sampleMedicalResult(overrides: Partial<MedicalAnalysisResult> = {}): MedicalAnalysisResult {
  return {
    analysisDate: "2026-06-01T12:00:00.000Z",
    conversationCount: 8,
    messageCount: 40,
    totalWords: 1200,
    confidence: "high",
    psychiatricMetrics: {
      depressionScore: 42,
      anxietyScore: 55,
      overallRiskScore: 38,
      crisisIndicators: { hasCrisisIndicators: false },
      emotionalTone: { dominantTone: "negative", negativeRatio: 0.72 },
      protectiveFactors: 3,
    },
    cognitiveMetrics: { riskScore: 25 },
    vocabularyMetrics: { complexityScore: 68 },
    ...overrides,
  }
}

describe("MedicalAnalysisReportPanel score display", () => {
  it("shows inverted mental health headline and raw depression/anxiety percentages", () => {
    render(
      <MedicalAnalysisReportPanel
        summary={undefined}
        latestResult={sampleMedicalResult()}
        isLoading={false}
        isError={false}
      />,
    )

    // overallRiskScore 38 → inverted 62% headline in psychiatric section
    expect(screen.getByText("62")).toBeInTheDocument()
    expect(screen.getByText("42%")).toBeInTheDocument()
    expect(screen.getByText("55%")).toBeInTheDocument()
    expect(screen.getByText(/Depression score/i)).toBeInTheDocument()
    expect(screen.getByText(/Anxiety score/i)).toBeInTheDocument()
  })

  it("shows emotional tone and protective factors when expanded metrics are present", () => {
    render(
      <MedicalAnalysisReportPanel
        summary={undefined}
        latestResult={sampleMedicalResult()}
        isLoading={false}
        isError={false}
      />,
    )

    expect(screen.getByText("negative")).toBeInTheDocument()
    expect(screen.getByText("72.0%")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })
})
