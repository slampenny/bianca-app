import { describe, expect, it } from "vitest"
import { mapValidationErrorToMessage, parseLoginError } from "../loginError"

describe("mapValidationErrorToMessage", () => {
  it("maps known validation keys to friendly copy", () => {
    expect(mapValidationErrorToMessage("can't be blank")).toBe("Please enter your email address")
    expect(mapValidationErrorToMessage("must be at least 6 characters")).toBe("Email address is too short")
    expect(mapValidationErrorToMessage("must be a valid email address")).toBe("Please enter a valid email address")
  })
  it("passes through unknown messages", () => {
    expect(mapValidationErrorToMessage("custom")).toBe("custom")
  })
})

describe("parseLoginError", () => {
  it("reads message from data.message", () => {
    expect(parseLoginError({ data: { message: "Bad credentials" } }).message).toBe("Bad credentials")
  })

  it("detects SSO linking from requiresPasswordLinking", () => {
    const r = parseLoginError({
      data: { requiresPasswordLinking: true, message: "Use SSO" },
      status: 400,
    })
    expect(r.requiresSSOLinking).toBe(true)
    expect(r.message).toContain("SSO")
  })

  it("detects email verification copy", () => {
    const r = parseLoginError({ data: { message: "Please verify your email first" } })
    expect(r.emailVerificationRequired).toBe(true)
  })

  it("uses 401 fallback copy", () => {
    expect(parseLoginError({ status: 401 }).message).toMatch(/Invalid email or password/)
  })

  it("handles CUSTOM_ERROR shape", () => {
    expect(
      parseLoginError({
        error: { status: "CUSTOM_ERROR", error: "Authentication cancelled" },
      }).message,
    ).toBe("Authentication cancelled")
  })
})
