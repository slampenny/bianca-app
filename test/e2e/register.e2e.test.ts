import { test, expect } from "@playwright/test"
import { navigateToRegister, isLoginScreen, isHomeScreen } from "./helpers/navigation"

const REGISTER_API_URL = '**/v1/auth/register';
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

    // await page.route(REGISTER_API_URL, async route => {
    //   console.log(`Intercepted ${route.request().method()} ${route.request().url()} for success`);
    //   await route.fulfill({
    //     status: 200,
    //     contentType: 'application/json',
        
    //     // Adjust body if your API/hook expects specific success data
    //     body: JSON.stringify({ message: "Registration successful", userId: "123" }),
    //   });
    // });
    const uniqueEmail = `valid_success_${Date.now()}@example.org`;
    await page.getByTestId("register-name").fill("Valid User")
    await page.getByTestId("register-email").fill(uniqueEmail)
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("StrongPass!1")
    await page.getByTestId("register-phone").fill("1234567890")

    await page.getByTestId("register-submit").click()
    await isHomeScreen(page);
  })

  test("shows error message on backend failure", async ({ page }) => {
    await page.getByTestId("register-name").fill("API Failure")
    await page.getByTestId("register-email").fill("fail@example")
    await page.getByTestId("register-password").fill("StrongPass!1")
    await page.getByTestId("register-confirm-password").fill("StrongPass!1")
    await page.getByTestId("register-phone").fill("1234567890")

    // Stub failure path or hit known failing email
    await page.getByTestId("register-submit").click()
    await expect(page.getByText(/Please enter a valid email address/i)).toBeVisible()
  })

  test("navigates back when goBack is pressed", async ({ page }) => {
    await page.getByTestId("register-go-back").click()
    await isLoginScreen(page)
  })
})
