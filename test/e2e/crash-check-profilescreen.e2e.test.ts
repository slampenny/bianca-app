import { test, expect } from '@playwright/test'

test('ProfileScreen should load without crashing', async ({ page }) => {
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
    await page.waitForSelector('[data-testid="profile-button"]', { timeout: 15000 }).catch(() => {})
  }
  
  // Navigate to profile via profile button
  const profileButton = page.locator('[data-testid="profile-button"]').first()
  await profileButton.waitFor({ timeout: 5000 })
  await profileButton.click()
  
  // Verify we're on the ProfileScreen
  await page.waitForSelector('[data-testid="profile-screen"], [aria-label="profile-screen"]', { timeout: 10000 })
  await page.waitForTimeout(1000)
  
  // Verify the screen is actually visible
  const profileScreen = page.locator('[data-testid="profile-screen"], [aria-label="profile-screen"]').first()
  await expect(profileScreen).toBeVisible({ timeout: 5000 })
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ ProfileScreen loaded without crashes')
})
