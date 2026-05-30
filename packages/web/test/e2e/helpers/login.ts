import type { Page } from "@playwright/test"
import { TEST_USERS } from "../fixtures/testData"

/** Returns true when login succeeded without MFA. */
export async function loginAsTestUser(page: Page): Promise<boolean> {
  await page.goto("/login")
  await page.getByTestId("email-input").fill(TEST_USERS.WITH_CLIENTS.email)
  await page.getByTestId("password-input").fill(TEST_USERS.WITH_CLIENTS.password)

  const loginWait = page.waitForResponse(
    (r) => r.url().includes("/v1/auth/login") && r.request().method() === "POST",
    { timeout: 20_000 },
  )
  await page.getByTestId("login-button").click()

  try {
    const loginRes = await loginWait
    if (loginRes.status() !== 200) return false
    const body = (await loginRes.json()) as { requireMFA?: boolean }
    return !body.requireMFA
  } catch {
    return false
  }
}
