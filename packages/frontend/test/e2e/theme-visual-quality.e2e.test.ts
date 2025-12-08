import { test, expect } from '@playwright/test'
import { loginUserViaUI } from './helpers/testHelpers'
import { TEST_USERS } from './fixtures/testData'

test.describe('Theme Visual Quality Check', () => {
  test('should have good visual appearance for all themes', async ({ page }) => {
    // Navigate to login page first
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Wait for login screen to be ready - use data-testid for TextField inputs (TextField needs input[data-testid="..."] pattern)
    const emailInput = page.locator('input[data-testid="email-input"]').first()
    await emailInput.waitFor({ state: 'visible', timeout: 30000 })
    
    await loginUserViaUI(page, TEST_USERS.STAFF.email, TEST_USERS.STAFF.password)

    // Wait for home screen to load
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 15000 })
    await page.waitForTimeout(2000)

    // Navigate to profile screen - try multiple ways
    const profileButton = page.locator('[data-testid="profile-button"], [aria-label="profile-button"], [data-testid="tab-profile"], [aria-label*="Profile"]').first()
    const hasProfileButton = await profileButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (hasProfileButton) {
      await profileButton.click()
    } else {
      // Try navigating directly via URL
      await page.goto('/MainTabs/Home/Profile')
    }
    
    await page.waitForSelector('[data-testid="profile-screen"]', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const themeSelector = page.locator('[data-testid="theme-selector"]')

    // Test Healthcare theme
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')
    await modal.locator('text=Healthcare').click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await page.waitForTimeout(1000)
    
    // Check that Healthcare theme has light background
    const healthcareBg = await page.evaluate(() => {
      const element = document.querySelector('[data-testid="profile-screen"]')
      return element ? window.getComputedStyle(element).backgroundColor : null
    })
    console.log('Healthcare theme background:', healthcareBg)
    expect(healthcareBg).not.toBe('rgb(0, 0, 0)') // Should not be pure black

    // Test Color-Blind Friendly theme
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Color-Blind Friendly').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await page.waitForTimeout(1000)
    
    const colorblindBg = await page.evaluate(() => {
      const element = document.querySelector('[data-testid="profile-screen"]')
      return element ? window.getComputedStyle(element).backgroundColor : null
    })
    console.log('Color-Blind Friendly theme background:', colorblindBg)
    expect(colorblindBg).not.toBe('rgb(0, 0, 0)') // Should not be pure black

    // Test Dark Mode theme
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    // Handle case where there might be multiple "Dark Mode" elements (capitalized and lowercase)
    await modal.locator('text=Dark Mode').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await page.waitForTimeout(1000)
    
    const darkBg = await page.evaluate(() => {
      const element = document.querySelector('[data-testid="profile-screen"]')
      return element ? window.getComputedStyle(element).backgroundColor : null
    })
    console.log('Dark Mode theme background:', darkBg)
    expect(darkBg).not.toBe('rgb(0, 0, 0)') // Should not be pure black
    expect(darkBg).not.toBe('rgb(255, 255, 255)') // Should not be pure white

    console.log('✅ All themes have appropriate background colors!')
    console.log('Healthcare:', healthcareBg)
    console.log('Color-Blind Friendly:', colorblindBg)
    console.log('Dark Mode:', darkBg)
  })
})





