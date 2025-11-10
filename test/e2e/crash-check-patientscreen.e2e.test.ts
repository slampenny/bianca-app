import { test, expect } from '@playwright/test'

test('PatientScreen should load without crashing', async ({ page }) => {
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
    await page.waitForSelector('[aria-label="Home tab"], [data-testid="tab-home"]', { timeout: 15000 }).catch(() => {})
  }
  
  // Navigate to home tab
  const homeTab = page.locator('[aria-label="Home tab"], [data-testid="tab-home"]').first()
  await homeTab.waitFor({ timeout: 5000 })
  await homeTab.click()
  
  // Wait for home screen to load
  await page.waitForTimeout(1000)
  
  // Click add patient button to navigate to PatientScreen
  const addPatientButton = page.locator('[data-testid="add-patient-button"]').first()
  await addPatientButton.waitFor({ timeout: 5000 })
  // Wait for button to be enabled (it might be disabled initially)
  let attempts = 0
  while (attempts < 10) {
    const isEnabled = await addPatientButton.isEnabled().catch(() => false)
    if (isEnabled) {
      break
    }
    await page.waitForTimeout(500)
    attempts++
  }
  // Only click if enabled, otherwise just check for no crashes
  const isEnabled = await addPatientButton.isEnabled().catch(() => false)
  if (isEnabled) {
    await addPatientButton.click({ timeout: 5000 })
  } else {
    // Button is disabled - this might be expected for some users, just verify no crashes
    console.log('Add patient button is disabled - skipping navigation but checking for crashes')
  }
  
  // Verify we're on the PatientScreen
  await page.waitForSelector('[data-testid="patient-screen"], [aria-label="patient-screen"]', { timeout: 10000 })
  await page.waitForTimeout(1000)
  
  // Verify the screen is actually visible
  const patientScreen = page.locator('[data-testid="patient-screen"], [aria-label="patient-screen"]').first()
  await expect(patientScreen).toBeVisible({ timeout: 5000 })
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ PatientScreen loaded without crashes')
})
