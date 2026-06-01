import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FamilyDigestEmailVerifyPage } from "../FamilyDigestEmailVerifyPage"

const verifyFn = vi.fn()

vi.mock("../../services/api/clientApi", () => ({
  useVerifyFamilyDigestEmailMutation: () => [verifyFn, { isLoading: false }],
}))

function renderVerifyPage(token?: string) {
  const path = token ? `/family-digest-email/verify?token=${encodeURIComponent(token)}` : "/family-digest-email/verify"
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/family-digest-email/verify" element={<FamilyDigestEmailVerifyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("FamilyDigestEmailVerifyPage", () => {
  beforeEach(() => {
    verifyFn.mockClear()
    verifyFn.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          message: "Thank you. Your email is now verified to receive weekly family digest emails.",
        }),
    })
  })

  it("shows missing token error when no token in URL", () => {
    renderVerifyPage()
    expect(screen.getByRole("alert")).toHaveTextContent(/missing/i)
    expect(verifyFn).not.toHaveBeenCalled()
  })

  it("shows success after valid token verification", async () => {
    renderVerifyPage("valid-token-abc")
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/verified/i)
    })
    expect(verifyFn).toHaveBeenCalledWith({ token: "valid-token-abc" })
    expect(document.body.textContent).not.toContain("valid-token-abc")
  })

  it("shows already verified message from API", async () => {
    verifyFn.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: true,
          alreadyVerified: true,
          message: "This email address is already verified for weekly family digest emails.",
        }),
    })
    renderVerifyPage("used-token")
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/already verified/i)
    })
    expect(document.body.textContent).not.toContain("used-token")
  })

  it("shows expired/invalid token error", async () => {
    verifyFn.mockReturnValue({
      unwrap: () => Promise.reject({ data: { error: "Invalid or expired verification token" } }),
    })
    renderVerifyPage("expired-token")
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Invalid or expired/i)
    })
    expect(document.body.textContent).not.toContain("expired-token")
  })

  it("shows generic failure when API returns success false", async () => {
    verifyFn.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          success: false,
          message: "Verification could not be completed.",
        }),
    })
    renderVerifyPage("bad-token")
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not be completed/i)
    })
  })

  it("does not render raw token in the DOM during verification", () => {
    renderVerifyPage("secret-jwt-value-should-not-appear")
    expect(document.body.textContent).not.toContain("secret-jwt-value-should-not-appear")
  })
})
