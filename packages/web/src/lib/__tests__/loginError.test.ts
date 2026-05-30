import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"
import { appLocalesAuth } from "../../i18n/locales/appLocalesAuth"
import { mapValidationErrorToMessage, parseLoginError } from "../loginError"

function testT(key: string): string {
  let cur: unknown = appLocalesAuth
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in cur) cur = (cur as Record<string, unknown>)[part]
    else return key
  }
  return typeof cur === "string" ? cur : key
}

const t = testT as TFunction

describe("mapValidationErrorToMessage", () => {
  it("maps known validation keys to friendly copy", () => {
    expect(mapValidationErrorToMessage("can't be blank", t)).toBe("Please enter your email address")
    expect(mapValidationErrorToMessage("must be at least 6 characters", t)).toBe("Email address is too short")
    expect(mapValidationErrorToMessage("must be a valid email address", t)).toBe("Please enter a valid email address")
  })
  it("passes through unknown messages", () => {
    expect(mapValidationErrorToMessage("custom", t)).toBe("custom")
  })
})

describe("parseLoginError", () => {
  it("reads message from data.message", () => {
    expect(parseLoginError({ data: { message: "Bad credentials" } }, t).message).toBe("Bad credentials")
  })

  it("detects SSO linking from requiresPasswordLinking", () => {
    const r = parseLoginError(
      {
        data: { requiresPasswordLinking: true, message: "Use SSO" },
        status: 400,
      },
      t,
    )
    expect(r.requiresSSOLinking).toBe(true)
    expect(r.message).toContain("SSO")
  })

  it("detects email verification copy", () => {
    const r = parseLoginError({ data: { message: "Please verify your email first" } }, t)
    expect(r.emailVerificationRequired).toBe(true)
  })

  it("uses 401 fallback copy", () => {
    expect(parseLoginError({ status: 401 }, t).message).toMatch(/Invalid email or password/)
  })

  it("handles CUSTOM_ERROR shape", () => {
    expect(
      parseLoginError(
        {
          error: { status: "CUSTOM_ERROR", error: "Authentication cancelled" },
        },
        t,
      ).message,
    ).toBe("Authentication cancelled")
  })
})
