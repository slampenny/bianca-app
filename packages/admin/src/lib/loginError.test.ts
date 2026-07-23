import { describe, expect, it } from "vitest"
import { mapValidationErrorToMessage, parseLoginError } from "./loginError"

describe("mapValidationErrorToMessage", () => {
  it("maps known validation strings", () => {
    expect(mapValidationErrorToMessage("can't be blank")).toBe("Please enter your email address")
    expect(mapValidationErrorToMessage("must be a valid email address")).toBe(
      "Please enter a valid email address",
    )
  })
})

describe("parseLoginError", () => {
  it("surfaces account lock message from API instead of generic failure", () => {
    const r = parseLoginError({
      status: 403,
      data: { message: "Account is locked: Automatic lock due to: data_exfiltration_attempt" },
    })
    expect(r.accountLocked).toBe(true)
    expect(r.message).toContain("Account is locked")
    expect(r.message).not.toMatch(/internal server error/i)
  })

  it("never shows bare Internal Server Error to the user", () => {
    const r = parseLoginError({
      status: 500,
      data: { message: "Internal Server Error" },
    })
    expect(r.message).not.toMatch(/^internal server error$/i)
    expect(r.message.toLowerCase()).toContain("server problem")
  })

  it("maps 401 without body to invalid credentials", () => {
    expect(parseLoginError({ status: 401 }).message).toMatch(/Invalid email or password/)
  })

  it("prefers explicit API message for other failures", () => {
    expect(parseLoginError({ data: { message: "Incorrect email or password" } }).message).toBe(
      "Incorrect email or password",
    )
  })
})
