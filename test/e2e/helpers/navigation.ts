import { Page, expect } from "@playwright/test"
import { loginUserViaUI } from "./testHelpers"
import { TEST_USERS } from "../fixtures/testData"

export async function navigateToRegister(page: Page) {
  await page.goto("/")
  await page.getByTestId("register-button").click()
  await expect(page.getByTestId("register-name")).toBeVisible()
}

export async function navigateToHome(page: Page, user?: { email: string; password: string }) {
  await page.goto("/")
  const testUser = user || TEST_USERS.WITHOUT_PATIENTS;
  await loginUserViaUI(page, testUser.email, testUser.password);
  await isHomeScreen(page)
}

export async function isLoginScreen(page: Page) {
  await expect(page.getByTestId("login-button")).toBeVisible()
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
  // Try multiple methods to access schedules
  const methods = [
    // Method 1: Direct navigation button
    async () => {
      await page.getByTestId('schedule-nav-button').click()
      await page.waitForTimeout(2000)
    },
    // Method 2: Tab navigation
    async () => {
      await page.getByTestId('tab-schedules').click()
      await page.waitForTimeout(2000)
    },
    // Method 3: Text link
    async () => {
      await page.getByText(/schedule/i).first().click()
      await page.waitForTimeout(2000)
    }
  ]
  
  for (const method of methods) {
    try {
      await method()
      // Check if we're on a schedule screen
      if (await page.getByTestId('schedules-screen').count() > 0 || 
          await page.getByText(/schedule/i).count() > 0) {
        console.log("Successfully navigated to Schedules")
        return
      }
    } catch (error) {
      console.log("Navigation method failed, trying next...")
      continue
    }
  }
  
  throw new Error("Could not navigate to Schedules screen")
}

export async function isSchedulesScreen(page: Page) {
  console.log("Checking if on Schedules Screen...")
  try {
    await expect(page.getByTestId('schedules-screen')).toBeVisible({ timeout: 5000 })
    console.log("Confirmed on Schedules Screen.")
  } catch {
    // Fallback: check for schedule-related content
    const scheduleElements = await page.getByText(/schedule/i).count()
    if (scheduleElements > 0) {
      console.log("Confirmed on Schedules Screen (fallback).")
    } else {
      throw new Error("Not on Schedules Screen")
    }
  }
}