import { test, expect } from '@playwright/test'

test('OrgScreen should load without crashing', async ({ page }) => {
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
  
  // Verify we're on the OrgScreen
  await page.waitForSelector('[data-testid="org-screen"], [aria-label="org-screen"]', { timeout: 10000 })
  await page.waitForTimeout(1000)
  
  // Verify the screen is actually visible
  const orgScreen = page.locator('[data-testid="org-screen"], [aria-label="org-screen"]').first()
  await expect(orgScreen).toBeVisible({ timeout: 5000 })
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ OrgScreen loaded without crashes')
})
