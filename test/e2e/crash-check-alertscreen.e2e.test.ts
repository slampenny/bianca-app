import { test, expect } from '@playwright/test'

test('AlertScreen should load without crashing', async ({ page }) => {
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
    // Wait for tabs to appear
    await page.waitForSelector('[data-testid="tab-alert"], [aria-label="Alerts tab"]', { timeout: 15000 }).catch(() => {})
  }
  
  // Navigate to alert tab using accessibility label (React Native Web)
  const alertTab = page.locator('[aria-label="Alerts tab"], [data-testid="tab-alert"]').first()
  await alertTab.waitFor({ timeout: 5000 })
  await alertTab.click()
  
  // Verify we're on the AlertScreen
  await page.waitForSelector('[data-testid="alert-screen"], [aria-label="alert-screen"]', { timeout: 5000 })
  await page.waitForTimeout(1000)
  
  // Verify the screen is actually visible
  const alertScreen = page.locator('[data-testid="alert-screen"], [aria-label="alert-screen"]').first()
  await expect(alertScreen).toBeVisible({ timeout: 5000 })
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ AlertScreen loaded without crashes')
})
