import { test, expect } from "@playwright/test"
import { navigateToHome, isHomeScreen, isCaregiversScreen, isNotAuthorizedScreen } from "./helpers/navigation"

test.describe("Unassigned Patients Assignment", () => {
  test("should show not authorized message for non-admin users on caregivers screen", async ({ page }) => {
    // Login as a non-admin user (staff role)
    await page.goto("/")
    await page.getByTestId("email-input").fill("fake@example.org")
    await page.getByTestId("password-input").fill("password1")
    await page.getByTestId("login-button").click()
    
    // Should navigate to home screen
    await isHomeScreen(page)
    
    // Navigate to Org tab (second tab in the tab bar)
    await page.locator('nav[role="tablist"] a').nth(1).click()
    
    // Click on "View Caregivers" button
    await page.getByText("View Caregivers").click()
    
    // Should show not authorized message
    await isNotAuthorizedScreen(page)
  })

  test("should allow admin users to access caregivers screen", async ({ page }) => {
    // Login as an admin user
    await page.goto("/")
    await page.getByTestId("email-input").fill("admin@example.org")
    await page.getByTestId("password-input").fill("password1")
    await page.getByTestId("login-button").click()
    
    // Should navigate to home screen
    await isHomeScreen(page)
    
    // Navigate to Org tab (second tab in the tab bar)
    await page.locator('nav[role="tablist"] a').nth(1).click()
    
    // Click on "View Caregivers" button
    await page.getByText("View Caregivers").click()
    
    // Should show caregivers screen (authorized)
    await isCaregiversScreen(page)
  })

  test("should always navigate to home screen after login", async ({ page }) => {
    // Login
    await page.goto("/")
    await page.getByTestId("email-input").fill("admin@example.org")
    await page.getByTestId("password-input").fill("password1")
    await page.getByTestId("login-button").click()
    
    // Should always navigate to home screen, not any other screen
    await isHomeScreen(page)
    
    // Verify we're on the home screen by checking for home-specific elements
    await expect(page.getByText("Add Patient")).toBeVisible()
  })
}) 