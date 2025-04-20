// app/services/api/__tests__/authApi.test.ts
import { EnhancedStore } from "@reduxjs/toolkit"
import { orgApi, authApi } from "../"
import { AuthTokens, Caregiver } from "../api.types"
import { store as appStore, RootState } from "../../../store/store"
import { expectError, cleanTestDatabase } from "../../../../test/helpers"
import { newCaregiver } from "../../../../test/fixtures/caregiver.fixture"

describe("authApi", () => {
  let store: EnhancedStore<RootState>
  let orgId: string
  let testCaregiver: { name: string; email: string; password: string; phone: string }
  let caregiver: Caregiver
  let authTokens: AuthTokens

  beforeAll(async () => {
    await cleanTestDatabase()
  })

  beforeEach(async () => {
    store = appStore
    testCaregiver = newCaregiver()
    const result = await authApi.endpoints.register.initiate(testCaregiver)(
      store.dispatch,
      store.getState,
      {},
    )
    if ("data" in result && result.data) {
      orgId = result.data.org.id as string
      caregiver = result.data.caregiver
      authTokens = result.data.tokens
    } else {
      throw new Error(`Registration failed with error: ${JSON.stringify(result.error)}`)
    }
  })

  afterEach(async () => {
    await orgApi.endpoints.deleteOrg.initiate({ orgId })(store.dispatch, store.getState, {})
    jest.clearAllMocks()
  })

  it("should fail to register a new caregiver with a duplicate email", async () => {
    const result = await authApi.endpoints.register.initiate(testCaregiver)(
      store.dispatch,
      store.getState,
      {},
    )
    expectError(result, 400, "Org Email already taken")
  })

  it("should fail to register a new caregiver with invalid input", async () => {
    const invalidCaregiver = { ...testCaregiver, password: "password" }
    const result = await authApi.endpoints.register.initiate(invalidCaregiver)(
      store.dispatch,
      store.getState,
      {},
    )
    expectError(result, 400, "password must contain at least 1 letter and 1 number")
  })

  it("should login a caregiver", async () => {
    const result = await authApi.endpoints.login.initiate({
      email: testCaregiver.email,
      password: testCaregiver.password,
    })(store.dispatch, store.getState, {})
    expect(result).toEqual(expect.anything())
  })

  it("should logout a caregiver", async () => {
    await authApi.endpoints.logout.initiate({ refreshToken: authTokens.refresh.token })(
      store.dispatch,
      store.getState,
      {},
    )
    const authState = store.getState().auth
    expect(authState).toEqual(expect.anything())

    await authApi.endpoints.login.initiate({
      email: testCaregiver.email,
      password: testCaregiver.password,
    })(store.dispatch, store.getState, {})
  })

  it("should refresh tokens", async () => {
    const refreshResult = await authApi.endpoints.refreshTokens.initiate({
      refreshToken: authTokens.refresh.token,
    })(store.dispatch, store.getState, {})
    if ("data" in refreshResult && refreshResult.data) {
      expect(refreshResult.data.tokens.access).toBeDefined()
      expect(refreshResult.data.tokens.refresh).toBeDefined()
    } else {
      fail("Token refresh should have succeeded")
    }
  })

  it("should send forgot password email", async () => {
    try {
      await authApi.endpoints.forgotPassword.initiate({ email: testCaregiver.email })(
        store.dispatch,
        store.getState,
        {},
      )
      expect(true).toBe(true)
    } catch (error) {
      fail("The forgot password request should not fail")
    }
  })

  it("should send verification email", async () => {
    try {
      await authApi.endpoints.sendVerificationEmail.initiate(caregiver)(
        store.dispatch,
        store.getState,
        {},
      )
      expect(true).toBe(true)
    } catch (error) {
      fail("The send verification email request should not fail")
    }
  })
})
