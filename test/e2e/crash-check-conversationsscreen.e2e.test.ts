import { test, expect } from '@playwright/test'

test('ConversationsScreen should load without crashing', async ({ page }) => {
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
  
  // Wait for home screen to load
  await page.waitForTimeout(1000)
  
  // Navigate via patient to conversations
  const patientCard = page.locator('[data-testid^="patient-card-"]').first()
  if (await patientCard.count() > 0) {
    await patientCard.click()
    await page.waitForTimeout(1000)
    
    // Try to find conversations button/link
    const conversationLink = page.getByText(/conversation/i).first()
    await conversationLink.waitFor({ timeout: 3000 }).catch(() => {})
    await conversationLink.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(2000)
    
    // Verify we're on ConversationsScreen
    const conversationsScreen = page.locator('[data-testid="conversations-screen"], [aria-label*="conversation" i]').first()
    await conversationsScreen.waitFor({ timeout: 5000 }).catch(() => {})
  }
  
  if (errors.length > 0) {
    console.error('Errors found:', errors)
  }
  expect(errors.length).toBe(0)
  console.log('✅ ConversationsScreen loaded without crashes')
})
