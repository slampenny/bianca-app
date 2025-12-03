import { test, expect } from '@playwright/test'
import { loginUserViaUI } from './helpers/testHelpers'

test('ProfileScreen should load without crashing', async ({ page }) => {
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
  
  // Navigate to profile via profile button - it might be hidden, so use force click
  const profileButton = page.locator('[data-testid="profile-button"]').first()
  // Wait for it to exist (even if hidden)
  await profileButton.waitFor({ timeout: 10000 })
  // Try to scroll it into view first
  await profileButton.scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(500)
  // Try normal click first, then force if needed
  try {
    await profileButton.click({ timeout: 3000 })
  } catch {
    // If normal click fails, try force click (button might be hidden in a menu)
    await profileButton.click({ force: true, timeout: 3000 })
  }
  
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
