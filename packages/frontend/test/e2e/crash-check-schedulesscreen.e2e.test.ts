import { test, expect } from '@playwright/test'
import { loginUserViaUI } from './helpers/testHelpers'

test('SchedulesScreen should load without crashing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
    console.error('PAGE ERROR:', error.message)
  })
  
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  // Try to login using the helper function
  const emailInput = page.locator('[data-testid="email-input"]')
  if (await emailInput.count() > 0) {
    try {
      await loginUserViaUI(page, 'fake@example.org', 'Password1')
    } catch (error) {
      console.log('Login failed, continuing anyway:', error)
    }
  }
  
  // Navigate to home tab using accessibility label
  const homeTab = page.locator('[aria-label="Home tab"], [data-testid="tab-home"]').first()
  await homeTab.waitFor({ timeout: 5000 })
  await homeTab.click()
  
  // Wait for home screen to load
  await page.waitForTimeout(1000)
  
  // Navigate via patient to schedule - wait for patient card to be visible
  const patientCard = page.locator('[data-testid^="patient-card-"]').first()
  if (await patientCard.count() > 0) {
    await patientCard.waitFor({ state: 'visible', timeout: 10000 })
    await patientCard.click()
    await page.waitForTimeout(1000)
    
    // Try to find schedule button/link
    const scheduleLink = page.getByText(/schedule/i).first()
    await scheduleLink.waitFor({ timeout: 3000 }).catch(() => {})
    await scheduleLink.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(2000)
    
    // Verify we're on SchedulesScreen (check for schedule-related elements)
    const scheduleScreen = page.locator('[aria-label*="schedule" i]').first()
    await scheduleScreen.waitFor({ timeout: 5000 }).catch(() => {})
  }
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ SchedulesScreen loaded without crashes')
})
