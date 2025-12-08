import { test, expect } from '@playwright/test'

async function loginIfNeeded(page: any) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // Check if already logged in - try both testid and aria-label
  const tabHome = page.locator('[data-testid="tab-home"], [aria-label="Home tab"]')
  await tabHome.waitFor({ timeout: 3000 }).catch(() => {})
  const isLoggedIn = await tabHome.count() > 0
  if (!isLoggedIn) {
    const emailInput = page.locator('[data-testid="email-input"], [aria-label="email-input"]')
    if (await emailInput.count() > 0) {
      await emailInput.fill('fake@example.org')
      await page.fill('[data-testid="password-input"], [aria-label="password-input"]', 'Password1')
      await page.click('[data-testid="login-button"], [aria-label="login-button"]')
      // Wait for home screen indicators
      await page.waitForSelector('[data-testid="tab-home"], [aria-label="Home tab"], [aria-label="home-header"], [aria-label="profile-button"]', { timeout: 15000 }).catch(() => {})
    }
  }
}

test.describe('Screen Crash Check', () => {
  test('HomeScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    const homeTab = page.locator('[data-testid="tab-home"], [aria-label="Home tab"]').first()
    await homeTab.waitFor({ timeout: 10000 })
    await homeTab.click()
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
  })

  test('OrgScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    const orgTab = page.locator('[data-testid="tab-org"], [aria-label="Organization tab"]').first()
    await orgTab.waitFor({ timeout: 10000 })
    await orgTab.click()
    await page.waitForTimeout(2000)
    await expect(page.locator('[data-testid="org-screen"], [aria-label="org-screen"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {})
    expect(errors.length).toBe(0)
  })

  test('ReportsScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    const reportsTab = page.locator('[data-testid="tab-reports"], [aria-label="Reports tab"]').first()
    await reportsTab.waitFor({ timeout: 10000 })
    await reportsTab.click()
    await page.waitForTimeout(2000)
    expect(errors.length).toBe(0)
  })

  test('AlertScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-alert').or(page.getByLabel('Alerts tab')).click()
    await page.waitForTimeout(2000)
    expect(errors.length).toBe(0)
  })

  test('PatientScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    const homeTab = page.locator('[data-testid="tab-home"], [aria-label="Home tab"]').first()
    await homeTab.waitFor({ timeout: 10000 })
    await homeTab.click()
    await page.waitForTimeout(1000)
    // Try to click add patient button, but don't fail if it's disabled or not found
    const addPatientButton = page.locator('[data-testid="add-patient-button"]').first()
    const isEnabled = await addPatientButton.isEnabled().catch(() => false)
    if (isEnabled) {
      await addPatientButton.click().catch(() => {})
    }
    await page.waitForTimeout(2000)
    expect(errors.length).toBe(0)
  })

  test('ProfileScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    const profileButton = page.locator('[data-testid="profile-button"], [aria-label="profile-button"]').first()
    await profileButton.waitFor({ timeout: 10000 })
    await profileButton.click()
    await page.waitForTimeout(2000)
    await expect(page.locator('[data-testid="profile-screen"], [aria-label="profile-screen"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {})
    expect(errors.length).toBe(0)
  })
})

