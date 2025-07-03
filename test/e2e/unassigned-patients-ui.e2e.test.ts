import { test, expect, Page } from "@playwright/test"
import { registerUserViaUI, loginUserViaUI } from "./helpers/testHelpers"

test.describe("Unassigned Patients Assignment UI (E2E)", () => {
  let testUserEmail: string
  let testUserPassword: string

  test.beforeEach(async ({ page }) => {
    // Use admin credentials
    testUserEmail = 'admin@example.org'
    testUserPassword = 'password123'
  })

  test("orgAdmin should see assign unassigned patients button on caregiver screen", async ({ page }) => {
    // Login with admin user
    const token = await loginUserViaUI(page, testUserEmail, testUserPassword)
    
    // Navigate to the app
    await page.goto("/")
    await page.waitForTimeout(2000)
    
    // Navigate to the Org section to access caregivers
    await page.click('text=Org')
    await page.waitForTimeout(1000)
    
    // Click "View Caregivers" button
    await page.click('text=View Caregivers')
    await page.waitForTimeout(1000)
    
    // Check if we can find caregiver cards
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    if (await caregiverCards.count() > 0) {
      // Click on the first caregiver card to go to the caregiver screen
      await caregiverCards.first().click()
      
      // Wait for the caregiver screen to load
      await expect(page.getByText("SAVE")).toBeVisible({ timeout: 10000 })
      
      // Check if the "Assign Unassigned Patients" button is visible (for orgAdmins)
      const assignButton = page.getByText("Assign Unassigned Patients")
      await expect(assignButton).toBeVisible({ timeout: 5000 })
    } else {
      // If no caregivers exist, try to add one first
      await page.click('text=Add Caregiver')
      await page.waitForTimeout(1000)
      
      // Fill in caregiver details
      await page.fill('input[placeholder="Name"]', 'Test Caregiver')
      await page.fill('input[placeholder="Email"]', 'test@example.com')
      await page.fill('input[placeholder="Phone"]', '1234567890')
      
      // Save the caregiver
      await page.click('text=SAVE')
      await page.waitForTimeout(2000)
      
      // Now navigate back to caregivers and try again
      await page.click('text=View Caregivers')
      await page.waitForTimeout(1000)
      
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        await expect(page.getByText("SAVE")).toBeVisible({ timeout: 10000 })
        
        const assignButton = page.getByText("Assign Unassigned Patients")
        await expect(assignButton).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test("should open unassigned patients modal when button is clicked", async ({ page }) => {
    // Login with admin user
    const token = await loginUserViaUI(page, testUserEmail, testUserPassword)
    
    // Navigate to the app
    await page.goto("/")
    await page.waitForTimeout(2000)
    
    // Navigate to the Org section to access caregivers
    await page.click('text=Org')
    await page.waitForTimeout(1000)
    
    // Click "View Caregivers" button
    await page.click('text=View Caregivers')
    await page.waitForTimeout(1000)
    
    // Find and click on a caregiver card
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    if (await caregiverCards.count() > 0) {
      await caregiverCards.first().click()
      
      // Wait for the caregiver screen to load
      await expect(page.getByText("SAVE")).toBeVisible({ timeout: 10000 })
      
      // Click the "Assign Unassigned Patients" button
      const assignButton = page.getByText("Assign Unassigned Patients")
      await assignButton.click()
      
      // Check if the modal opens
      await expect(page.getByText("Assign Unassigned Patients")).toBeVisible({ timeout: 5000 })
      
      // Check if the modal content is visible
      await expect(page.getByText("Loading unassigned patients...")).toBeVisible({ timeout: 5000 })
    }
  })

  test("should show no unassigned patients message when none exist", async ({ page }) => {
    // Login with admin user
    const token = await loginUserViaUI(page, testUserEmail, testUserPassword)
    
    // Navigate to the app
    await page.goto("/")
    await page.waitForTimeout(2000)
    
    // Navigate to the Org section to access caregivers
    await page.click('text=Org')
    await page.waitForTimeout(1000)
    
    // Click "View Caregivers" button
    await page.click('text=View Caregivers')
    await page.waitForTimeout(1000)
    
    // Find and click on a caregiver card
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    if (await caregiverCards.count() > 0) {
      await caregiverCards.first().click()
      
      // Wait for the caregiver screen to load
      await expect(page.getByText("SAVE")).toBeVisible({ timeout: 10000 })
      
      // Click the "Assign Unassigned Patients" button
      const assignButton = page.getByText("Assign Unassigned Patients")
      await assignButton.click()
      
      // Wait for the modal to load and check for "no unassigned patients" message
      await expect(page.getByText("No unassigned patients found.")).toBeVisible({ timeout: 10000 })
    }
  })
}) 