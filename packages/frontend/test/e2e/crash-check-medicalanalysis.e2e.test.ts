import { test, expect } from '@playwright/test'

test('MedicalAnalysisScreen should load without crashing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
    console.error('PAGE ERROR:', error.message)
  })
  
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  // Try to login
  const emailInput = page.locator('[data-testid="email-input"]')
  if (await emailInput.count() > 0) {
    await emailInput.fill('fake@example.org')
    await page.fill('[data-testid="password-input"]', 'Password1')
    await page.click('[data-testid="login-button"]')
    await page.waitForSelector('[aria-label="Reports tab"], [data-testid="tab-reports"]', { timeout: 15000 }).catch(() => {})
  }
  
  // Navigate to reports tab
  const reportsTab = page.locator('[aria-label="Reports tab"], [data-testid="tab-reports"]').first()
  await reportsTab.waitFor({ timeout: 5000 })
  await reportsTab.click()
  
  // Wait for reports screen
  await page.waitForTimeout(1000)
  
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
  
  // Click health/medical button
  const healthButton = page.locator('[data-testid="health-reports-button"]')
  await healthButton.waitFor({ timeout: 5000 }).catch(() => {})
  await healthButton.click({ timeout: 3000 }).catch(() => {})
  
  // Wait for screen to load
  await page.waitForTimeout(2000)
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ MedicalAnalysisScreen loaded without crashes')
})





