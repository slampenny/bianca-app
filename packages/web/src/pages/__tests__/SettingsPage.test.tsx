import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { SettingsPage } from "../SettingsPage"
import type { Caregiver, Org } from "../../services/api/api.types"

const updateOrgFn = vi.fn()

let caregiverState: { data?: Caregiver | null; isLoading: boolean } = { data: null, isLoading: false }
let orgState: {
  data?: Org | null
  isLoading: boolean
  isError: boolean
} = { data: null, isLoading: false, isError: false }

vi.mock("../../services/api/caregiverApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/caregiverApi")>()
  return {
    ...actual,
    useGetCaregiverQuery: () => caregiverState,
    useUpdateCaregiverMutation: () => [vi.fn(), { isLoading: false }],
    useUploadAvatarMutation: () => [vi.fn(), { isLoading: false }],
  }
})

vi.mock("../../services/api/authApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/authApi")>()
  return {
    ...actual,
    useLogoutMutation: () => [vi.fn(), { isLoading: false }],
    useResendVerificationEmailMutation: () => [vi.fn(), { isLoading: false }],
  }
})

vi.mock("../../services/api/mfaApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/mfaApi")>()
  return {
    ...actual,
    useGetMFAStatusQuery: () => ({ data: { enabled: false }, isLoading: false }),
  }
})

vi.mock("../../services/api/orgApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/orgApi")>()
  return {
    ...actual,
    useGetOrgQuery: () => orgState,
    useUpdateOrgMutation: () => [updateOrgFn, { isLoading: false }],
  }
})

function defaultCaregiver(overrides: Partial<Caregiver> = {}): Caregiver {
  return {
    id: "cg1",
    name: "Admin User",
    email: "admin@test.com",
    phone: "+16045624200",
    avatar: "",
    org: "org1",
    role: "orgAdmin",
    clients: [],
    active: true,
    isEmailVerified: true,
    notificationPreferences: { dailyDigestEmail: false },
    ...overrides,
  }
}

function defaultOrg(overrides: Partial<Org> = {}): Org {
  return {
    id: "org1",
    name: "Sunrise Care",
    avatar: "",
    email: "org@test.com",
    phone: "",
    stripeCustomerId: "",
    isEmailVerified: true,
    caregivers: [],
    clients: [],
    timezone: "America/Los_Angeles",
    dailyDigestSettings: { enabled: true, sendTime: "17:30" },
    familyPortalSettings: { enabled: false, allowInviteAfterDigestVerify: true },
    ...overrides,
  }
}

function renderPage(role: Caregiver["role"] = "orgAdmin") {
  caregiverState = { data: defaultCaregiver({ role }), isLoading: false }
  orgState = {
    data: defaultOrg(),
    isLoading: false,
    isError: false,
  }

  const store = createWebTestStore({
    auth: {
      tokens: { access: { token: "t", expires: "2099" }, refresh: { token: "r", expires: "2099" } },
      authEmail: "admin@test.com",
      currentUser: defaultCaregiver({ role }),
      inviteToken: null,
      pendingOnboarding: false,
    },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe("SettingsPage family portal toggle", () => {
  beforeEach(() => {
    updateOrgFn.mockReset()
    updateOrgFn.mockReturnValue({
      unwrap: () =>
        Promise.resolve(
          defaultOrg({
            familyPortalSettings: { enabled: true, allowInviteAfterDigestVerify: true },
          }),
        ),
    })
  })

  it("shows family portal section for orgAdmin", async () => {
    renderPage("orgAdmin")
    await waitFor(() => {
      expect(screen.getByTestId("settings-org-family-portal")).toBeInTheDocument()
    })
    expect(screen.getByTestId("settings-family-portal-enabled")).not.toBeChecked()
  })

  it("does not show family portal section for staff", async () => {
    renderPage("staff")
    await waitFor(() => {
      expect(screen.getByTestId("settings-page")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("settings-org-family-portal")).not.toBeInTheDocument()
  })

  it("enables family portal when orgAdmin toggles the checkbox", async () => {
    renderPage("orgAdmin")
    await waitFor(() => {
      expect(screen.getByTestId("settings-family-portal-enabled")).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId("settings-family-portal-enabled"))

    await waitFor(() => {
      expect(updateOrgFn).toHaveBeenCalledWith({
        orgId: "org1",
        org: {
          familyPortalSettings: {
            enabled: true,
            allowInviteAfterDigestVerify: true,
          },
        },
      })
    })
    expect(screen.getByText(/Family app setting saved/i)).toBeInTheDocument()
  })
})

describe("SettingsPage org daily digest toggle", () => {
  beforeEach(() => {
    updateOrgFn.mockReset()
    updateOrgFn.mockReturnValue({
      unwrap: () =>
        Promise.resolve(
          defaultOrg({
            dailyDigestSettings: { enabled: false, sendTime: "17:30" },
          }),
        ),
    })
  })

  it("shows org daily digest section for orgAdmin", async () => {
    renderPage("orgAdmin")
    await waitFor(() => {
      expect(screen.getByTestId("settings-org-daily-digest")).toBeInTheDocument()
    })
    expect(screen.getByTestId("settings-org-daily-digest-enabled")).toBeChecked()
  })

  it("does not show org daily digest section for staff", async () => {
    renderPage("staff")
    await waitFor(() => {
      expect(screen.getByTestId("settings-page")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("settings-org-daily-digest")).not.toBeInTheDocument()
  })

  it("disables org daily digest scheduling when orgAdmin toggles the checkbox", async () => {
    renderPage("orgAdmin")
    await waitFor(() => {
      expect(screen.getByTestId("settings-org-daily-digest-enabled")).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId("settings-org-daily-digest-enabled"))

    await waitFor(() => {
      expect(updateOrgFn).toHaveBeenCalledWith({
        orgId: "org1",
        org: {
          dailyDigestSettings: {
            enabled: false,
            sendTime: "17:30",
          },
        },
      })
    })
    expect(screen.getByText(/Daily digest scheduling setting saved/i)).toBeInTheDocument()
  })
})

describe("SettingsPage daily digest history link", () => {
  it("links to digest history for staff", async () => {
    renderPage("staff")
    await waitFor(() => {
      expect(screen.getByTestId("settings-daily-digest-history-link")).toBeInTheDocument()
    })
    expect(screen.getByTestId("settings-daily-digest-history-link")).toHaveAttribute("href", "/reports/daily-digest")
    expect(screen.getByTestId("settings-daily-digest-history-link")).toHaveTextContent(/View digest history/i)
  })

  it("links to digest history for orgAdmin", async () => {
    renderPage("orgAdmin")
    await waitFor(() => {
      expect(screen.getByTestId("settings-daily-digest-history-link")).toBeInTheDocument()
    })
    expect(screen.getByTestId("settings-daily-digest-history-link")).toHaveAttribute("href", "/reports/daily-digest")
  })
})

describe("SettingsPage voice onboarding teaser", () => {
  it("shows voice onboarding section and link for orgAdmin", async () => {
    renderPage("orgAdmin")
    await waitFor(() => {
      expect(screen.getByTestId("settings-org-voice-onboarding")).toBeInTheDocument()
    })
    expect(screen.getByText(/Using built-in 5-day plan/i)).toBeInTheDocument()
    expect(screen.getByTestId("settings-voice-onboarding-link")).toHaveAttribute(
      "href",
      "/settings/voice-onboarding",
    )
  })

  it("shows custom plan status when org has customized onboarding", async () => {
    orgState = {
      data: defaultOrg({
        voiceOnboarding: {
          useDefault: false,
          days: [{ dayNumber: 1, questions: [{ id: "q1", prompt: "Hello?" }] }],
        },
      }),
      isLoading: false,
      isError: false,
    }
    const store = createWebTestStore({
      auth: {
        tokens: { access: { token: "t", expires: "2099" }, refresh: { token: "r", expires: "2099" } },
        authEmail: "admin@test.com",
        currentUser: defaultCaregiver({ role: "orgAdmin" }),
        inviteToken: null,
        pendingOnboarding: false,
      },
    })
    render(
      <Provider store={store}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </Provider>,
    )
    await waitFor(() => {
      expect(screen.getByText(/Custom plan/i)).toBeInTheDocument()
    })
  })

  it("does not show voice onboarding section for staff", async () => {
    renderPage("staff")
    await waitFor(() => {
      expect(screen.getByTestId("settings-page")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("settings-org-voice-onboarding")).not.toBeInTheDocument()
  })
})
