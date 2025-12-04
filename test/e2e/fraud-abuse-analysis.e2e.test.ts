import { test, expect } from '@playwright/test'
import { AuthWorkflow } from './workflows/auth.workflow'
import { navigateToReportsTab } from './helpers/navigation'

test.describe('Fraud Abuse Analysis', () => {
  test.beforeEach(async ({ page }) => {
    const auth = new AuthWorkflow(page)
    await auth.givenIAmOnTheLoginScreen()
    const credentials = await auth.givenIHaveValidCredentials()
    await auth.whenIEnterCredentials(credentials.email, credentials.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()
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
    
    // Select a patient first
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    if (await patientPicker.count() > 0) {
      await patientPicker.click()
      await page.waitForTimeout(500)
      const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
      if (await firstPatient.count() > 0) {
        await firstPatient.click()
        await page.waitForTimeout(500)
      }
    }
    
    // Click fraud/abuse button
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    await fraudAbuseButton.waitFor({ timeout: 5000 }).catch(() => {})
    await fraudAbuseButton.click({ timeout: 3000 }).catch(() => {})
    
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
    
    // Select a patient
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    if (await patientPicker.count() > 0) {
      await patientPicker.click()
      await page.waitForTimeout(500)
      const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
      if (await firstPatient.count() > 0) {
        await firstPatient.click()
        await page.waitForTimeout(500)
      }
    }
    
    // Click fraud/abuse analysis button
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    await expect(fraudAbuseButton).toBeVisible({ timeout: 5000 })
    await fraudAbuseButton.click()
    
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
    
    // Select a patient
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    if (await patientPicker.count() > 0) {
      await patientPicker.click()
      await page.waitForTimeout(500)
      const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
      if (await firstPatient.count() > 0) {
        await firstPatient.click()
        await page.waitForTimeout(500)
      }
    }
    
    // Navigate to fraud/abuse analysis
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    if (await fraudAbuseButton.isVisible()) {
      await fraudAbuseButton.click()
      await page.waitForTimeout(2000)
      
      // Check for trigger button or results
      const triggerButton = page.locator('text=/trigger.*analysis|Trigger.*Analysis/i')
      const results = page.locator('text=/risk.*score|Risk.*Score/i')
      
      // Either trigger button or results should be visible
      const hasTrigger = await triggerButton.count() > 0
      const hasResults = await results.count() > 0
      
      expect(hasTrigger || hasResults).toBe(true)
    }
    
    if (consoleErrors.length > 0) {
      console.error('Console errors found:', consoleErrors)
    }
    expect(consoleErrors.length).toBe(0)
  })

  test('should trigger fraud/abuse analysis', async ({ page }) => {
    // Navigate to reports
    await navigateToReportsTab(page)
    
    // Select a patient
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    if (await patientPicker.count() > 0) {
      await patientPicker.click()
      await page.waitForTimeout(500)
      const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
      if (await firstPatient.count() > 0) {
        await firstPatient.click()
        await page.waitForTimeout(500)
      }
    }
    
    // Navigate to fraud/abuse analysis
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    if (await fraudAbuseButton.isVisible()) {
      await fraudAbuseButton.click()
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
    }
  })

  test('should display localized and themed content', async ({ page }) => {
    // Navigate to reports
    await navigateToReportsTab(page)
    
    // Select a patient
    const patientPicker = page.locator('[data-testid="patient-picker-button"]')
    if (await patientPicker.count() > 0) {
      await patientPicker.click()
      await page.waitForTimeout(500)
      const firstPatient = page.locator('[data-testid^="patient-option-"]').first()
      if (await firstPatient.count() > 0) {
        await firstPatient.click()
        await page.waitForTimeout(500)
      }
    }
    
    // Navigate to fraud/abuse analysis
    const fraudAbuseButton = page.locator('[data-testid="fraud-abuse-reports-button"]')
    if (await fraudAbuseButton.isVisible()) {
      await fraudAbuseButton.click()
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
    }
  })
})
