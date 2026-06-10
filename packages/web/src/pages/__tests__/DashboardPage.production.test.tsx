import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { DashboardPage } from "../DashboardPage"
import * as clientApi from "../../services/api/clientApi"

vi.mock("../../services/api/clientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/clientApi")>()
  return {
    ...actual,
    useGetAllClientsQuery: vi.fn(() => ({
      data: { results: [], totalResults: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })),
    useGetClientsOnboardingRollupsQuery: vi.fn(() => ({
      data: { rollups: {} },
      isLoading: false,
      isError: false,
    })),
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

describe("DashboardPage voice onboarding card", () => {
  const mockedRollups = vi.mocked(clientApi.useGetClientsOnboardingRollupsQuery)
  const mockedClients = vi.mocked(clientApi.useGetAllClientsQuery)

  beforeEach(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver

    mockedClients.mockReturnValue({
      data: { results: [{ id: "c1", name: "Ada", email: "a@test.com", phone: "1", org: "org1", caregivers: [], schedules: [] }], totalResults: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof clientApi.useGetAllClientsQuery>)
    mockedRollups.mockReturnValue({
      data: { rollups: {} },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof clientApi.useGetClientsOnboardingRollupsQuery>)
  })

  it("hides the card when all residents completed onboarding", () => {
    mockedRollups.mockReturnValue({
      data: {
        rollups: {
          c1: {
            totalDays: 4,
            enabled: true,
            sessionsCompletedCount: 4,
            journeyComplete: true,
            currentDay: null,
            hasAnyOnboardingActivity: true,
            flags: {},
            questionCount: 0,
          },
          c2: {
            totalDays: 4,
            enabled: true,
            sessionsCompletedCount: 4,
            journeyComplete: true,
            currentDay: null,
            hasAnyOnboardingActivity: true,
            flags: {},
            questionCount: 0,
          },
        },
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof clientApi.useGetClientsOnboardingRollupsQuery>)

    renderDashboard()
    expect(screen.queryByTestId("dashboard-onboarding-card")).not.toBeInTheDocument()
  })

  it("shows the card when residents have not started onboarding", () => {
    mockedRollups.mockReturnValue({
      data: {
        rollups: {
          c1: {
            totalDays: 4,
            enabled: true,
            sessionsCompletedCount: 0,
            journeyComplete: false,
            currentDay: 1,
            hasAnyOnboardingActivity: false,
            flags: {},
            questionCount: 0,
          },
        },
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof clientApi.useGetClientsOnboardingRollupsQuery>)

    renderDashboard()
    expect(screen.getByTestId("dashboard-onboarding-card")).toBeInTheDocument()
  })

  it("hides the card when voice onboarding is disabled for the org", () => {
    mockedRollups.mockReturnValue({
      data: {
        rollups: {
          c1: {
            totalDays: 0,
            enabled: false,
            sessionsCompletedCount: 0,
            journeyComplete: true,
            currentDay: null,
            hasAnyOnboardingActivity: false,
            flags: {},
            questionCount: 0,
          },
        },
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof clientApi.useGetClientsOnboardingRollupsQuery>)

    renderDashboard()
    expect(screen.queryByTestId("dashboard-onboarding-card")).not.toBeInTheDocument()
  })
})
