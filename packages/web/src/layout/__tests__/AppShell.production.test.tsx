import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { AppShell } from "../AppShell"

vi.mock("../../lib/devDemo", () => ({
  isDevDemoEnabled: () => false,
}))

vi.mock("../../services/api/alertApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/alertApi")>()
  return {
    ...actual,
    useGetAllAlertsQuery: () => ({ data: [] }),
  }
})

vi.mock("../../services/api/activityApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/activityApi")>()
  return {
    ...actual,
    useGetRecentActivityQuery: () => ({ data: { results: [] }, isLoading: false }),
  }
})

vi.mock("../../services/api/caregiverApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/caregiverApi")>()
  return {
    ...actual,
    useGetCaregiverQuery: () => ({ data: undefined }),
  }
})

vi.mock("../../realtime/RealtimeSocketBridge", () => ({
  RealtimeSocketBridge: () => null,
}))

function renderShell() {
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
        role: "staff",
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
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe("AppShell production mode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not render the simulate alert control", () => {
    renderShell()
    expect(screen.queryByTestId("simulate-alert-btn")).not.toBeInTheDocument()
  })

  it("does not render demo toast UI", () => {
    renderShell()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("shows honest empty last-activity text when API returns no events", () => {
    renderShell()
    expect(screen.getByText(/Last activity:/i)).toBeInTheDocument()
    expect(screen.getByText(/No recent activity/i)).toBeInTheDocument()
  })
})
