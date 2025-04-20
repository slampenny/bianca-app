import { test, expect } from "@playwright/test"
import { navigateToRegister } from "./helpers/navigation"

test.describe("Register Screen", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToRegister(page) // Adjust if route is different
  })

  test("can fill in all fields", async ({ page }) => {
    await page.getByTestId("register-name").fill("Jordan Lapp")
    await page.getByTestId("register-email").fill("jordan@example.org")
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("StrongPass!1")
    await page.getByTestId("register-phone").fill("1234567890")
  })

  test("shows error if name is empty", async ({ page }) => {
    await page.getByTestId("register-email").fill("jordan@example.org")
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("StrongPass!1")
    await page.getByTestId("register-phone").fill("1234567890")
    await page.getByTestId("register-submit").click()

    await expect(page.getByText(/name cannot be empty/i)).toBeVisible()
  })

  test("shows error for invalid email", async ({ page }) => {
    await page.getByTestId("register-name").fill("Jordan Lapp")
    await page.getByTestId("register-email").fill("bad-email")
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("StrongPass!1")
    await page.getByTestId("register-phone").fill("1234567890")
    await page.getByTestId("register-submit").click()

    await expect(page.getByText(/valid email/i)).toBeVisible()
  })

  test("shows error for weak password", async ({ page }) => {
    await page.getByTestId("register-name").fill("Jordan Lapp")
    await page.getByTestId("register-email").fill("jordan@example.org")
    await page.getByTestId("register-password").fill("weak")
    await page.getByTestId("register-confirm-password").fill("weak")
    await page.getByTestId("register-phone").fill("1234567890")
    await page.getByTestId("register-submit").click()

    await expect(page.getByText(/password must contain/i)).toBeVisible()
  })

  test("shows error when confirm password doesn't match", async ({ page }) => {
    await page.getByTestId("register-name").fill("Jordan Lapp")
    await page.getByTestId("register-email").fill("jordan@example.org")
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("Mismatch123!")
    await page.getByTestId("register-phone").fill("1234567890")
    await page.getByTestId("register-submit").click()

    await expect(page.getByText(/passwords do not match/i)).toBeVisible()
  })

  test("shows error for short phone number", async ({ page }) => {
    await page.getByTestId("register-name").fill("Jordan Lapp")
    await page.getByTestId("register-email").fill("jordan@example.org")
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("StrongPass!1")
    await page.getByTestId("register-phone").fill("123")
    await page.getByTestId("register-submit").click()

    await expect(page.getByText(/phone number.*10 digits/i)).toBeVisible()
  })

  test("shows error if org name is missing when accountType is organization", async ({ page }) => {
    await page.getByTestId("register-organization-toggle").click()

    await page.getByTestId("register-name").fill("Org Rep")
    await page.getByTestId("register-email").fill("org@example.org")
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("StrongPass!1")
    await page.getByTestId("register-phone").fill("1234567890")
    await page.getByTestId("register-submit").click()

    await expect(page.getByText(/organization name cannot be empty/i)).toBeVisible()
  })

  test("shows success message after valid submission", async ({ page }) => {
    await page.getByTestId("register-name").fill("Valid User")
    await page.getByTestId("register-email").fill("valid@example.org")
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("StrongPass!1")
    await page.getByTestId("register-phone").fill("1234567890")

    // Stub success somehow or use a real endpoint mock
    await page.getByTestId("register-submit").click()
    await expect(page.getByText(/registration successful/i)).toBeVisible()
  })

  test("shows error message on backend failure", async ({ page }) => {
    await page.getByTestId("register-name").fill("API Failure")
    await page.getByTestId("register-email").fill("fail@example.org")
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("StrongPass!1")
    await page.getByTestId("register-phone").fill("1234567890")

    // Stub failure path or hit known failing email
    await page.getByTestId("register-submit").click()
    await expect(page.getByText(/registration failed/i)).toBeVisible()
  })

  test("navigates back when goBack is pressed", async ({ page }) => {
    await page.getByTestId("register-go-back").click()
    await expect(page).toHaveURL(/login/i)
  })
})
