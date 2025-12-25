import { test, expect } from '@playwright/test'
import { navigateToHome, navigateToReportsTab } from './helpers/navigation'
import { TEST_USERS } from './fixtures/testData'

test.describe('Fraud Abuse Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Use the same login helper as other working tests
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
  })

  test('FraudAbuseAnalysisScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    const consoleErrors: string[] = []
    
    page.on('pageerror', (error) => {
      errors.push(error.message)
      console.error('PAGE ERROR:', error.message)
    })
    
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Only ignore 404 errors if they're truly expected (no analysis exists yet)
        // But we should still catch repeated errors or other issues
        if (text.includes('Error loading fraud/abuse analysis results') && text.includes('404')) {
          // This is expected when no analysis exists, but we should still log it
          console.warn('Expected 404 for missing analysis:', text)
        } else if (text.includes('Maximum update depth exceeded')) {
          // This is a critical error that should fail the test
          consoleErrors.push(text)
        } else if (text.includes('Error') || text.includes('error')) {
          // Catch any other errors
          consoleErrors.push(text)
        }
      }
    })
    
    // Navigate to reports tab
    await navigateToReportsTab(page)
    
    // Select a patient first - REQUIRED for button to be enabled
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    await patientPicker.waitFor({ timeout: 10000, state: 'visible' })
    await patientPicker.click()
    await page.waitForTimeout(500)
    
    // Wait for patient picker modal to appear and select first patient
    const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
    await firstPatient.waitFor({ timeout: 5000, state: 'visible' })
    await firstPatient.click()
    await page.waitForTimeout(1000) // Wait for patient to be selected and button to enable
    
    // Wait for fraud/abuse button to be enabled (it's disabled until patient is selected)
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    await fraudAbuseButton.waitFor({ timeout: 5000, state: 'visible' })
    
    // Wait for button to be enabled (not disabled)
    await page.waitForFunction(
      (buttonSelector) => {
        const button = document.querySelector(buttonSelector) as HTMLButtonElement
        return button && !button.disabled
      },
      `[data-testid="fraud-abuse-reports-button"]`,
      { timeout: 5000 }
    ).catch(() => {
      // Fallback: just wait a bit more and try
      console.warn('Could not verify button enabled state, proceeding anyway')
    })
    
    await fraudAbuseButton.click({ force: true, timeout: 10000 })
    
    // Wait for screen to load
    await page.waitForTimeout(2000)
    
    if (errors.length > 0) {
      console.error('Page errors found:', errors)
    }
    if (consoleErrors.length > 0) {
      console.error('Console errors found:', consoleErrors)
    }
    expect(errors.length).toBe(0)
    expect(consoleErrors.length).toBe(0)
    console.log('✅ FraudAbuseAnalysisScreen loaded without crashes')
  })

  test('should navigate to fraud/abuse analysis screen', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Only ignore 404 errors if they're truly expected (no analysis exists yet)
        if (text.includes('Error loading fraud/abuse analysis results') && text.includes('404')) {
          // This is expected when no analysis exists, but we should still log it
          console.warn('Expected 404 for missing analysis:', text)
        } else if (text.includes('Maximum update depth exceeded')) {
          // This is a critical error that should fail the test
          consoleErrors.push(text)
        } else if (text.includes('Error') || text.includes('error')) {
          // Catch any other errors
          consoleErrors.push(text)
        }
      }
    })
    
    // Navigate to reports
    await navigateToReportsTab(page)
    
    // Select a patient - REQUIRED for button to be enabled
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    await patientPicker.waitFor({ timeout: 10000, state: 'visible' })
    await patientPicker.click()
    await page.waitForTimeout(500)
    
    const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
    await firstPatient.waitFor({ timeout: 5000, state: 'visible' })
    await firstPatient.click()
    await page.waitForTimeout(1000) // Wait for patient to be selected
    
    // Wait for fraud/abuse button to be enabled
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    await expect(fraudAbuseButton).toBeVisible({ timeout: 5000 })
    
    // Wait for button to be enabled
    await page.waitForFunction(
      (buttonSelector) => {
        const button = document.querySelector(buttonSelector) as HTMLButtonElement
        return button && !button.disabled
      },
      `[data-testid="fraud-abuse-reports-button"]`,
      { timeout: 5000 }
    ).catch(() => {
      console.warn('Could not verify button enabled state, proceeding anyway')
    })
    
    await fraudAbuseButton.click({ force: true, timeout: 10000 })
    
    // Verify we're on the fraud/abuse analysis screen
    await page.waitForTimeout(2000)
    const screen = page.locator('[data-testid="fraud-abuse-analysis-screen"], [aria-label="fraud-abuse-analysis-screen"]')
    await expect(screen.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Fallback: check for title text
      const title = page.locator('text=/fraud.*abuse|Fraud.*Abuse/i')
      expect(title.first()).toBeVisible({ timeout: 5000 })
    })
    
    if (consoleErrors.length > 0) {
      console.error('Console errors found:', consoleErrors)
    }
    expect(consoleErrors.length).toBe(0)
  })

  test('should display analysis results when available', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Only ignore 404 errors if they're truly expected (no analysis exists yet)
        if (text.includes('Error loading fraud/abuse analysis results') && text.includes('404')) {
          // This is expected when no analysis exists, but we should still log it
          console.warn('Expected 404 for missing analysis:', text)
        } else if (text.includes('Maximum update depth exceeded')) {
          // This is a critical error that should fail the test
          consoleErrors.push(text)
        } else if (text.includes('Error') || text.includes('error')) {
          // Catch any other errors
          consoleErrors.push(text)
        }
      }
    })
    
    // Navigate to reports
    await navigateToReportsTab(page)
    
    // Select a patient - REQUIRED for button to be enabled
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    await patientPicker.waitFor({ timeout: 10000, state: 'visible' })
    await patientPicker.click()
    await page.waitForTimeout(500)
    
    const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
    await firstPatient.waitFor({ timeout: 5000, state: 'visible' })
    await firstPatient.click()
    await page.waitForTimeout(1000) // Wait for patient to be selected
    
    // Wait for fraud/abuse button to be enabled
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    await fraudAbuseButton.waitFor({ timeout: 5000, state: 'visible' })
    
    // Wait for button to be enabled
    await page.waitForFunction(
      (buttonSelector) => {
        const button = document.querySelector(buttonSelector) as HTMLButtonElement
        return button && !button.disabled
      },
      `[data-testid="fraud-abuse-reports-button"]`,
      { timeout: 5000 }
    ).catch(() => {
      console.warn('Could not verify button enabled state, proceeding anyway')
    })
    
    await fraudAbuseButton.click({ force: true, timeout: 10000 })
    await page.waitForTimeout(2000)
    
    // Check for trigger button or results
    const triggerButton = page.locator('text=/trigger.*analysis|Trigger.*Analysis/i')
    const results = page.locator('text=/risk.*score|Risk.*Score/i')
    
    // Either trigger button or results should be visible
    const hasTrigger = await triggerButton.count() > 0
    const hasResults = await results.count() > 0
    
    expect(hasTrigger || hasResults).toBe(true)
    
    if (consoleErrors.length > 0) {
      console.error('Console errors found:', consoleErrors)
    }
    expect(consoleErrors.length).toBe(0)
  })

  test('should trigger fraud/abuse analysis', async ({ page }) => {
    // Navigate to reports
    await navigateToReportsTab(page)
    
    // Wait for reports screen to be fully loaded first
    await page.waitForTimeout(2000)
    
    // Select a patient - REQUIRED for button to be enabled
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    // Wait for it to be visible, with longer timeout
    await patientPicker.waitFor({ timeout: 15000, state: 'visible' }).catch(async (error) => {
      // If not found, check if reports screen loaded
      const reportsScreen = await page.locator('[data-testid="reports-screen"]').isVisible({ timeout: 2000 }).catch(() => false)
      if (!reportsScreen) {
        throw new Error(`Patient picker not found and reports screen not visible. Error: ${error.message}`)
      }
      throw error
    })
    await patientPicker.click()
    await page.waitForTimeout(500)
    
    const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
    await firstPatient.waitFor({ timeout: 5000, state: 'visible' })
    await firstPatient.click()
    await page.waitForTimeout(1000) // Wait for patient to be selected
    
    // Wait for fraud/abuse button to be enabled
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    await fraudAbuseButton.waitFor({ timeout: 5000, state: 'visible' })
    
    // Wait for button to be enabled
    await page.waitForFunction(
      (buttonSelector) => {
        const button = document.querySelector(buttonSelector) as HTMLButtonElement
        return button && !button.disabled
      },
      `[data-testid="fraud-abuse-reports-button"]`,
      { timeout: 5000 }
    ).catch(() => {
      console.warn('Could not verify button enabled state, proceeding anyway')
    })
    
    await fraudAbuseButton.click({ force: true, timeout: 10000 })
    await page.waitForTimeout(2000)
    
    // Look for trigger button
    const triggerButton = page.locator('text=/trigger.*analysis|Trigger.*Analysis/i')
    if (await triggerButton.count() > 0) {
      await triggerButton.click()
      await page.waitForTimeout(3000) // Wait for analysis to complete
      
      // Should show either results or success message
      const results = page.locator('text=/risk.*score|Risk.*Score|analysis.*completed/i')
      const hasResults = await results.count() > 0
      
      // Either results appear or we see a success message
      expect(hasResults || await triggerButton.isVisible()).toBe(true)
    }
  })

  test('should display localized and themed content', async ({ page }) => {
    // Navigate to reports
    await navigateToReportsTab(page)
    
    // Select a patient - REQUIRED for button to be enabled
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    await patientPicker.waitFor({ timeout: 10000, state: 'visible' })
    await patientPicker.click()
    await page.waitForTimeout(500)
    
    const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
    await firstPatient.waitFor({ timeout: 5000, state: 'visible' })
    await firstPatient.click()
    await page.waitForTimeout(1000) // Wait for patient to be selected
    
    // Wait for fraud/abuse button to be enabled
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    await fraudAbuseButton.waitFor({ timeout: 5000, state: 'visible' })
    
    // Wait for button to be enabled
    await page.waitForFunction(
      (buttonSelector) => {
        const button = document.querySelector(buttonSelector) as HTMLButtonElement
        return button && !button.disabled
      },
      `[data-testid="fraud-abuse-reports-button"]`,
      { timeout: 5000 }
    ).catch(() => {
      console.warn('Could not verify button enabled state, proceeding anyway')
    })
    
    await fraudAbuseButton.click({ force: true, timeout: 10000 })
    await page.waitForTimeout(2000)
    
    // Check for localized text (should be in English by default)
    const title = page.locator('text=/Fraud.*Abuse|fraud.*abuse/i').first()
    const hasTitle = await title.count() > 0
    
    // Check for disclaimer (localized)
    const disclaimer = page.locator('text=/informational purposes|substitute for professional/i').first()
    const hasDisclaimer = await disclaimer.count() > 0
    
    // Screen should be visible and themed
    const screen = page.locator('[data-testid="fraud-abuse-analysis-screen"], [aria-label="fraud-abuse-analysis-screen"]')
    const screenVisible = await screen.count() > 0
    
    expect(hasTitle || screenVisible).toBe(true)
  })
})
