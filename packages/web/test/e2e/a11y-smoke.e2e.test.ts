import { test } from "@playwright/test"
import { expectCurrentPageAccessible, expectNoSeriousViolations } from "./helpers/a11y"
import { loginAsTestUser } from "./helpers/login"

test.describe("Accessibility smoke", () => {
  test("login page", async ({ page }) => {
    await expectNoSeriousViolations(page, "/login")
  })

  test("register page", async ({ page }) => {
    await expectNoSeriousViolations(page, "/register")
  })

  test("forgot password page", async ({ page }) => {
    await expectNoSeriousViolations(page, "/forgot-password")
  })

  test.describe("authenticated app pages", () => {
    test.beforeEach(async ({ page }) => {
      const loginOk = await loginAsTestUser(page)
      test.skip(!loginOk, "Backend login unavailable or MFA required — skipping authenticated a11y smoke")
    })

    test("residents page", async ({ page }) => {
      await page.goto("/residents")
      await page.waitForLoadState("networkidle")
      await expectCurrentPageAccessible(page)
    })

    test("reports page", async ({ page }) => {
      await page.goto("/reports")
      await page.waitForLoadState("networkidle")
      await expectCurrentPageAccessible(page)
    })

    test("settings page", async ({ page }) => {
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")
      await expectCurrentPageAccessible(page)
    })

    test("dashboard page", async ({ page }) => {
      await page.goto("/")
      await page.waitForLoadState("networkidle")
      await expectCurrentPageAccessible(page)
    })

    test("alerts page", async ({ page }) => {
      await page.goto("/alerts")
      await page.waitForLoadState("networkidle")
      await expectCurrentPageAccessible(page)
    })

    test("caregivers page", async ({ page }) => {
      await page.goto("/caregivers")
      await page.waitForLoadState("networkidle")
      await expectCurrentPageAccessible(page)
    })
  })

  test("check email page", async ({ page }) => {
    await expectNoSeriousViolations(page, "/check-email")
  })
})
