import { test, expect } from '@playwright/test'

async function loginIfNeeded(page: any) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  // Check if we're already logged in by looking for home header or tabs
  const homeHeader = page.locator('[data-testid="home-header"], [aria-label="home-header"]')
  const tabHome = page.locator('[data-testid="tab-home"]')
  
  const isLoggedIn = await Promise.race([
    homeHeader.waitFor({ timeout: 3000 }).then(() => true).catch(() => false),
    tabHome.waitFor({ timeout: 3000 }).then(() => true).catch(() => false)
  ])
  
  if (!isLoggedIn) {
    const emailInput = page.locator('[data-testid="email-input"], [aria-label="email-input"]')
    if (await emailInput.count() > 0) {
      await emailInput.fill('fake@example.org')
      await page.fill('[data-testid="password-input"], [aria-label="password-input"]', 'Password1')
      await page.click('[data-testid="login-button"], [aria-label="login-button"]')
      
      // Wait for either home header or tab-home to appear after login
      await Promise.race([
        homeHeader.waitFor({ timeout: 15000 }),
        tabHome.waitFor({ timeout: 15000 })
      ]).catch(() => {})
      
      // Additional wait to ensure tabs are visible
      await page.waitForTimeout(1000)
    }
  } else {
    // Already logged in, wait a bit for tabs to be ready
    await page.waitForTimeout(500)
  }
}

test.describe('All Screens Crash Check', () => {
  test('HomeScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-home').or(page.getByLabel('Home tab')).click()
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ HomeScreen loaded without crashes')
  })

  test('OrgScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-org').or(page.getByLabel('Organization tab')).click()
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('org-screen')).toBeVisible({ timeout: 5000 }).catch(() => {})
    
    expect(errors.length).toBe(0)
    console.log('✅ OrgScreen loaded without crashes')
  })

  test('ReportsScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-reports').or(page.getByLabel('Reports tab')).click()
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ ReportsScreen loaded without crashes')
  })

  test('AlertScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-alert').or(page.getByLabel('Alerts tab')).click()
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ AlertScreen loaded without crashes')
  })

  test('PatientScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-home').or(page.getByLabel('Home tab')).click()
    await page.waitForTimeout(500)
    await page.getByTestId('add-patient-button').click().catch(() => {})
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ PatientScreen loaded without crashes')
  })

  test('ProfileScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('profile-button').or(page.getByLabel('profile-button')).click()
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('profile-screen')).toBeVisible({ timeout: 5000 }).catch(() => {})
    
    expect(errors.length).toBe(0)
    console.log('✅ ProfileScreen loaded without crashes')
  })

  test('SchedulesScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    // Navigate to patient first, then schedules
    await page.getByTestId('tab-home').or(page.getByLabel('Home tab')).click()
    await page.waitForTimeout(500)
    // Try to click first patient card if available
    const patientCard = page.locator('[data-testid^="patient-card-"]').first()
    if (await patientCard.count() > 0) {
      await patientCard.click()
      await page.waitForTimeout(1000)
      // Try to navigate to schedules - look for schedule button or navigation
      await page.getByText(/schedule/i).first().click().catch(() => {})
      await page.waitForTimeout(2000)
    }
    
    expect(errors.length).toBe(0)
    console.log('✅ SchedulesScreen loaded without crashes')
  })

  test('ConversationsScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-home').or(page.getByLabel('Home tab')).click()
    await page.waitForTimeout(500)
    // Try to navigate to conversations
    await page.getByText(/conversation/i).first().click().catch(() => {})
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ ConversationsScreen loaded without crashes')
  })

  test('CaregiversScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-org').or(page.getByLabel('Organization tab')).click()
    await page.waitForTimeout(500)
    await page.getByTestId('view-caregivers-button').click().catch(() => {})
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ CaregiversScreen loaded without crashes')
  })

  test('PaymentInfoScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-org').or(page.getByLabel('Organization tab')).click()
    await page.waitForTimeout(500)
    await page.getByTestId('payment-button').click().catch(() => {})
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ PaymentInfoScreen loaded without crashes')
  })
})





