import { test, expect } from "@playwright/test"
import { API_URL } from "./helpers/testConfig"
import { TEST_USERS } from "./fixtures/testData"

/**
 * Verifies OpenAI Realtime connectivity via POST /v1/test/openai-connection (authenticated).
 * UI login ensures the web app + API base URL work; token is read from redux-persist (web shape).
 */
test.describe("OpenAI Voice Connection", () => {
  test("connects to OpenAI and returns voice session details", async ({ page }) => {
    await page.goto("/login")
    await page.getByTestId("email-input").fill(TEST_USERS.WITH_CLIENTS.email)
    await page.getByTestId("password-input").fill(TEST_USERS.WITH_CLIENTS.password)

    const loginWait = page.waitForResponse(
      (r) => r.url().includes("/v1/auth/login") && r.status() === 200,
      { timeout: 20_000 },
    )
    await page.getByTestId("login-button").click()
    await loginWait

    await page.getByTestId("home-header").waitFor({ state: "visible", timeout: 15_000 })

    const authToken = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("persist:auth")
        if (!raw) return null
        const outer = JSON.parse(raw) as Record<string, unknown>
        let tok = outer.tokens
        if (typeof tok === "string") {
          try {
            tok = JSON.parse(tok) as { access?: { token?: string } }
          } catch {
            return null
          }
        }
        const tokens = tok as { access?: { token?: string } } | null
        return tokens?.access?.token ?? null
      } catch {
        return null
      }
    })

    expect(authToken).toBeTruthy()

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
