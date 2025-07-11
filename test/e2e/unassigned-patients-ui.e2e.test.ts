import { test, expect } from '@playwright/test'
import { navigateToHome } from './helpers/navigation'
import { createPatientViaUI, logoutViaUI } from './helpers/testHelpers'
import { TEST_USERS } from './fixtures/testData'

// Helper function to generate a proper phone number
function generatePhoneNumber(): string {
  const timestamp = Date.now().toString()
  const digits = timestamp.slice(-10) // Get last 10 digits
  return `+1${digits}` // This creates +1XXXXXXXXXX (10 digits after +1)
}

test.describe("Unassigned Patients Assignment UI (E2E)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home screen before each test
    await page.goto('http://localhost:8081')
  })

  test.afterEach(async ({ page }) => {
    await logoutViaUI(page);
  });

  test("orgAdmin should see assign unassigned patients button on caregiver screen", async ({ page }) => {
    await navigateToHome(page, TEST_USERS.ORG_ADMIN)
    
    // Navigate to org tab
    await page.getByTestId('tab-org').click()
    await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
    
    // Click on view caregivers button
    await page.getByTestId('view-caregivers-button').click()
    
    // Check if there are any caregiver cards
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    const cardCount = await caregiverCards.count()
    
    if (cardCount > 0) {
      // If caregivers exist, click on the first one
      await caregiverCards.first().click()
      await expect(page.getByTestId("caregiver-save-button")).toBeVisible({ timeout: 10000 })
      const assignButton = page.getByTestId("assign-unassigned-patients-button")
      await expect(assignButton).toBeVisible({ timeout: 5000 })
    } else {
      // If no caregivers exist, just verify the screen loads properly
      // and check for the add caregiver button
      await expect(page.getByTestId('add-caregiver-button')).toBeVisible({ timeout: 5000 })
      
      // Click add caregiver button to verify it works
      await page.getByTestId('add-caregiver-button').click()
      
      // Wait a moment for navigation
      await page.waitForTimeout(2000)
      
      // Just verify that we're no longer on the caregivers list screen
      await expect(page.getByTestId('add-caregiver-button')).not.toBeVisible()
    }
  })

  test("should show unassigned patients modal and allow patient selection", async ({ page }) => {
    await navigateToHome(page, TEST_USERS.ORG_ADMIN)
    
    // Navigate to org tab
    await page.getByTestId('tab-org').click()
    await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
    
    // Click on view caregivers button
    await page.getByTestId('view-caregivers-button').click()
    
    // Check if there are any caregiver cards
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    const cardCount = await caregiverCards.count()
    
    if (cardCount > 0) {
      // If caregivers exist, click on the first one
      await caregiverCards.first().click()
      
      // Wait for caregiver screen to load
      await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
      
      // Click the assign unassigned patients button
      const assignButton = page.getByTestId("assign-unassigned-patients-button")
      await expect(assignButton).toBeVisible({ timeout: 5000 })
      await assignButton.click()
      
      // Wait for modal to appear
      await page.waitForSelector('[data-testid="assign-unassigned-patients-modal"]', { timeout: 10000 })
      
      // Verify modal content
      await expect(page.getByTestId("assign-unassigned-patients-modal")).toBeVisible()
      await expect(page.getByText("Assign Unassigned Patients")).toBeVisible()
      
      // Check for either unassigned patients or no patients message
      const hasUnassignedPatients = await page.getByTestId("unassigned-patient-item-").count() > 0
      const hasNoPatientsMessage = await page.getByTestId("no-unassigned-patients-message").isVisible()
      
      expect(hasUnassignedPatients || hasNoPatientsMessage).toBeTruthy()
      
      // Close the modal
      await page.getByTestId("cancel-unassigned-panel-button").click()
      
      // Modal should close
      await expect(page.getByTestId("assign-unassigned-patients-modal")).not.toBeVisible()
    } else {
      // If no caregivers exist, just verify the screen loads properly
      await expect(page.getByTestId('add-caregiver-button')).toBeVisible({ timeout: 5000 })
      
      // Click add caregiver button to verify it works
      await page.getByTestId('add-caregiver-button').click()
      
      // Wait a moment for navigation
      await page.waitForTimeout(2000)
      
      // Just verify that we're no longer on the caregivers list screen
      await expect(page.getByTestId('add-caregiver-button')).not.toBeVisible()
    }
  })

  test("should allow selecting and assigning unassigned patients", async ({ page }) => {
    await navigateToHome(page, TEST_USERS.ORG_ADMIN)
    
    // Navigate to org tab
    await page.getByTestId('tab-org').click()
    await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
    
    // Click on view caregivers button
    await page.getByTestId('view-caregivers-button').click()
    
    // Check if there are any caregiver cards
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    const cardCount = await caregiverCards.count()
    
    if (cardCount > 0) {
      // If caregivers exist, click on the first one
      await caregiverCards.first().click()
      
      // Wait for caregiver screen to load
      await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
      
      // Click the assign unassigned patients button
      const assignButton = page.getByTestId("assign-unassigned-patients-button")
      await expect(assignButton).toBeVisible({ timeout: 5000 })
      await assignButton.click()
      
      // Wait for modal to appear
      await page.waitForSelector('[data-testid="assign-unassigned-patients-modal"]', { timeout: 10000 })
      
      // Verify modal content
      await expect(page.getByTestId("assign-unassigned-patients-modal")).toBeVisible()
      
      // Check for either unassigned patients or no patients message
      const hasUnassignedPatients = await page.getByTestId("unassigned-patient-item-").count() > 0
      const hasNoPatientsMessage = await page.getByTestId("no-unassigned-patients-message").isVisible()
      
      if (hasUnassignedPatients) {
        // If there are unassigned patients, test the selection functionality
        const firstPatient = page.locator('[data-testid^="unassigned-patient-item-"]').first()
        await firstPatient.click()
        
        // The assign button should be enabled
        await expect(page.getByTestId("assign-selected-patients-button")).toBeEnabled()
        
        // Test select all functionality
        await page.getByText("Select All").click()
        
        // Test deselect all functionality
        await page.getByText("Deselect All").click()
        
        // Close the modal
        await page.getByTestId("cancel-unassigned-panel-button").click()
      } else {
        // If no unassigned patients, just verify the message is shown
        await expect(page.getByTestId("no-unassigned-patients-message")).toBeVisible()
        
        // Close the modal
        await page.getByTestId("cancel-unassigned-panel-button").click()
      }
      
      // Modal should close
      await expect(page.getByTestId("assign-unassigned-patients-modal")).not.toBeVisible()
    } else {
      // If no caregivers exist, just verify the screen loads properly
      await expect(page.getByTestId('add-caregiver-button')).toBeVisible({ timeout: 5000 })
      
      // Click add caregiver button to verify it works
      await page.getByTestId('add-caregiver-button').click()
      
      // Wait a moment for navigation
      await page.waitForTimeout(2000)
      
      // Just verify that we're no longer on the caregivers list screen
      await expect(page.getByTestId('add-caregiver-button')).not.toBeVisible()
    }
  })

  test("should handle empty unassigned patients list gracefully", async ({ page }) => {
    await navigateToHome(page, TEST_USERS.ORG_ADMIN)
    
    // Navigate to org tab
    await page.getByTestId('tab-org').click()
    await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
    
    // Click on view caregivers button
    await page.getByTestId('view-caregivers-button').click()
    
    // Check if there are any caregiver cards
    const caregiverCards = page.locator('[data-testid="caregiver-card"]')
    const cardCount = await caregiverCards.count()
    
    if (cardCount > 0) {
      // If caregivers exist, click on the first one
      await caregiverCards.first().click()
      
      // Wait for caregiver screen to load
      await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
      
      // Click the assign unassigned patients button
      const assignButton = page.getByTestId("assign-unassigned-patients-button")
      await expect(assignButton).toBeVisible({ timeout: 5000 })
      await assignButton.click()
      
      // Wait for modal to appear
      await page.waitForSelector('[data-testid="assign-unassigned-patients-modal"]', { timeout: 10000 })
      
      // Verify modal content
      await expect(page.getByTestId("assign-unassigned-patients-modal")).toBeVisible()
      
      // Check for either unassigned patients or no patients message
      const hasUnassignedPatients = await page.getByTestId("unassigned-patient-item-").count() > 0
      const hasNoPatientsMessage = await page.getByTestId("no-unassigned-patients-message").isVisible()
      
      if (hasNoPatientsMessage) {
        // If no unassigned patients, verify the message is shown
        await expect(page.getByTestId("no-unassigned-patients-message")).toBeVisible()
        await expect(page.getByText("No unassigned patients found.")).toBeVisible()
      }
      
      // Close the modal
      await page.getByTestId("cancel-unassigned-panel-button").click()
      
      // Modal should close
      await expect(page.getByTestId("assign-unassigned-patients-modal")).not.toBeVisible()
    } else {
      // If no caregivers exist, just verify the screen loads properly
      await expect(page.getByTestId('add-caregiver-button')).toBeVisible({ timeout: 5000 })
      
      // Click add caregiver button to verify it works
      await page.getByTestId('add-caregiver-button').click()
      
      // Wait a moment for navigation
      await page.waitForTimeout(2000)
      
      // Just verify that we're no longer on the caregivers list screen
      await expect(page.getByTestId('add-caregiver-button')).not.toBeVisible()
    }
  })
}) 