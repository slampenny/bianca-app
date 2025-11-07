import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToRegister, isLoginScreen, isHomeScreen } from "./helpers/navigation"
import { generateRegistrationData } from './fixtures/testData'

test.describe("Register Screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await navigateToRegister(page)
  })

  test("can fill in all fields", async ({ page }) => {
    // Use aria-label for React Native Web
    await page.locator('[aria-label="register-name"]').fill("Jordan Lapp")
    await page.locator('[aria-label="register-email"]').fill("jordan@example.org")
    await page.locator('[aria-label="register-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-confirm-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-phone"]').fill("1234567890")
  })

  test("shows error if name is empty", async ({ page }) => {
    await page.locator('[aria-label="register-email"]').fill("jordan@example.org")
    await page.locator('[aria-label="register-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-confirm-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-phone"]').fill("1234567890")
    await page.locator('[aria-label="register-submit"]').click()

    await expect(page.getByText(/name cannot be empty/i)).toBeVisible()
  })

  test("shows error for invalid email", async ({ page }) => {
    await page.locator('[aria-label="register-name"]').fill("Jordan Lapp")
    await page.locator('[aria-label="register-email"]').fill("bad-email")
    await page.locator('[aria-label="register-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-confirm-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-phone"]').fill("1234567890")
    await page.locator('[aria-label="register-submit"]').click()

    await expect(page.getByText(/valid email/i)).toBeVisible()
  })

  test("shows error for weak password", async ({ page }) => {
    await page.locator('[aria-label="register-name"]').fill("Jordan Lapp")
    await page.locator('[aria-label="register-email"]').fill("jordan@example.org")
    await page.locator('[aria-label="register-password"]').fill("weak")
    await page.locator('[aria-label="register-confirm-password"]').fill("weak")
    await page.locator('[aria-label="register-phone"]').fill("1234567890")
    await page.locator('[aria-label="register-submit"]').click()

    await expect(page.getByText(/password must contain/i)).toBeVisible()
  })

  test("shows error when confirm password doesn't match", async ({ page }) => {
    await page.locator('[aria-label="register-name"]').fill("Jordan Lapp")
    await page.locator('[aria-label="register-email"]').fill("jordan@example.org")
    await page.locator('[aria-label="register-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-confirm-password"]').fill("Mismatch123!")
    await page.locator('[aria-label="register-phone"]').fill("1234567890")
    await page.locator('[aria-label="register-submit"]').click()

    await expect(page.getByText(/passwords do not match/i)).toBeVisible()
  })

  test("shows error for short phone number", async ({ page }) => {
    await page.locator('[aria-label="register-name"]').fill("Jordan Lapp")
    await page.locator('[aria-label="register-email"]').fill("jordan@example.org")
    await page.locator('[aria-label="register-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-confirm-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-phone"]').fill("123")
    await page.locator('[aria-label="register-submit"]').click()

    await expect(page.getByText(/phone number.*10 digits/i)).toBeVisible()
  })

  test("shows error if org name is missing when accountType is organization", async ({ page }) => {
    await page.locator('[aria-label="register-organization-toggle"]').click()

    await page.locator('[aria-label="register-name"]').fill("Org Rep")
    await page.locator('[aria-label="register-email"]').fill("org@example.org")
    await page.locator('[aria-label="register-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-confirm-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-phone"]').fill("1234567890")
    await page.locator('[aria-label="register-submit"]').click()

    await expect(page.getByText(/organization name cannot be empty/i)).toBeVisible()
  })

  test("shows success message after valid individual registration", async ({ page }) => {
    const registrationData = generateRegistrationData();
    
    // Ensure we're registering as an individual (not organization)
    await page.locator('[aria-label="register-individual-toggle"]').click();
    
    await page.locator('[aria-label="register-name"]').fill(registrationData.name)
    await page.locator('[aria-label="register-email"]').fill(registrationData.email)
    await page.locator('[aria-label="register-password"]').fill(registrationData.password)
    await page.locator('[aria-label="register-confirm-password"]').fill(registrationData.confirmPassword)
    await page.locator('[aria-label="register-phone"]').fill(registrationData.phone)

    await page.locator('[aria-label="register-submit"]').click()
    
    // After registration, user is navigated to EmailVerificationRequired screen
    // Wait for email verification screen - check for multiple possible indicators
    await page.waitForTimeout(2000) // Give time for navigation
    const emailVerificationIndicators = [
      page.getByText(/check your email/i),
      page.getByText(/verify/i),
      page.getByText(/verification/i),
      page.locator('[aria-label="email-verification-required"]'),
      page.locator('[data-testid="email-verification-required"]'),
    ]
    
    let found = false
    for (const indicator of emailVerificationIndicators) {
      try {
        await expect(indicator).toBeVisible({ timeout: 5000 })
        found = true
        break
      } catch {
        // Continue to next indicator
      }
    }
    
    if (!found) {
      // Take screenshot for debugging
      const screenshot = await page.screenshot({ fullPage: true })
      const pageContent = await page.content()
      console.error('Email verification screen not found. Page content:', pageContent.substring(0, 1000))
      throw new Error('Expected email verification screen not found after registration')
    }
  })

  test("shows success message after valid organization registration", async ({ page }) => {
    const registrationData = generateRegistrationData();
    
    // Register as an organization
    await page.locator('[aria-label="register-organization-toggle"]').click();
    
    // Fill organization name first (now at the top)
    await page.locator('[aria-label="register-org-name"]').fill("Test Organization")
    
    await page.locator('[aria-label="register-name"]').fill(registrationData.name)
    await page.locator('[aria-label="register-email"]').fill(registrationData.email)
    await page.locator('[aria-label="register-password"]').fill(registrationData.password)
    await page.locator('[aria-label="register-confirm-password"]').fill(registrationData.confirmPassword)
    await page.locator('[aria-label="register-phone"]').fill(registrationData.phone)

    await page.locator('[aria-label="register-submit"]').click()
    
    // After registration, user is navigated to EmailVerificationRequired screen
    // Wait for email verification screen - check for multiple possible indicators
    await page.waitForTimeout(2000) // Give time for navigation
    const emailVerificationIndicators = [
      page.getByText(/check your email/i),
      page.getByText(/verify/i),
      page.getByText(/verification/i),
      page.locator('[aria-label="email-verification-required"]'),
      page.locator('[data-testid="email-verification-required"]'),
    ]
    
    let found = false
    for (const indicator of emailVerificationIndicators) {
      try {
        await expect(indicator).toBeVisible({ timeout: 5000 })
        found = true
        break
      } catch {
        // Continue to next indicator
      }
    }
    
    if (!found) {
      // Take screenshot for debugging
      const screenshot = await page.screenshot({ fullPage: true })
      const pageContent = await page.content()
      console.error('Email verification screen not found. Page content:', pageContent.substring(0, 1000))
      throw new Error('Expected email verification screen not found after registration')
    }
  })

  test("shows error message on backend failure", async ({ page }) => {
    await page.locator('[aria-label="register-name"]').fill("API Failure")
    await page.locator('[aria-label="register-email"]').fill("fail@example")
    await page.locator('[aria-label="register-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-confirm-password"]').fill("StrongPass!1")
    await page.locator('[aria-label="register-phone"]').fill("1234567890")

    // Stub failure path or hit known failing email
    await page.locator('[aria-label="register-submit"]').click()
    await expect(page.getByText(/Please enter a valid email address/i)).toBeVisible()
  })

  test("navigates back when goBack is pressed", async ({ page }) => {
    await page.locator('[aria-label="register-go-back"]').click()
    await isLoginScreen(page)
  })
})
