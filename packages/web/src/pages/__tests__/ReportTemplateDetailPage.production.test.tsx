import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { ReportTemplateDetailPage } from "../ReportTemplateDetailPage"

vi.mock("../../lib/devDemo", () => ({
  isDevDemoEnabled: () => false,
}))

vi.mock("../../services/api/clientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/clientApi")>()
  return {
    ...actual,
    useGetAllClientsQuery: () => ({
      data: { results: [{ id: "c1", name: "Live Client", firstName: "Live", lastName: "Client" }], totalResults: 1 },
      isLoading: false,
      isError: false,
    }),
  }
})

vi.mock("../../services/api/caregiverApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/caregiverApi")>()
  return {
    ...actual,
    useGetCaregiverQuery: () => ({ data: undefined }),
  }
})

vi.mock("../../services/api/facilityReportsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/facilityReportsApi")>()
  return {
    ...actual,
    useGetCallCompletionLogQuery: () => ({ data: null, isLoading: false, isFetching: false, isError: false }),
    useGetAlertAuditTrailQuery: () => ({ data: null, isLoading: false, isFetching: false, isError: false }),
  }
})

vi.mock("../../services/api/sentimentApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/sentimentApi")>()
  return {
    ...actual,
    useGetSentimentTrendQuery: () => ({ data: { dataPoints: [] }, isLoading: false, isError: false }),
  }
})

function renderReport(templateId: string) {
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
      <MemoryRouter initialEntries={[`/reports/${templateId}`]}>
        <Routes>
          <Route path="/reports/:templateId" element={<ReportTemplateDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe("ReportTemplateDetailPage production mode", () => {
  it("renders live risk sentiment report without mock resident names", () => {
    renderReport("risk_sentiment")
    expect(screen.getByTestId("risk-sentiment-live-report")).toBeInTheDocument()
    expect(screen.queryByText("Eleanor Briggs")).not.toBeInTheDocument()
    expect(screen.queryByText("Margaret Thompson")).not.toBeInTheDocument()
    expect(screen.queryByTestId("report-detail-sample-banner")).not.toBeInTheDocument()
  })
})
