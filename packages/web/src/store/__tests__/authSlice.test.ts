import { describe, expect, it } from "vitest"
import authReducer, {
  clearAuth,
  getAuthEmail,
  getAuthTokens,
  getCurrentUser,
  getValidationError,
  isAuthenticated,
  setAuthEmail,
  setAuthTokens,
  setCurrentUser,
} from "../authSlice"
import type { AuthTokens, Caregiver } from "../../services/api/api.types"

const tokens: AuthTokens = {
  access: { token: "a", expires: "2099-01-01" },
  refresh: { token: "r", expires: "2099-01-01" },
}

const caregiver: Caregiver = {
  name: "N",
  avatar: "",
  email: "e@e.com",
  phone: "1",
  org: "o",
  role: "staff",
  clients: [],
}

const initial = authReducer(undefined, { type: "@@INIT" })

describe("authSlice reducers", () => {
  it("setAuthTokens stores tokens", () => {
    const s = authReducer(initial, setAuthTokens(tokens))
    expect(s.tokens).toEqual(tokens)
  })

  it("setAuthEmail updates email", () => {
    const s = authReducer(initial, setAuthEmail("hello@test.com"))
    expect(s.authEmail).toBe("hello@test.com")
  })

  it("setCurrentUser stores caregiver", () => {
    const s = authReducer(initial, setCurrentUser(caregiver))
    expect(s.currentUser?.email).toBe("e@e.com")
  })

  it("clearAuth resets session fields", () => {
    let s = authReducer(initial, setAuthTokens(tokens))
    s = authReducer(s, setAuthEmail("x@y.com"))
    s = authReducer(s, setCurrentUser(caregiver))
    s = authReducer(s, clearAuth())
    expect(s.tokens).toBeNull()
    expect(s.authEmail).toBe("")
    expect(s.currentUser).toBeNull()
  })
})

describe("auth selectors", () => {
  it("isAuthenticated reflects tokens", () => {
    expect(isAuthenticated({ auth: initial })).toBe(false)
    const withTok = authReducer(initial, setAuthTokens(tokens))
    expect(isAuthenticated({ auth: withTok })).toBe(true)
  })

  it("getValidationError enforces email rules", () => {
    expect(getValidationError({ auth: { ...initial, authEmail: "" } })).toBe("can't be blank")
    expect(getValidationError({ auth: { ...initial, authEmail: "ab" } })).toBe("must be at least 6 characters")
    expect(getValidationError({ auth: { ...initial, authEmail: "not-an-email" } })).toBe(
      "must be a valid email address",
    )
    expect(getValidationError({ auth: { ...initial, authEmail: "ok@test.com" } })).toBe("")
  })

  it("getCurrentUser and getAuthEmail read state", () => {
    let s = authReducer(initial, setAuthEmail("u@test.com"))
    s = authReducer(s, setCurrentUser(caregiver))
    expect(getAuthEmail({ auth: s })).toBe("u@test.com")
    expect(getCurrentUser({ auth: s })?.name).toBe("N")
    expect(getAuthTokens({ auth: s })).toBeNull()
  })
})
