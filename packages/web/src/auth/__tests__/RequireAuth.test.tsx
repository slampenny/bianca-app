import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import type { AuthTokens } from "../../services/api/api.types"
import { RequireAuth } from "../RequireAuth"

const tokens: AuthTokens = {
  access: { token: "access", expires: "2099-01-01" },
  refresh: { token: "refresh", expires: "2099-01-01" },
}

function renderAuthTree(initialPath: string, preloaded?: Parameters<typeof createWebTestStore>[0]) {
  const store = createWebTestStore(preloaded)
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route element={<RequireAuth />}>
            <Route index element={<div>Protected content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe("RequireAuth", () => {
  it("redirects unauthenticated users to /login", () => {
    renderAuthTree("/")
    expect(screen.getByText("Login screen")).toBeInTheDocument()
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument()
  })

  it("renders protected routes when tokens are present", () => {
    renderAuthTree("/", {
      auth: {
        tokens,
        authEmail: "",
        currentUser: null,
        inviteToken: null,
        pendingOnboarding: false,
      },
    })
    expect(screen.getByText("Protected content")).toBeInTheDocument()
    expect(screen.queryByText("Login screen")).not.toBeInTheDocument()
  })
})
