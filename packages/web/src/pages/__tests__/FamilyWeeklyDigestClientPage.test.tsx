import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { FamilyWeeklyDigestClientPage } from "../FamilyWeeklyDigestClientPage"
import type {
  FamilyWeeklyDigest,
  FamilyWeeklyDigestPreviewResponse,
} from "../../services/api/familyWeeklyDigestApi"

const previewFn = vi.fn()
const createFn = vi.fn()
const sendFn = vi.fn()
const listRefetchFn = vi.fn()
const previewResetFn = vi.fn()

let previewState: {
  data?: FamilyWeeklyDigestPreviewResponse
  isLoading: boolean
  isError: boolean
} = { isLoading: false, isError: false }

let listState: {
  data?: { results: FamilyWeeklyDigest[] }
  isError: boolean
} = { isError: false, data: { results: [] } }

vi.mock("../../lib/devDemo", () => ({
  isDevDemoEnabled: () => false,
}))

vi.mock("../../services/api/familyWeeklyDigestApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/familyWeeklyDigestApi")>()
  return {
    ...actual,
    usePreviewFamilyWeeklyDigestMutation: () => [previewFn, { ...previewState, reset: previewResetFn }],
    useListFamilyWeeklyDigestsQuery: () => ({
      ...listState,
      refetch: listRefetchFn,
    }),
    useCreateFamilyWeeklyDigestMutation: () => [createFn, { isLoading: false }],
    useSendFamilyWeeklyDigestMutation: () => [sendFn, { isLoading: false }],
    useGetFamilyWeeklyDigestQuery: () => ({ data: undefined, isLoading: false }),
  }
})

function eligiblePayload(): FamilyWeeklyDigestPreviewResponse["payload"] {
  return {
    version: 1,
    title: "Weekly call digest for families",
    subtitleParts: { recipientLine: "For Sarah", residentLine: "Your loved one: Eleanor" },
    facilityName: "Test Org",
    generatedAt: "2026-03-25T12:00:00.000Z",
    localWeekKey: "2026-03-16",
    timezoneAtBuild: "America/Vancouver",
    weekStart: "2026-03-16T07:00:00.000Z",
    weekEnd: "2026-03-23T06:59:59.999Z",
    narrative: ["This digest describes wellness check-in calls only — not clinical care."],
    atAGlance: {
      weekRangeLabel: "Mar 16, 2026 – Mar 22, 2026",
      callsPlaced: 1,
      answeredCount: 1,
      typicalMinutesWhenConnected: 4,
    },
    callRows: [
      {
        dayLabel: "Sun",
        dateLabel: "Mar 22",
        connected: true,
        summary: "Sunday evening check-in.",
      },
    ],
    exclusions: [{ topic: "Diagnoses", instead: "Call the care team." }],
    eligibility: { ok: true, reasons: [], warnings: [] },
  }
}

function previewResponse(overrides: Partial<FamilyWeeklyDigestPreviewResponse> = {}): FamilyWeeklyDigestPreviewResponse {
  const payload = overrides.payload ?? eligiblePayload()
  return {
    localWeekKey: "2026-03-16",
    weekStart: "2026-03-16T07:00:00.000Z",
    eligibility: payload.eligibility,
    payload,
    ...overrides,
  }
}

function draftDigest(overrides: Partial<FamilyWeeklyDigest> = {}): FamilyWeeklyDigest {
  return {
    id: "digest-1",
    client: "client-1",
    org: "org-1",
    weekStart: "2026-03-16T07:00:00.000Z",
    weekEnd: "2026-03-23T06:59:59.999Z",
    localWeekKey: "2026-03-16",
    status: "draft",
    recipient: { name: "Sarah", relationship: "daughter", email: "family@test.com" },
    payload: eligiblePayload(),
    ...overrides,
  }
}

function renderLivePage() {
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
  })

  window.history.replaceState({}, "", "/reports/family_weekly_digest/clients/client-1")

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/reports/family_weekly_digest/clients/client-1"]}>
        <Routes>
          <Route path="/reports/family_weekly_digest" element={<div data-testid="digest-hub">Hub</div>} />
          <Route path="/reports/family_weekly_digest/clients/:clientId" element={<FamilyWeeklyDigestClientPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe("FamilyWeeklyDigestClientPage", () => {
  beforeEach(() => {
    previewFn.mockClear()
    createFn.mockClear()
    sendFn.mockClear()
    listRefetchFn.mockClear()
    listRefetchFn.mockResolvedValue(undefined)
    previewState = { isLoading: false, isError: false, data: previewResponse() }
    listState = { isError: false, data: { results: [] } }
    createFn.mockReturnValue({
      unwrap: () => Promise.resolve({ digest: draftDigest(), eligibility: { ok: true, reasons: [], warnings: [] } }),
    })
    sendFn.mockReturnValue({
      unwrap: () =>
        Promise.resolve(
          draftDigest({
            status: "sent",
            sentAt: "2026-03-25T12:00:00.000Z",
            emailRecipient: "family@test.com",
          }),
        ),
    })
  })

  it("sends selected date as YYYY-MM-DD without UTC conversion", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2026-03-22T12:00:00"))
    try {
      renderLivePage()

      await waitFor(() => expect(previewFn).toHaveBeenCalled())
      expect(previewFn.mock.calls[0]?.[0]).toEqual({ clientId: "client-1", weekStart: "2026-03-22" })

      const input = screen.getByTestId("family-weekly-digest-week-input")
      fireEvent.change(input, { target: { value: "2026-03-15" } })
      await userEvent.click(screen.getByRole("button", { name: /Refresh preview/i }))

      await waitFor(() => expect(previewFn.mock.calls.length).toBeGreaterThan(1))
      const lastCall = previewFn.mock.calls.at(-1)?.[0]
      expect(lastCall).toEqual({ clientId: "client-1", weekStart: "2026-03-15" })
      expect(String(lastCall?.weekStart)).not.toMatch(/T\d{2}:/)
    } finally {
      vi.useRealTimers()
    }
  })

  it("displays backend localWeekKey and weekRangeLabel for Sunday edge selection", async () => {
    renderLivePage()

    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-local-week-key")).toHaveTextContent("Week of 2026-03-16")
    })
    expect(screen.getByTestId("family-weekly-digest-week-range")).toHaveTextContent("Mar 16, 2026 – Mar 22, 2026")
    expect(screen.getByTestId("family-weekly-digest-timezone")).toHaveTextContent("America/Vancouver")
    expect(screen.getByText("Sunday evening check-in.")).toBeInTheDocument()
  })

  it("displays eligibility reasons when recipient cannot receive email", async () => {
    previewState = {
      isLoading: false,
      isError: false,
      data: previewResponse({
        eligibility: { ok: false, reasons: ["Family weekly digest emails are not enabled for this emergency contact."], warnings: [] },
        payload: {
          ...eligiblePayload(),
          eligibility: { ok: false, reasons: ["Family weekly digest emails are not enabled for this emergency contact."], warnings: [] },
        },
      }),
    }
    renderLivePage()

    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-eligibility")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("family-weekly-digest-create-draft")).not.toBeInTheDocument()
    expect(screen.queryByTestId("family-weekly-digest-send")).not.toBeInTheDocument()
  })

  it("allows draft creation when eligible", async () => {
    renderLivePage()

    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-create-draft")).toBeInTheDocument()
    })
    await userEvent.click(screen.getByTestId("family-weekly-digest-create-draft"))
    await waitFor(() =>
      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-1",
          weekStart: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      ),
    )
  })

  it("shows send button for draft and requires confirmation", async () => {
    listState = { isError: false, data: { results: [draftDigest()] } }
    renderLivePage()

    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-send")).toBeInTheDocument()
    })
    await userEvent.click(screen.getByTestId("family-weekly-digest-send"))
    expect(screen.getByText(/Send weekly family digest/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Send email/i }))
    await waitFor(() =>
      expect(sendFn).toHaveBeenCalledWith({ digestId: "digest-1", clientId: "client-1" }),
    )
  })

  it("shows sent state after send and hides send button", async () => {
    listState = {
      isError: false,
      data: {
        results: [
          draftDigest({
            status: "sent",
            sentAt: "2026-03-25T12:00:00.000Z",
            emailRecipient: "family@test.com",
          }),
        ],
      },
    }
    renderLivePage()

    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-sent-immutable-banner")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("family-weekly-digest-send")).not.toBeInTheDocument()
    expect(screen.queryByTestId("family-weekly-digest-create-draft")).not.toBeInTheDocument()
  })

  it("shows success after draft creation", async () => {
    renderLivePage()

    await waitFor(() => expect(screen.getByTestId("family-weekly-digest-create-draft")).toBeInTheDocument())
    await userEvent.click(screen.getByTestId("family-weekly-digest-create-draft"))
    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-action-success")).toHaveTextContent(/Draft saved/i)
    })
  })

  it("displays create draft error", async () => {
    createFn.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Could not create digest" } }),
    })
    renderLivePage()

    await waitFor(() => expect(screen.getByTestId("family-weekly-digest-create-draft")).toBeInTheDocument())
    await userEvent.click(screen.getByTestId("family-weekly-digest-create-draft"))
    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-action-error")).toHaveTextContent(/Could not create digest/i)
    })
  })

  it("displays duplicate send error", async () => {
    listState = { isError: false, data: { results: [draftDigest()] } }
    sendFn.mockReset()
    sendFn.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Digest was already sent" } }),
    })
    renderLivePage()

    await waitFor(() => expect(screen.getByTestId("family-weekly-digest-send")).toBeInTheDocument())
    await userEvent.click(screen.getByTestId("family-weekly-digest-send"))
    await userEvent.click(screen.getByRole("button", { name: /Send email/i }))
    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-action-error")).toHaveTextContent(/already sent/i)
    })
  })

  it("hides PHI preview when saved digest is redacted", async () => {
    listState = {
      isError: false,
      data: {
        results: [
          draftDigest({
            status: "sent",
            phiRedactedAt: "2026-03-26T12:00:00.000Z",
            payload: { ...eligiblePayload(), phiRedacted: true, callRows: [], title: "[Redacted]" },
          }),
        ],
      },
    }
    renderLivePage()

    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-phi-redacted-banner")).toBeInTheDocument()
    })
    expect(screen.queryByText("Sunday evening check-in.")).not.toBeInTheDocument()
  })

  it("does not show UTC-specific week picker copy", () => {
    renderLivePage()
    expect(screen.getByText(/Reference date/i)).toBeInTheDocument()
    expect(screen.queryByText(/UTC/i)).not.toBeInTheDocument()
    expect(screen.getByText(/facility timezone determines/i)).toBeInTheDocument()
  })

  it("shows legacy UTC banner when preview returns legacyUtcWeek", async () => {
    previewState = {
      isLoading: false,
      isError: false,
      data: previewResponse({
        legacyUtcWeek: true,
        payload: { ...eligiblePayload(), legacyUtcWeek: true },
      }),
    }
    renderLivePage()

    await waitFor(() => {
      expect(screen.getByTestId("family-weekly-digest-legacy-utc")).toHaveTextContent(/older week boundaries/i)
    })
  })

  it("redirects the sample client route away from mock content", () => {
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

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/reports/family_weekly_digest/clients/sample"]}>
          <Routes>
            <Route path="/reports/family_weekly_digest" element={<div data-testid="digest-hub">Hub</div>} />
            <Route path="/reports/family_weekly_digest/clients/:clientId" element={<FamilyWeeklyDigestClientPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.getByTestId("digest-hub")).toBeInTheDocument()
    expect(screen.queryByTestId("family-weekly-digest-sample-banner")).not.toBeInTheDocument()
  })
})
