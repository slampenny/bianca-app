import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { createWebTestStore } from "../../../test/helpers/store"
import { FamilyWeeklyDigestHubPage } from "../FamilyWeeklyDigestHubPage"

vi.mock("../../services/api/clientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api/clientApi")>()
  return {
    ...actual,
    useGetAllClientsQuery: () => ({
      data: {
        results: [{ id: "client-abc", name: "Jane Doe", preferredName: null, firstName: "Jane", lastName: "Doe" }],
      },
      isLoading: false,
      isFetching: false,
      isError: false,
    }),
  }
})

function renderHub() {
  const store = createWebTestStore()
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <FamilyWeeklyDigestHubPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe("FamilyWeeklyDigestHubPage", () => {
  it("links to the registered client digest route", () => {
    renderHub()
    const link = screen.getByRole("link", { name: /Jane Doe/i })
    expect(link).toHaveAttribute("href", "/reports/family_weekly_digest/clients/client-abc")
  })
})
