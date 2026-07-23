import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { DailyDigestPage } from "../DailyDigestPage"
import type { CaregiverDailyDigest } from "../../services/api/dailyDigestApi"
import type { Caregiver, Org } from "../../services/api/api.types"

const listRefetch = vi.fn()
let listState: {
  data?: { results: CaregiverDailyDigest[] }
  isLoading: boolean
  isError: boolean
} = { data: { results: [] }, isLoading: false, isError: false }

let caregiverState: { data?: Caregiver | null } = { data: null }
let orgState: {
  data?: Org | null
  isLoading: boolean
  isError: boolean
} = { data: null, isLoading: false, isError: false }

vi.mock("../../services/api/dailyDigestApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/dailyDigestApi")>()
  return {
    ...actual,
    useListCaregiverDailyDigestsQuery: () => ({
      ...listState,
      refetch: listRefetch,
    }),
    useGenerateCaregiverDailyDigestMutation: () => [vi.fn(), { isLoading: false, error: undefined }],
    useSendCaregiverDailyDigestMutation: () => [vi.fn(), { isLoading: false, error: undefined }],
  }
})

vi.mock("../../services/api/caregiverApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/caregiverApi")>()
  return {
    ...actual,
    useGetCaregiverQuery: () => caregiverState,
  }
})

vi.mock("../../services/api/orgApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/orgApi")>()
  return {
    ...actual,
    useGetOrgQuery: () => orgState,
  }
})

function baseDigest(overrides: Partial<CaregiverDailyDigest> = {}): CaregiverDailyDigest {
  return {
    id: "digest-1",
    org: "org1",
    caregiver: "cg1",
    digestDate: "2026-06-01T07:00:00.000Z",
    localDateKey: "2026-06-01",
    timezoneAtBuild: "America/Los_Angeles",
    locale: "en",
    status: "draft",
    version: 1,
    payload: {
      version: 1,
      title: "Daily wellness digest",
      subtitle: "Sunrise Care",
      dateLabel: "Sunday, June 1, 2026",
      digestDayStartIso: "2026-06-01T07:00:00.000Z",
      localDateKey: "2026-06-01",
      timezone: "America/Los_Angeles",
      labels: {
        conversationSummary: "Summary",
        sentiment: "Mood",
        callsToday: "Calls",
        noActivity: "No calls today",
        emailScreenHint: "Email hint from payload",
      },
      entries: [
        {
          clientId: "c1",
          clientName: "Jane Doe",
          clientPreferredLanguage: "en",
          caregiverPreferredLanguage: "en",
          languageMismatch: false,
          languageMismatchExplanation: null,
          conversationSummaryShort: "Checked in well.",
          sentiment: { overallSentiment: "positive" },
          callsPlaced: 1,
          answeredCalls: 1,
          lastCallAt: "2026-06-01T15:30:00.000Z",
        },
      ],
      generatedAt: "2026-06-01T16:00:00.000Z",
    },
    ...overrides,
  }
}

function defaultCaregiver(overrides: Partial<Caregiver> = {}): Caregiver {
  return {
    id: "cg1",
    name: "Test User",
    email: "u@test.com",
    phone: "",
    avatar: "",
    org: "org1",
    role: "staff",
    clients: [],
    active: true,
    isEmailVerified: true,
    notificationPreferences: { dailyDigestEmail: true },
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
    ...overrides,
  }
}

function renderPage(role: Caregiver["role"] = "staff") {
  const store = createWebTestStore({
    auth: {
      tokens: { access: { token: "t", expires: "2099" }, refresh: { token: "r", expires: "2099" } },
      authEmail: "u@test.com",
      currentUser: defaultCaregiver({ role }),
      inviteToken: null,
      pendingOnboarding: false,
    },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <DailyDigestPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe("DailyDigestPage", () => {
  beforeEach(() => {
    listRefetch.mockClear()
    listState = { data: { results: [] }, isLoading: false, isError: false }
    caregiverState = { data: defaultCaregiver() }
    orgState = { data: null, isLoading: false, isError: false }
  })

  it("shows list fetch error with retry", async () => {
    listState = { isLoading: false, isError: true }
    renderPage()
    expect(screen.getByTestId("daily-digest-list-error")).toBeInTheDocument()
    expect(screen.getByText(/Could not load saved digests/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Retry/i }))
    expect(listRefetch).toHaveBeenCalledTimes(1)
  })

  it("shows empty state when no saved digests", () => {
    renderPage()
    expect(screen.getByTestId("daily-digest-no-saved")).toHaveTextContent(/No saved digests yet/i)
  })

  it("shows scheduled vs manual email copy", () => {
    renderPage()
    expect(screen.getByTestId("daily-digest-scheduled-email-hint")).toHaveTextContent(/Automated daily digest emails/i)
    expect(screen.getByTestId("daily-digest-automation-indicator")).toHaveTextContent(/Automated digests:/i)
    expect(screen.queryByTestId("daily-digest-automation-status")).not.toBeInTheDocument()
  })

  it("shows Ready one-line indicator when all automation checks pass for org admin", () => {
    caregiverState = { data: defaultCaregiver({ role: "orgAdmin", notificationPreferences: { dailyDigestEmail: true } }) }
    orgState = { data: defaultOrg(), isLoading: false, isError: false }
    renderPage("orgAdmin")
    expect(screen.getByTestId("daily-digest-automation-indicator")).toHaveTextContent(/Automated digests: Ready/i)
    expect(screen.queryByTestId("daily-digest-automation-ready-badge")).not.toBeInTheDocument()
  })

  it("shows Not ready indicator with Settings link when email is unverified", () => {
    caregiverState = { data: defaultCaregiver({ isEmailVerified: false }) }
    renderPage()
    expect(screen.getByTestId("daily-digest-automation-indicator")).toHaveTextContent(/Not ready/i)
    expect(screen.getByTestId("daily-digest-automation-indicator-settings-link")).toHaveAttribute("href", "/settings")
  })

  it("shows Not ready indicator when daily digest preference is off", () => {
    caregiverState = { data: defaultCaregiver({ notificationPreferences: { dailyDigestEmail: false } }) }
    renderPage()
    expect(screen.getByTestId("daily-digest-automation-indicator")).toHaveTextContent(/Not ready/i)
    expect(screen.getByTestId("daily-digest-automation-indicator-settings-link")).toBeInTheDocument()
  })

  it("shows Not ready when org scheduling is disabled for org admin", () => {
    caregiverState = { data: defaultCaregiver({ role: "orgAdmin" }) }
    orgState = {
      data: defaultOrg({ dailyDigestSettings: { enabled: false, sendTime: "18:00" } }),
      isLoading: false,
      isError: false,
    }
    renderPage("orgAdmin")
    expect(screen.getByTestId("daily-digest-automation-indicator")).toHaveTextContent(/Not ready/i)
  })

  it("shows Not ready for staff when org scheduling is unavailable", () => {
    renderPage("staff")
    expect(screen.getByTestId("daily-digest-automation-indicator")).toHaveTextContent(/Not ready/i)
  })

  it("shows redacted banner and hides table for redacted digest", async () => {
    const redacted = baseDigest({
      phiRedactedAt: "2026-06-02T00:00:00.000Z",
      payload: {
        ...baseDigest().payload,
        title: "[Redacted]",
        subtitle: "[Redacted]",
        phiRedacted: true,
        entries: [],
        labels: {
          conversationSummary: "",
          sentiment: "",
          callsToday: "",
          noActivity: "",
          emailScreenHint: "",
        },
      },
    })
    listState = { data: { results: [redacted] }, isLoading: false, isError: false }
    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /2026-06-01 v1 · draft/i }))
    expect(screen.getByTestId("daily-digest-phi-redacted-banner")).toHaveTextContent(/redacted for privacy/i)
    expect(screen.queryByTestId("daily-digest-table")).not.toBeInTheDocument()
    expect(screen.queryByText("[Redacted]")).not.toBeInTheDocument()
    expect(screen.getByTestId("daily-digest-day-meta")).toHaveTextContent(/Local day: 2026-06-01/)
    expect(screen.getByTestId("daily-digest-day-meta")).toHaveTextContent(/Timezone: America\/Los_Angeles/)
  })

  it("shows sent immutable banner and note for emailed digest", async () => {
    const sent = baseDigest({ status: "sent", sentAt: "2026-06-01T18:00:00.000Z" })
    listState = { data: { results: [sent] }, isLoading: false, isError: false }
    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /June 1, 2026/i }))
    expect(screen.getByTestId("daily-digest-sent-immutable-banner")).toHaveTextContent(/Sent digest/i)
    expect(screen.getByTestId("daily-digest-sent-immutable-note")).toHaveTextContent(/preserved as sent/i)
    expect(screen.queryByTestId("daily-digest-email-button")).not.toBeInTheDocument()
  })

  it("shows manual email hint on draft digest", async () => {
    const draft = baseDigest()
    listState = { data: { results: [draft] }, isLoading: false, isError: false }
    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /June 1, 2026/i }))
    expect(screen.getByTestId("daily-digest-email-button")).toBeInTheDocument()
    expect(screen.getByTestId("daily-digest-manual-email-hint")).toHaveTextContent(/Manual email sends this draft now/i)
  })

  it("shows empty roster when digest has no entries", async () => {
    const empty = baseDigest({
      payload: { ...baseDigest().payload, entries: [] },
    })
    listState = { data: { results: [empty] }, isLoading: false, isError: false }
    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /June 1, 2026/i }))
    expect(screen.getByTestId("daily-digest-empty-roster")).toHaveTextContent(/No assigned residents/i)
  })

  it("shows no-calls empty state when residents have zero calls", async () => {
    const noCalls = baseDigest({
      payload: {
        ...baseDigest().payload,
        entries: [
          {
            clientId: "c1",
            clientName: "Jane Doe",
            clientPreferredLanguage: "en",
            caregiverPreferredLanguage: "en",
            languageMismatch: false,
            languageMismatchExplanation: null,
            conversationSummaryShort: null,
            sentiment: null,
            callsPlaced: 0,
            answeredCalls: 0,
            lastCallAt: null,
          },
        ],
      },
    })
    listState = { data: { results: [noCalls] }, isLoading: false, isError: false }
    renderPage()
    await userEvent.click(screen.getByRole("button", { name: /June 1, 2026/i }))
    expect(screen.getByTestId("daily-digest-empty-no-calls")).toHaveTextContent(/No wellness check-in calls/i)
    expect(screen.getByTestId("daily-digest-table")).toBeInTheDocument()
  })
})
