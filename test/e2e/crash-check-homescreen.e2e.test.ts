import { test, expect } from '@playwright/test'

test('HomeScreen should load without crashing', async ({ page }) => {
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
  
  // Navigate to home tab using accessibility label
  const homeTab = page.locator('[aria-label="Home tab"], [data-testid="tab-home"]').first()
  await homeTab.waitFor({ timeout: 5000 })
  await homeTab.click()
  
  // Verify we're on the HomeScreen
  await page.waitForSelector('[aria-label="home-screen"], [data-testid="home-screen"]', { timeout: 5000 })
  await page.waitForTimeout(1000)
  
  // Verify the screen is actually visible
  const homeScreen = page.locator('[aria-label="home-screen"], [data-testid="home-screen"]').first()
  await expect(homeScreen).toBeVisible({ timeout: 5000 })
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ HomeScreen loaded without crashes')
})
