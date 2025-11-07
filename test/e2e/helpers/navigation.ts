import { Page, expect } from "@playwright/test"
import { loginUserViaUI } from "./testHelpers"
import { TEST_USERS } from "../fixtures/testData"

export async function navigateToRegister(page: Page) {
  await page.goto("/")
  // Wait for login screen to load - use aria-label for React Native Web
  await page.waitForSelector('[aria-label="email-input"]', { timeout: 30000 })
  await page.waitForTimeout(1000) // Small delay to ensure form is ready
  
  // Click register button - use aria-label
  const registerButton = page.locator('[aria-label="register-link"], [aria-label="register-button"]')
  await registerButton.waitFor({ state: 'visible', timeout: 15000 })
  await registerButton.click()
  
  // Wait for register screen - use aria-label
  await page.waitForSelector('[aria-label="register-name"]', { timeout: 15000 })
}

export async function navigateToHome(page: Page, user?: { email: string; password: string }) {
  await page.goto("/")
  const testUser = user || TEST_USERS.WITHOUT_PATIENTS;
  await loginUserViaUI(page, testUser.email, testUser.password);
  await isHomeScreen(page)
}

export async function isLoginScreen(page: Page) {
  await expect(page.locator('[aria-label="login-button"]')).toBeVisible()
}

export async function isHomeScreen(page: Page) {
  console.log("Checking if on Home Screen...")

  // Wait for the home screen to load by looking for the "Add Patient" button
  await expect(page.getByText("Add Patient", { exact: true })).toBeVisible({ timeout: 10000 })

  console.log("Confirmed on Home Screen.")
}

export async function isPatientScreen(page: Page) {
  console.log("Checking if on Patient Screen...")
  // Look for either CREATE PATIENT or UPDATE PATIENT button which is specific to the patient screen
  try {
    await expect(page.getByText("CREATE PATIENT")).toBeVisible({ timeout: 5000 })
    console.log("Confirmed on Patient Screen (Create mode).")
  } catch {
    await expect(page.getByText("UPDATE PATIENT")).toBeVisible({ timeout: 5000 })
    console.log("Confirmed on Patient Screen (Update mode).")
  }
}

export async function isNotAuthorizedScreen(page: Page) {
  console.log("Checking if on Not Authorized Screen...")
  await expect(page.getByText("Not Authorized", { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText("You don't have permission to view caregivers")).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Not Authorized Screen.")
}

export async function isCaregiversScreen(page: Page) {
  console.log("Checking if on Caregivers Screen...")
  // Look for either the caregivers list or the not authorized message
  try {
    await expect(page.getByText("Add Caregiver", { exact: true })).toBeVisible({ timeout: 5000 })
    console.log("Confirmed on Caregivers Screen (authorized).")
  } catch {
    await isNotAuthorizedScreen(page)
    console.log("Confirmed on Caregivers Screen (not authorized).")
  }
}

export async function navigateToSchedules(page: Page) {
  console.log("Navigating to Schedules...")
  // Schedule navigation button should ALWAYS be available - if not, that's a BUG
  // Use accessibilityLabel for React Native Web
  const scheduleNav = page.locator('[data-testid="schedule-nav-button"], [aria-label="schedule-nav-button"]')
  const navCount = await scheduleNav.count()
  if (navCount === 0) {
    throw new Error('BUG: Schedule navigation button not found - schedule functionality should always be available!')
  }
  
  await scheduleNav.first().click()
  await page.waitForTimeout(2000)
  
  // Verify we're on the schedule screen
  const scheduleScreen = page.locator('[data-testid="schedules-screen"], [aria-label="schedules-screen"]')
  await expect(scheduleScreen).toBeVisible({ timeout: 10000 })
  console.log("Successfully navigated to Schedules")
}

export async function isSchedulesScreen(page: Page) {
  console.log("Checking if on Schedules Screen...")
  // Use accessibilityLabel for React Native Web
  await expect(page.locator('[data-testid="schedules-screen"], [aria-label="schedules-screen"]')).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Schedules Screen.")
}