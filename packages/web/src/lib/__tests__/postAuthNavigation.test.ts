import { describe, expect, it } from "vitest"
import { needsOnboarding, resolvePostAuthPath } from "../postAuthNavigation"
import type { Caregiver } from "../../services/api/api.types"

const baseCaregiver = {
  name: "Test",
  avatar: "",
  email: "a@b.com",
  phone: "",
  org: "org1",
  role: "orgAdmin" as const,
  clients: [],
}

describe("postAuthNavigation", () => {
  it("detects incomplete onboarding", () => {
    expect(needsOnboarding({ ...baseCaregiver, onboardingComplete: false })).toBe(true)
    expect(needsOnboarding({ ...baseCaregiver, onboardingComplete: true })).toBe(false)
    expect(needsOnboarding({ ...baseCaregiver })).toBe(false)
    expect(needsOnboarding(null)).toBe(false)
  })

  it("routes new SSO users to onboarding", () => {
    const path = resolvePostAuthPath({ ...baseCaregiver, onboardingComplete: false })
    expect(path).toBe("/onboarding")
  })

  it("honours return path when onboarding is complete", () => {
    const path = resolvePostAuthPath(
      { ...baseCaregiver, onboardingComplete: true },
      { pathname: "/residents", search: "?x=1" },
    )
    expect(path).toBe("/residents?x=1")
  })
})
