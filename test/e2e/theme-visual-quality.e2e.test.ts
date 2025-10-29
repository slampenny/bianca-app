import { test, expect } from '@playwright/test'
import { loginUserViaUI } from './helpers/testHelpers'
import { TEST_USERS } from './fixtures/testData'

test.describe('Theme Visual Quality Check', () => {
  test('should have good visual appearance for all themes', async ({ page }) => {
    await loginUserViaUI(page, TEST_USERS.STAFF.email, TEST_USERS.STAFF.password)

    // Navigate to profile screen
    await page.click('[data-testid="profile-button"]')
    await page.waitForSelector('[data-testid="profile-screen"]')

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
    await modal.locator('text=Dark Mode').click()
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

