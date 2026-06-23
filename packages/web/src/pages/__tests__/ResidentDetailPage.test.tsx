import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import ResidentDetailPage from "../ResidentDetailPage"
import type { Client } from "../../services/api/api.types"

const getClientFn = vi.fn()
const sendVerificationFn = vi.fn()
const familyPortalStatusFn = vi.fn()
const inviteFamilyPortalFn = vi.fn()
const revokeFamilyPortalFn = vi.fn()

vi.mock("../../services/api/clientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/clientApi")>()
  return {
    ...actual,
    useGetClientQuery: (...args: unknown[]) => getClientFn(...args),
    useSendFamilyDigestEmailVerificationMutation: () => [sendVerificationFn, { isLoading: false }],
    useGetCallsByClientQuery: () => ({ data: undefined, isLoading: false }),
    usePatchClientMutation: () => [vi.fn(), { isLoading: false }],
    useDeleteClientMutation: () => [vi.fn(), { isLoading: false }],
    useUploadClientAvatarMutation: () => [vi.fn(), { isLoading: false }],
    useGetFamilyPortalStatusQuery: (...args: unknown[]) => familyPortalStatusFn(...args),
    useInviteFamilyPortalMutation: () => [inviteFamilyPortalFn, { isLoading: false }],
    useRevokeFamilyPortalMutation: () => [revokeFamilyPortalFn, { isLoading: false }],
  }
})

vi.mock("../../services/api/alertApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/alertApi")>()
  return {
    ...actual,
    useGetAllAlertsQuery: () => ({ data: undefined }),
  }
})

vi.mock("../../services/api/sentimentApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/sentimentApi")>()
  return {
    ...actual,
    useGetSentimentSummaryQuery: () => ({ data: undefined, isLoading: false, isError: false }),
    useGetSentimentTrendQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  }
})

vi.mock("../../services/api/medicalAnalysisApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/medicalAnalysisApi")>()
  return {
    ...actual,
    useGetMedicalAnalysisResultsQuery: () => ({ data: undefined, isLoading: false, isError: false }),
    useGetMedicalAnalysisSummaryQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  }
})

vi.mock("../../services/api/scheduleApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/scheduleApi")>()
  return {
    ...actual,
    useCreateScheduleForClientMutation: () => [vi.fn(), { isLoading: false }],
    useUpdateScheduleMutation: () => [vi.fn(), { isLoading: false }],
    useDeleteScheduleMutation: () => [vi.fn(), { isLoading: false }],
  }
})

function sampleClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Eleanor Alphabet",
    firstName: "Eleanor",
    lastName: "Alphabet",
    email: "eleanor@example.org",
    phone: "+16045624299",
    preferredLanguage: "en",
    emergencyContact: {
      name: "Martha",
      relationship: "Daughter",
      phone: "+16045624298",
      email: "family@test.com",
      familyDigestEmail: { enabled: true, verifiedAt: null, verifiedEmail: null },
    },
    schedules: [],
    ...overrides,
  } as Client
}

function sampleClientWithUnverifiedDigestRecipient(overrides: Partial<Client> = {}): Client {
  return sampleClient({
    familyDigestRecipients: [
      {
        id: "recipient-1",
        name: "Martha",
        relationship: "daughter",
        email: "family@test.com",
        familyDigestEmail: { enabled: true, verifiedAt: null, verifiedEmail: null },
      },
    ],
    ...overrides,
  })
}
function sampleClientWithVerifiedDigestRecipient(overrides: Partial<Client> = {}): Client {
  return sampleClient({
    familyDigestRecipients: [
      {
        id: "recipient-1",
        name: "Martha",
        relationship: "daughter",
        email: "family@test.com",
        familyDigestEmail: {
          enabled: true,
          verifiedAt: "2026-01-01T00:00:00.000Z",
          verifiedEmail: "family@test.com",
        },
      },
    ],
    ...overrides,
  })
}

function mockFamilyPortalStatus(portalStatus: "not_invited" | "invited" | "active") {
  familyPortalStatusFn.mockReturnValue({
    data: {
      enabled: true,
      recipients: [{ recipientId: "recipient-1", portalStatus }],
    },
  })
}

function renderPage(role: "orgAdmin" | "staff", client: Client = sampleClient()) {
  getClientFn.mockReturnValue({
    data: client,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  })

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
        role,
        clients: [],
      },
      inviteToken: null,
      pendingOnboarding: false,
    },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/residents/client-1"]}>
        <Routes>
          <Route path="/residents/:residentId" element={<ResidentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe("ResidentDetailPage family digest verification", () => {
  beforeEach(() => {
    getClientFn.mockClear()
    sendVerificationFn.mockReset()
    familyPortalStatusFn.mockReset()
    inviteFamilyPortalFn.mockReset()
    revokeFamilyPortalFn.mockReset()
    familyPortalStatusFn.mockReturnValue({ data: undefined })
    sendVerificationFn.mockReturnValue({ unwrap: () => Promise.resolve({ success: true, message: "Sent" }) })
    inviteFamilyPortalFn.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Family app invitation sent." }),
    })
    revokeFamilyPortalFn.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Family app access revoked for this resident." }),
    })
  })

  it("shows send verification button for orgAdmin", async () => {
    renderPage("orgAdmin", sampleClientWithUnverifiedDigestRecipient())
    await waitFor(() => {
      expect(screen.getByTestId("resident-send-family-digest-verification")).toBeInTheDocument()
    })
  })

  it("does not show send verification button for staff", async () => {
    renderPage("staff", sampleClientWithUnverifiedDigestRecipient())
    await waitFor(() => {
      expect(screen.getByText(/Email not verified/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId("resident-send-family-digest-verification")).not.toBeInTheDocument()
  })

  it("sends verification email when admin clicks the button", async () => {
    renderPage("orgAdmin", sampleClientWithUnverifiedDigestRecipient())
    await waitFor(() => {
      expect(screen.getByTestId("resident-send-family-digest-verification")).toBeInTheDocument()
    })
    await userEvent.click(screen.getByTestId("resident-send-family-digest-verification"))
    await waitFor(() => {
      expect(sendVerificationFn).toHaveBeenCalledWith({ clientId: "client-1", recipientId: "recipient-1" })
    })
  })
})

describe("ResidentDetailPage family portal access", () => {
  beforeEach(() => {
    getClientFn.mockClear()
    familyPortalStatusFn.mockReset()
    inviteFamilyPortalFn.mockReset()
    revokeFamilyPortalFn.mockReset()
    inviteFamilyPortalFn.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Family app invitation sent." }),
    })
    revokeFamilyPortalFn.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, message: "Family app access revoked for this resident." }),
    })
  })

  it("shows invite button when portal is enabled and recipient is verified", async () => {
    mockFamilyPortalStatus("not_invited")
    renderPage("orgAdmin", sampleClientWithVerifiedDigestRecipient())
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Invite to mobile app/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/Mobile app: not invited/i)).toBeInTheDocument()
  })

  it("shows revoke button when family portal access is active", async () => {
    mockFamilyPortalStatus("active")
    renderPage("orgAdmin", sampleClientWithVerifiedDigestRecipient())
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Revoke app access/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/Mobile app: active/i)).toBeInTheDocument()
  })

  it("sends family portal invite when admin clicks invite", async () => {
    mockFamilyPortalStatus("not_invited")
    renderPage("orgAdmin", sampleClientWithVerifiedDigestRecipient())
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Invite to mobile app/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole("button", { name: /Invite to mobile app/i }))
    await waitFor(() => {
      expect(inviteFamilyPortalFn).toHaveBeenCalledWith({ clientId: "client-1", recipientId: "recipient-1" })
    })
  })

  it("revokes family portal access when admin clicks revoke", async () => {
    mockFamilyPortalStatus("active")
    renderPage("orgAdmin", sampleClientWithVerifiedDigestRecipient())
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Revoke app access/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole("button", { name: /Revoke app access/i }))
    await waitFor(() => {
      expect(revokeFamilyPortalFn).toHaveBeenCalledWith({ clientId: "client-1", recipientId: "recipient-1" })
    })
  })
})
