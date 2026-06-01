import { describe, expect, it } from "vitest"
import { buildDailyDigestAutomationStatus } from "../dailyDigestAutomation"
import type { Caregiver, Org } from "../../services/api/api.types"

function baseCaregiver(overrides: Partial<Caregiver> = {}): Caregiver {
  return {
    id: "cg1",
    name: "Test User",
    avatar: "",
    email: "u@test.com",
    phone: "",
    org: "org1",
    role: "staff",
    clients: [],
    active: true,
    isEmailVerified: true,
    notificationPreferences: { dailyDigestEmail: true },
    ...overrides,
  }
}

function baseOrg(overrides: Partial<Org> = {}): Org {
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

describe("buildDailyDigestAutomationStatus", () => {
  it("marks automated ready when all checks pass", () => {
    const status = buildDailyDigestAutomationStatus({
      caregiver: baseCaregiver(),
      org: baseOrg(),
      orgSchedulingAvailability: "available",
    })
    expect(status.automatedReady).toBe(true)
    expect(status.manualSendReady).toBe(true)
  })

  it("blocks automated send when email is unverified", () => {
    const status = buildDailyDigestAutomationStatus({
      caregiver: baseCaregiver({ isEmailVerified: false }),
      org: baseOrg(),
      orgSchedulingAvailability: "available",
    })
    expect(status.automatedReady).toBe(false)
    expect(status.manualSendReady).toBe(false)
    expect(status.showVerifyEmailCta).toBe(true)
  })

  it("shows preference CTA when dailyDigestEmail is off", () => {
    const status = buildDailyDigestAutomationStatus({
      caregiver: baseCaregiver({ notificationPreferences: { dailyDigestEmail: false } }),
      org: baseOrg(),
      orgSchedulingAvailability: "available",
    })
    expect(status.automatedReady).toBe(false)
    expect(status.showPreferenceCta).toBe(true)
  })

  it("shows ask-admin when org scheduling is disabled", () => {
    const status = buildDailyDigestAutomationStatus({
      caregiver: baseCaregiver(),
      org: baseOrg({ dailyDigestSettings: { enabled: false, sendTime: "18:00" } }),
      orgSchedulingAvailability: "available",
    })
    expect(status.automatedReady).toBe(false)
    expect(status.showAskAdminForScheduling).toBe(true)
  })

  it("treats org scheduling as unknown when unavailable", () => {
    const status = buildDailyDigestAutomationStatus({
      caregiver: baseCaregiver(),
      org: null,
      orgSchedulingAvailability: "unavailable",
    })
    expect(status.automatedReady).toBe(false)
    expect(status.checks.find((c) => c.key === "orgScheduling")?.unknown).toBe(true)
    expect(status.orgSendTime).toBeNull()
  })
})
