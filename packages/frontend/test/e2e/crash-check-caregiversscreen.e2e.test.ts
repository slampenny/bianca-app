import { test, expect } from '@playwright/test'

test('CaregiversScreen should load without crashing', async ({ page }) => {
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
    await page.waitForSelector('[aria-label="Organization tab"], [data-testid="tab-org"]', { timeout: 15000 }).catch(() => {})
  }
  
  // Navigate to org tab using accessibility label
  const orgTab = page.locator('[aria-label="Organization tab"], [data-testid="tab-org"]').first()
  await orgTab.waitFor({ timeout: 5000 })
  await orgTab.click()
  
  // Wait for org screen to load
  await page.waitForTimeout(1000)
  
  // Click view caregivers button
  const viewCaregiversButton = page.locator('[data-testid="view-caregivers-button"]').first()
  await viewCaregiversButton.waitFor({ timeout: 5000 })
  await viewCaregiversButton.click()
  
  // Wait for navigation
  await page.waitForTimeout(2000)
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ CaregiversScreen loaded without crashes')
})
