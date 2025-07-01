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
    console.log("Checking if on Home Screen...");
  
    // --- Most Reliable: Look for the "Add Patient" button text ---
    // Uses getByText for clarity, matching the exact text within the button.
    await expect(page.getByText("Add Patient", { exact: true })).toBeVisible({ timeout: 10000 }); // Added timeout for reliability
  
    // --- Alternative: Look for the static part of the header ---
    // This looks for any element containing the text "Welcome,". Less specific but might work.
    // await expect(page.locator('text=/Welcome,/i')).toBeVisible({ timeout: 10000 });
  
    // --- Alternative: Look for empty list text (only if applicable) ---
    // Use this if you are sure the screen *should* initially show "No patients found".
    // await expect(page.getByText("No patients found", { exact: true })).toBeVisible({ timeout: 10000 });
  
    console.log("Confirmed on Home Screen.");
  }

  export async function isPatientScreen(page: Page) {
    // Implement check for the Patient screen
    // Look for a unique title, element, or URL part
    console.log("Checking if on Patient Screen...");
    await expect(page.locator("text=Patient")).toBeVisible({ timeout: 10000 }); // Example check
    console.log("Confirmed on Patient Screen.");
  }