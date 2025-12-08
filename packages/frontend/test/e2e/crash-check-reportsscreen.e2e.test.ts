import { test, expect } from '@playwright/test'

test('ReportsScreen should load without crashing', async ({ page }) => {
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
    await page.waitForSelector('[data-testid="tab-reports"], [aria-label="Reports tab"]', { timeout: 15000 }).catch(() => {})
  }
  
  // Navigate to reports tab using accessibility label (React Native Web)
  const reportsTab = page.locator('[aria-label="Reports tab"], [data-testid="tab-reports"]').first()
  await reportsTab.waitFor({ timeout: 5000 })
  await reportsTab.click()
  
  // Verify we're on the ReportsScreen
  await page.waitForSelector('[data-testid="reports-screen"], [aria-label="reports-screen"]', { timeout: 5000 })
  await page.waitForTimeout(1000)
  
  // Verify the screen is actually visible
  const reportsScreen = page.locator('[data-testid="reports-screen"], [aria-label="reports-screen"]').first()
  await expect(reportsScreen).toBeVisible({ timeout: 5000 })
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ ReportsScreen loaded without crashes')
})
