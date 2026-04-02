import { test, expect } from "@playwright/test"
import { API_URL } from "./helpers/testConfig"
import { TEST_USERS } from "./fixtures/testData"

/**
 * Verifies OpenAI Realtime connectivity via POST /v1/test/openai-connection (authenticated).
 * UI login ensures the web app + API base URL work; bearer token comes from the login response body.
 * (Tokens are intentionally not persisted to localStorage — see authPersistConfig blacklist.)
 */
test.describe("OpenAI Voice Connection", () => {
  test("connects to OpenAI and returns voice session details", async ({ page }) => {
    await page.goto("/login")
    await page.getByTestId("email-input").fill(TEST_USERS.WITH_CLIENTS.email)
    await page.getByTestId("password-input").fill(TEST_USERS.WITH_CLIENTS.password)

    const loginWait = page.waitForResponse(
      (r) => r.url().includes("/v1/auth/login") && r.request().method() === "POST",
      { timeout: 20_000 },
    )
    await page.getByTestId("login-button").click()
    const loginRes = await loginWait
    expect(loginRes.status()).toBe(200)

    const loginBody = (await loginRes.json()) as {
      requireMFA?: boolean
      tokens?: { access?: { token?: string } }
    }
    if (loginBody.requireMFA) {
      throw new Error("OpenAI voice e2e: test user requires MFA; use a non-MFA fixture in CI")
    }
    const authToken = loginBody.tokens?.access?.token
    expect(authToken).toBeTruthy()

    await page.getByTestId("home-header").waitFor({ state: "visible", timeout: 15_000 })

    const response = await page.request.post(`${API_URL}/test/openai-connection`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      data: {},
    })

    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.sessionId).toBeTruthy()
    expect(result.sessionDetails?.session?.voice).toBeTruthy()
    expect(result.sessionDetails?.session?.model).toBeTruthy()
    const messageTypes = (result.receivedMessages as { type: string }[]).map((m) => m.type)
    expect(messageTypes).toContain("session.created")
    expect(messageTypes).toContain("session.updated")
  })
})
