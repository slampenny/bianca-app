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

function renderPage(role: "orgAdmin" | "staff") {
  getClientFn.mockReturnValue({
    data: sampleClient(),
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
    sendVerificationFn.mockReturnValue({ unwrap: () => Promise.resolve({ success: true, message: "Sent" }) })
  })

  it("shows send verification button for orgAdmin", async () => {
    renderPage("orgAdmin")
    await waitFor(() => {
      expect(screen.getByTestId("resident-send-family-digest-verification")).toBeInTheDocument()
    })
  })

  it("does not show send verification button for staff", async () => {
    renderPage("staff")
    await waitFor(() => {
      expect(screen.getByText(/Emergency contact email not verified/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId("resident-send-family-digest-verification")).not.toBeInTheDocument()
  })

  it("sends verification email when admin clicks the button", async () => {
    renderPage("orgAdmin")
    await waitFor(() => {
      expect(screen.getByTestId("resident-send-family-digest-verification")).toBeInTheDocument()
    })
    await userEvent.click(screen.getByTestId("resident-send-family-digest-verification"))
    await waitFor(() => {
      expect(sendVerificationFn).toHaveBeenCalledWith({ clientId: "client-1" })
    })
  })
})
