import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { DashboardPage } from "../DashboardPage"

vi.mock("../../services/api/clientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/clientApi")>()
  return {
    ...actual,
    useGetAllClientsQuery: () => ({
      data: { results: [], totalResults: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useGetClientsOnboardingRollupsQuery: () => ({
      data: { rollups: {} },
      isLoading: false,
      isError: false,
    }),
  }
})

vi.mock("../../services/api/activityApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/activityApi")>()
  return {
    ...actual,
    useGetRecentActivityQuery: () => ({ data: { results: [] }, isLoading: false, isError: false }),
    useGetCallsByHourTodayQuery: () => ({ data: { buckets: [], dateLabel: "Jun 1", timezone: "UTC" }, isLoading: false, isError: false }),
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

function renderDashboard() {
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
  })

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe("DashboardPage empty org", () => {
  it("shows honest empty state when there are zero residents", () => {
    renderDashboard()
    expect(screen.getByTestId("dashboard-empty-org")).toBeInTheDocument()
    expect(screen.getByText(/No residents yet/i)).toBeInTheDocument()
  })
})

describe("DashboardPage healthy subtitle", () => {
  it("does not show fabricated check-in timestamps", () => {
    renderDashboard()
    expect(screen.queryByText(/2 minutes ago/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/last check/i)).not.toBeInTheDocument()
  })
})
