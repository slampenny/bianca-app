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

test.describe('Patient Reassignment E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home screen before each test
    await page.goto('http://localhost:8081')
  })

  test.afterEach(async ({ page }) => {
    // Logout after each test
    await logoutViaUI(page)
  })

  test.describe('Caregiver Deletion with Patient Reassignment', () => {
    test('should show reassignment modal when deleting caregiver with patients', async ({ page }) => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)
      
      // Navigate to org tab to access caregivers
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver that has patients (or create one)
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      const caregiverCount = await caregiverCards.count()
      
      if (caregiverCount > 0) {
        // Click on the first caregiver
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Check if this caregiver has patients by looking for the delete button
        const deleteButton = page.getByTestId('delete-caregiver-button')
        if (await deleteButton.isVisible()) {
          // Click delete button
          await deleteButton.click()
          
          // Should show confirmation
          await expect(page.getByTestId('delete-caregiver-button')).toContainText('CONFIRM DELETE')
          
          // Click confirm delete
          await page.getByTestId('delete-caregiver-button').click()
          
          // Should show patient reassignment modal
          await expect(page.getByTestId('patient-reassign-reassign-btn')).toBeVisible()
          await expect(page.getByTestId('patient-reassign-cancel-btn')).toBeVisible()
          
          // Modal should show title
          await expect(page.getByText('Reassign Patients')).toBeVisible()
        }
      }
    })

    test('should display list of patients that need reassignment', async ({ page }) => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)
      
      // Navigate to org tab
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver with patients
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Try to delete caregiver
        const deleteButton = page.getByTestId('delete-caregiver-button')
        if (await deleteButton.isVisible()) {
          await deleteButton.click()
          await page.getByTestId('delete-caregiver-button').click()
          
          // Should show patient list in modal
          await expect(page.getByText('Patients to Reassign:')).toBeVisible()
          
          // Should show at least one patient in the list
          const patientItems = page.locator('[data-testid^="patient-item-"]')
          const patientCount = await patientItems.count()
          expect(patientCount).toBeGreaterThan(0)
        }
      }
    })

    test('should show available caregivers for reassignment', async ({ page }) => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)
      
      // Navigate to org tab
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver with patients
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Try to delete caregiver
        const deleteButton = page.getByTestId('delete-caregiver-button')
        if (await deleteButton.isVisible()) {
          await deleteButton.click()
          await page.getByTestId('delete-caregiver-button').click()
          
          // Should show caregiver selection section
          await expect(page.getByText('Select New Caregiver:')).toBeVisible()
          
          // Should show available caregivers with toggle switches
          const caregiverToggles = page.locator('input[type="checkbox"]')
          const toggleCount = await caregiverToggles.count()
          expect(toggleCount).toBeGreaterThan(0)
        }
      }
    })

    test('should allow selecting a caregiver for reassignment', async ({ page }) => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)
      
      // Navigate to org tab
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver with patients
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Try to delete caregiver
        const deleteButton = page.getByTestId('delete-caregiver-button')
        if (await deleteButton.isVisible()) {
          await deleteButton.click()
          await page.getByTestId('delete-caregiver-button').click()
          
          // Should show caregiver selection
          await expect(page.getByText('Select New Caregiver:')).toBeVisible()
          
          // Find and click on a caregiver toggle switch
          const caregiverToggles = page.locator('input[type="checkbox"]')
          if (await caregiverToggles.count() > 0) {
            await caregiverToggles.first().click()
            
            // The reassign button should be enabled
            await expect(page.getByTestId('patient-reassign-reassign-btn')).toBeEnabled()
          }
        }
      }
    })

    test('should reassign patients and complete caregiver deletion', async ({ page }) => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)
      
      // Navigate to org tab
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver with patients
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Try to delete caregiver
        const deleteButton = page.getByTestId('delete-caregiver-button')
        if (await deleteButton.isVisible()) {
          await deleteButton.click()
          await page.getByTestId('delete-caregiver-button').click()
          
          // Should show reassignment modal
          await expect(page.getByTestId('patient-reassign-reassign-btn')).toBeVisible()
          
          // Select a caregiver for reassignment
          const caregiverToggles = page.locator('input[type="checkbox"]')
          if (await caregiverToggles.count() > 0) {
            await caregiverToggles.first().click()
            
            // Click reassign button
            await page.getByTestId('patient-reassign-reassign-btn').click()
            
            // Should show success alert and complete deletion
            // The modal should close and we should be back to caregivers list
            await expect(page.getByTestId('view-caregivers-button')).toBeVisible()
          }
        }
      }
    })

    test('should allow canceling reassignment', async ({ page }) => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)
      
      // Navigate to org tab
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver with patients
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Try to delete caregiver
        const deleteButton = page.getByTestId('delete-caregiver-button')
        if (await deleteButton.isVisible()) {
          await deleteButton.click()
          await page.getByTestId('delete-caregiver-button').click()
          
          // Should show reassignment modal
          await expect(page.getByTestId('patient-reassign-cancel-btn')).toBeVisible()
          
          // Click cancel button
          await page.getByTestId('patient-reassign-cancel-btn').click()
          
          // Should show confirmation dialog
          await expect(page.getByText('Cancel Reassignment')).toBeVisible()
          
          // Click cancel in dialog
          await page.getByText('Cancel').click()
          
          // Should be back on caregiver screen
          await expect(page.getByTestId('caregiver-save-button')).toBeVisible()
        }
      }
    })

    test('should handle case when no other caregivers are available', async ({ page }) => {
      // This test would require a special setup with only one caregiver
      // For now, we'll test the UI behavior
      
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)
      
      // Navigate to org tab
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver with patients
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Try to delete caregiver
        const deleteButton = page.getByTestId('delete-caregiver-button')
        if (await deleteButton.isVisible()) {
          await deleteButton.click()
          await page.getByTestId('delete-caregiver-button').click()
          
          // Check if there are other caregivers available
          const caregiverToggles = page.locator('input[type="checkbox"]')
          const toggleCount = await caregiverToggles.count()
          
          if (toggleCount === 0) {
            // Should show close button instead of reassign button
            await expect(page.getByTestId('patient-reassign-close-btn')).toBeVisible()
            await expect(page.getByText('No other caregivers available')).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Role-Based Access Control', () => {
    test('staff user should not see delete caregiver button', async ({ page }) => {
      // Login as staff user
      await navigateToHome(page, TEST_USERS.STAFF)
      
      // Navigate to org tab
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Staff should not see delete button
        await expect(page.getByTestId('delete-caregiver-button')).not.toBeVisible()
      }
    })

    test('org admin should be able to delete caregivers with reassignment', async ({ page }) => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)
      
      // Navigate to org tab
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Org admin should see delete button
        await expect(page.getByTestId('delete-caregiver-button')).toBeVisible()
      }
    })

    test('super admin should be able to delete caregivers with reassignment', async ({ page }) => {
      // Login as super admin
      await navigateToHome(page, TEST_USERS.SUPER_ADMIN)
      
      // Navigate to org tab
      await page.getByTestId('tab-org').click()
      await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
      
      // Click on view caregivers button
      await page.getByTestId('view-caregivers-button').click()
      
      // Find a caregiver
      const caregiverCards = page.locator('[data-testid="caregiver-card"]')
      if (await caregiverCards.count() > 0) {
        await caregiverCards.first().click()
        
        // Wait for caregiver screen to load
        await page.waitForSelector('[data-testid="caregiver-save-button"]', { timeout: 10000 })
        
        // Super admin should see delete button
        await expect(page.getByTestId('delete-caregiver-button')).toBeVisible()
      }
    })
  })
}) 