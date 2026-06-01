import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { ReportsPage } from "../ReportsPage"

vi.mock("../../lib/devDemo", () => ({
  isDevDemoEnabled: () => false,
}))

const liveClient = {
  id: "client-live-1",
  name: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  preferredName: null,
  room: "101A",
  lastAnsweredCallAt: "2026-06-01T10:00:00.000Z",
  sentimentTrendDirection: "stable" as const,
  sentimentAnalyzedConversations: 2,
  latestOverallRiskScore: 20,
}

vi.mock("../../services/api/facilityReportsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/facilityReportsApi")>()
  return {
    ...actual,
    useGetReportsSummaryQuery: () => ({
      data: {
        generatedThisMonth: 3,
        scheduledDeliveries: 1,
        residentsWithOpenFollowUps: 0,
        lastFacilityReportLabel: "Jun 1",
        complianceScoreLabel: "Strong",
        weeklyReportRuns: [],
        reportType: "summary",
        generatedAt: "2026-06-01T00:00:00.000Z",
        orgId: "org1",
        lastFacilityReportAt: null,
      },
      isLoading: false,
    }),
  }
})

vi.mock("../../services/api/activityApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/activityApi")>()
  return {
    ...actual,
    useGetRecentActivityQuery: () => ({ data: { results: [] } }),
  }
})

vi.mock("../../services/api/clientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/clientApi")>()
  return {
    ...actual,
    useGetAllClientsQuery: () => ({
      data: { results: [liveClient], totalResults: 1 },
      isLoading: false,
      isError: false,
    }),
  }
})

vi.mock("../../services/api/alertApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/alertApi")>()
  return {
    ...actual,
    useGetAllAlertsQuery: () => ({ data: [] }),
    liveAlertsQueryOptions: {},
  }
})

vi.mock("../../services/api/sentimentApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/sentimentApi")>()
  return {
    ...actual,
    useGetSentimentSummaryQuery: () => ({
      data: {
        totalConversations: 1,
        analyzedConversations: 1,
        averageSentiment: 0.5,
        sentimentDistribution: {},
        trendDirection: "stable",
        confidence: 0.8,
        keyInsights: ["Engaged during last check-in"],
        recentTrend: [],
      },
      isLoading: false,
    }),
  }
})

function renderReports() {
  const store = createWebTestStore({
    auth: {
      tokens: { access: { token: "t", expires: "2099" }, refresh: { token: "r", expires: "2099" } },
      authEmail: "u@test.com",
      currentUser: {
        id: "cg1",
        name: "Test User",
        email: "u@test.com",
        phone: "",
        avatar: "",
        org: "org1",
        role: "orgAdmin",
        clients: [],
      },
      inviteToken: null,
      pendingOnboarding: false,
    },
    org: {
      name: "Test Facility",
      avatar: "",
      email: "",
      phone: "",
      stripeCustomerId: "",
      isEmailVerified: true,
      caregivers: [],
      clients: [],
    },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe("ReportsPage production mode", () => {
  it("shows the per-resident tab with live client names", async () => {
    const user = userEvent.setup()
    renderReports()
    await user.click(screen.getByRole("tab", { name: /Per resident/i }))
    expect(screen.getByTestId("reports-resident-tab-live")).toBeInTheDocument()
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
  })

  it("does not render mock resident names", async () => {
    const user = userEvent.setup()
    renderReports()
    await user.click(screen.getByRole("tab", { name: /Per resident/i }))
    expect(screen.queryByText("Eleanor Briggs")).not.toBeInTheDocument()
    expect(screen.queryByText("Margaret Thompson")).not.toBeInTheDocument()
    expect(screen.queryByText("Margaret Liu")).not.toBeInTheDocument()
  })

  it("enables live CSV export when summary and clients are loaded", () => {
    renderReports()
    const btn = screen.getByTestId("reports-live-csv-export")
    expect(btn).toBeEnabled()
    expect(screen.queryByTestId("reports-facility-csv-mock-banner")).not.toBeInTheDocument()
  })
})
