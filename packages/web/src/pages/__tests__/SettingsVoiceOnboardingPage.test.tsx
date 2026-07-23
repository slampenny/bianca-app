import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { SettingsVoiceOnboardingPage } from "../SettingsVoiceOnboardingPage"
import type { Caregiver, Org, VoiceOnboardingPlan } from "../../services/api/api.types"

const updateOrgFn = vi.fn()

let orgState: { data?: Org | null; isLoading: boolean } = { data: null, isLoading: false }
let defaultPlanState: { data?: { plan: VoiceOnboardingPlan } | null; isLoading: boolean } = {
  data: null,
  isLoading: false,
}

vi.mock("../../services/api/orgApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/orgApi")>()
  return {
    ...actual,
    useGetOrgQuery: () => orgState,
    useGetDefaultVoiceOnboardingPlanQuery: () => defaultPlanState,
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
    voiceOnboarding: { useDefault: true, days: [] },
    ...overrides,
  }
}

const samplePlan: VoiceOnboardingPlan = {
  useDefault: true,
  totalDays: 2,
  days: [
    {
      dayNumber: 0,
      theme: "Welcome",
      opening: "Hi there",
      questions: [{ id: "day0_q1", prompt: "How are you settling in?", compressionPriority: true }],
    },
    {
      dayNumber: 1,
      theme: "Routine",
      opening: "Good morning",
      questions: [{ id: "day1_q1", prompt: "What does morning look like?", compressionPriority: false }],
    },
  ],
}

function renderPage(role: Caregiver["role"] = "orgAdmin") {
  orgState = { data: defaultOrg(), isLoading: false }
  defaultPlanState = { data: { plan: samplePlan }, isLoading: false }

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
        <SettingsVoiceOnboardingPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe("SettingsVoiceOnboardingPage", () => {
  beforeEach(() => {
    updateOrgFn.mockReset()
  })

  it("shows customize CTA for default plan", async () => {
    renderPage("orgAdmin")
    await waitFor(() => {
      expect(screen.getByTestId("voice-onboarding-customize")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("voice-onboarding-save")).not.toBeInTheDocument()
  })

  it("rejects privacy-violating text with actionable API message", async () => {
    updateOrgFn.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message:
              'Voice onboarding text conflicts with privacy rules (day 0 opening: "tell your family")',
          },
        }),
    })

    renderPage("orgAdmin")
    await userEvent.click(await screen.findByTestId("voice-onboarding-customize"))
    const opening = await screen.findByTestId("voice-onboarding-opening-0")
    await userEvent.clear(opening)
    await userEvent.type(opening, "we'll tell your family about this")
    await userEvent.click(screen.getByTestId("voice-onboarding-save"))

    await waitFor(() => {
      expect(screen.getByTestId("voice-onboarding-save-error")).toHaveTextContent(/tell your family/i)
    })
    expect(screen.queryByTestId("voice-onboarding-save-success")).not.toBeInTheDocument()
  })

  it("saves a clean custom plan for orgAdmin", async () => {
    updateOrgFn.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          ...defaultOrg({
            voiceOnboarding: {
              useDefault: false,
              days: samplePlan.days,
            },
          }),
        }),
    })

    renderPage("orgAdmin")
    await userEvent.click(await screen.findByTestId("voice-onboarding-customize"))
    await userEvent.click(await screen.findByTestId("voice-onboarding-save"))

    await waitFor(() => {
      expect(updateOrgFn).toHaveBeenCalled()
    })
    const arg = updateOrgFn.mock.calls[0][0]
    expect(arg.orgId).toBe("org1")
    expect(arg.org.voiceOnboarding.useDefault).toBe(false)
    expect(arg.org.voiceOnboarding.days[0].questions[0].id).toBe("day0_q1")
    expect(await screen.findByTestId("voice-onboarding-save-success")).toBeInTheDocument()
  })

  it("shows privacy warnings when superAdmin save succeeds with warnings", async () => {
    updateOrgFn.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          ...defaultOrg({
            voiceOnboarding: {
              useDefault: false,
              days: samplePlan.days,
            },
          }),
          voiceOnboardingPrivacyWarnings: [{ path: "day 0 opening", phrase: "tell your family" }],
        }),
    })

    renderPage("superAdmin")
    await userEvent.click(await screen.findByTestId("voice-onboarding-customize"))
    await userEvent.click(await screen.findByTestId("voice-onboarding-save"))

    expect(await screen.findByTestId("voice-onboarding-privacy-warnings")).toHaveTextContent(/tell your family/i)
    expect(screen.getByTestId("voice-onboarding-save-success")).toBeInTheDocument()
  })
})
