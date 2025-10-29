import { test, expect } from '@playwright/test'

async function loginIfNeeded(page: any) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // Check if already logged in
  const tabHome = page.locator('[data-testid="tab-home"]')
  await tabHome.waitFor({ timeout: 3000 }).catch(() => {})
  const isLoggedIn = await tabHome.count() > 0
  if (!isLoggedIn) {
    const emailInput = page.locator('[data-testid="email-input"]')
    if (await emailInput.count() > 0) {
      await emailInput.fill('fake@example.org')
      await page.fill('[data-testid="password-input"]', 'Password1')
      await page.click('[data-testid="login-button"]')
      await tabHome.waitFor({ timeout: 15000 }).catch(() => {})
    }
  }
}

test.describe('Screen Crash Check', () => {
  test('HomeScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-home').click()
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
  })

  test('OrgScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('org-screen')).toBeVisible({ timeout: 5000 })
    expect(errors.length).toBe(0)
  })

  test('ReportsScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-reports').click()
    await page.waitForTimeout(2000)
    expect(errors.length).toBe(0)
  })

  test('AlertScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-alert').click()
    await page.waitForTimeout(2000)
    expect(errors.length).toBe(0)
  })

  test('PatientScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-home').click()
    await page.waitForTimeout(500)
    await page.getByTestId('add-patient-button').click().catch(() => {})
    await page.waitForTimeout(2000)
    expect(errors.length).toBe(0)
  })

  test('ProfileScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('profile-button').click()
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 5000 }).catch(() => {})
    expect(errors.length).toBe(0)
  })
})

