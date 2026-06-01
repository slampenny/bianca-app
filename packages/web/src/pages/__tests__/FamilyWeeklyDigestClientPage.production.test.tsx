import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { FamilyWeeklyDigestClientPage } from "../FamilyWeeklyDigestClientPage"

vi.mock("../../lib/devDemo", () => ({
  isDevDemoEnabled: () => false,
}))

function renderSampleRoute() {
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
      <MemoryRouter initialEntries={["/reports/family_weekly_digest/clients/sample"]}>
        <Routes>
          <Route path="/reports/family_weekly_digest" element={<div data-testid="digest-hub">Hub</div>} />
          <Route path="/reports/family_weekly_digest/clients/:clientId" element={<FamilyWeeklyDigestClientPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe("FamilyWeeklyDigestClientPage production mode", () => {
  it("redirects the sample client route away from mock content", () => {
    renderSampleRoute()
    expect(screen.getByTestId("digest-hub")).toBeInTheDocument()
    expect(screen.queryByText("Eleanor Briggs")).not.toBeInTheDocument()
    expect(screen.queryByTestId("family-weekly-digest-sample-banner")).not.toBeInTheDocument()
  })
})
