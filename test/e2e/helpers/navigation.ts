import { Page, expect } from "@playwright/test"

export async function navigateToRegister(page: Page) {
  await page.goto("/")
  await page.getByTestId("register-button").click()
  await expect(page.getByTestId("register-name")).toBeVisible()
}

export async function navigateToHome(page: Page) {
  await page.goto("/")
  await page.getByTestId("login-button").click()
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
  await expect(page.locator("text=Patient")).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Patient Screen.")
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