import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import type { AuthTokens, Caregiver, Org } from "../../services/api/api.types"
import { LoginPage } from "../LoginPage"

const tokens: AuthTokens = {
  access: { token: "a", expires: "2099-01-01" },
  refresh: { token: "r", expires: "2099-01-01" },
}

const caregiver: Caregiver = {
  name: "Test User",
  avatar: "",
  email: "u@test.com",
  phone: "1",
  org: "org1",
  role: "staff",
  clients: [],
}

const org: Org = {
  name: "Org",
  avatar: "",
  email: "o@o.com",
  phone: "1",
  stripeCustomerId: "",
  isEmailVerified: true,
  caregivers: [],
  clients: [],
}

const { loginMutate, unwrap, navigateMock } = vi.hoisted(() => {
  const unwrap = vi.fn()
  const loginMutate = vi.fn(() => ({ unwrap }))
  const navigateMock = vi.fn()
  return { loginMutate, unwrap, navigateMock }
})

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock("../../services/api/authApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/authApi")>()
  return {
    ...actual,
    useLoginMutation: () => [loginMutate, { reset: vi.fn() }],
  }
})

function renderLogin(initialPath = "/login", locationState?: object) {
  const store = createWebTestStore({
    auth: {
      tokens: null,
      authEmail: "user@test.com",
      currentUser: null,
      inviteToken: null,
      pendingOnboarding: false,
    },
  })
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[{ pathname: initialPath, state: locationState }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  }
}

describe("LoginPage", () => {
  beforeEach(() => {
    loginMutate.mockClear()
    unwrap.mockReset()
    navigateMock.mockClear()
  })

  it("renders sign-in form", () => {
    renderLogin()
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toHaveValue("user@test.com")
  })

  it("shows friendly validation message when email is invalid on submit", async () => {
    const user = userEvent.setup()
    const { store } = renderLogin()
    await user.clear(screen.getByLabelText(/email/i))
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/enter your email address/i)
    expect(loginMutate).not.toHaveBeenCalled()
    expect(store.getState().auth.authEmail).toBe("")
  })

  it("dispatches auth and navigates home after successful login", async () => {
    const user = userEvent.setup()
    unwrap.mockResolvedValue({ tokens, caregiver, org })
    const { store } = renderLogin()
    await user.type(screen.getByTestId("password-input"), "secret")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() => {
      expect(loginMutate).toHaveBeenCalledWith({ email: "user@test.com", password: "secret" })
    })
    expect(unwrap).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true })
    expect(store.getState().auth.tokens).toEqual(tokens)
    expect(store.getState().auth.currentUser).toEqual(caregiver)
  })
})
