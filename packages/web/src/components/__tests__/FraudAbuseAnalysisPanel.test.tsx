import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FraudAbuseAnalysisPanel } from "../FraudAbuseAnalysisPanel"
import type { FraudAbuseAnalysisResult } from "../../services/api/fraudAbuseAnalysisApi"

const sampleAnalysis: FraudAbuseAnalysisResult = {
  analysisDate: "2026-06-01T12:00:00.000Z",
  conversationCount: 6,
  messageCount: 28,
  overallRiskScore: 47,
  confidence: "medium",
  financialRisk: {
    riskScore: 52,
    largeAmountMentions: 2,
    transferMethodMentions: 1,
    scamIndicatorMentions: 1,
  },
  abuseRisk: {
    riskScore: 35,
    physicalAbuseScore: 20,
    emotionalAbuseScore: 40,
    neglectScore: 15,
  },
  relationshipRisk: {
    riskScore: 41,
    newPeopleCount: 1,
    isolationCount: 2,
    suspiciousBehaviorCount: 1,
  },
  warnings: [],
  recommendations: [],
};

vi.mock("../../services/api/fraudAbuseAnalysisApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/fraudAbuseAnalysisApi")>()
  return {
    ...actual,
    useGetFraudAbuseAnalysisQuery: () => ({
      data: {
        success: true,
        data: {
          clientId: "client-1",
          conversationCount: 6,
          messageCount: 28,
          totalWords: 900,
          analysis: sampleAnalysis,
          recommendations: [],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isFetching: false,
    }),
    useTriggerFraudAbuseAnalysisMutation: () => [vi.fn(), { isLoading: false }],
  }
})

describe("FraudAbuseAnalysisPanel score display", () => {
  it("shows overall and category risk scores from analysis fixture data", () => {
    render(<FraudAbuseAnalysisPanel clientId="client-1" />)

    expect(screen.getByText("47")).toBeInTheDocument()
    expect(screen.getByText("52")).toBeInTheDocument()
    expect(screen.getByText("35")).toBeInTheDocument()
    expect(screen.getByText("41")).toBeInTheDocument()
    expect(screen.getByText(/Financial risk/i)).toBeInTheDocument()
    expect(screen.getByText(/Abuse & neglect risk/i)).toBeInTheDocument()
    expect(screen.getByText(/Relationship risk/i)).toBeInTheDocument()
  })

  it("shows sub-metrics for financial, abuse, and relationship sections", () => {
    render(<FraudAbuseAnalysisPanel clientId="client-1" />)

    expect(screen.getByText(/Physical abuse score/i).closest("div")?.textContent).toContain("20")
    expect(screen.getByText(/Emotional abuse score/i).closest("div")?.textContent).toContain("40")
    expect(screen.getByText(/Neglect score/i).closest("div")?.textContent).toContain("15")

    const financialSection = screen.getByText(/Financial risk/i).closest("div")?.parentElement
    expect(financialSection).toBeTruthy()
    expect(within(financialSection as HTMLElement).getByText(/Large amount mentions/i).closest("div")?.textContent).toContain("2")
  })
})
