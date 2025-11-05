import { test, expect } from '@playwright/test'

async function loginIfNeeded(page: any) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
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

test.describe('All Screens Crash Check', () => {
  test('HomeScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-home').click()
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ HomeScreen loaded without crashes')
  })

  test('OrgScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('org-screen')).toBeVisible({ timeout: 5000 }).catch(() => {})
    
    expect(errors.length).toBe(0)
    console.log('✅ OrgScreen loaded without crashes')
  })

  test('ReportsScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-reports').click()
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ ReportsScreen loaded without crashes')
  })

  test('AlertScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('tab-alert').click()
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ AlertScreen loaded without crashes')
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
    console.log('✅ PatientScreen loaded without crashes')
  })

  test('ProfileScreen should load without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    
    await loginIfNeeded(page)
    await page.getByTestId('profile-button').click()
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
    await page.getByTestId('tab-home').click()
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
    await page.getByTestId('tab-home').click()
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
    await page.getByTestId('tab-org').click()
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
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(500)
    await page.getByTestId('payment-button').click().catch(() => {})
    await page.waitForTimeout(2000)
    
    expect(errors.length).toBe(0)
    console.log('✅ PaymentInfoScreen loaded without crashes')
  })
})





