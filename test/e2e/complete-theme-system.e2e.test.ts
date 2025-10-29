import { test, expect } from '@playwright/test'
import { loginUserViaUI } from './helpers/testHelpers'
import { TEST_USERS } from './fixtures/testData'

test.describe('Complete Theme System Verification', () => {
  test('should show correct number of color swatches for each theme', async ({ page }) => {
    await loginUserViaUI(page, TEST_USERS.STAFF.email, TEST_USERS.STAFF.password)

    // Navigate to profile screen
    await page.click('[data-testid="profile-button"]')
    await page.waitForSelector('[data-testid="profile-screen"]')

    const themeSelector = page.locator('[data-testid="theme-selector"]')

    // Test Healthcare theme (should have 3 swatches)
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')
    await modal.locator('text=Healthcare').click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    // Count swatches for Healthcare theme
    const healthcareSwatches = themeSelector.locator('.colorSwatch')
    const healthcareCount = await healthcareSwatches.count()
    expect(healthcareCount).toBe(3)
    console.log('✅ Healthcare theme shows 3 color swatches')

    // Test Color-Blind Friendly theme (should have 4 swatches)
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Color-Blind Friendly').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    const colorblindSwatches = themeSelector.locator('.colorSwatch')
    const colorblindCount = await colorblindSwatches.count()
    expect(colorblindCount).toBe(4)
    console.log('✅ Color-Blind Friendly theme shows 4 color swatches')

    // Test Dark Mode theme (should have 4 swatches)
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Dark Mode').click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    const darkSwatches = themeSelector.locator('.colorSwatch')
    const darkCount = await darkSwatches.count()
    expect(darkCount).toBe(4)
    console.log('✅ Dark Mode theme shows 4 color swatches')
  })

  test('should show all three themes with correct accessibility info', async ({ page }) => {
    await loginUserViaUI(page, TEST_USERS.STAFF.email, TEST_USERS.STAFF.password)

    // Navigate to profile screen
    await page.click('[data-testid="profile-button"]')
    await page.waitForSelector('[data-testid="profile-screen"]')

    // Open theme selector
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')

    // Verify Healthcare theme
    await expect(modal.locator('text=Healthcare')).toBeVisible()
    await expect(modal.locator('text=Professional medical theme with blue and green colors')).toBeVisible()
    await expect(modal.locator('text=WCAG Level: AA')).toBeVisible()

    // Verify Color-Blind Friendly theme
    await expect(modal.locator('text=Color-Blind Friendly').first()).toBeVisible()
    await expect(modal.locator('text=High contrast theme optimized for color vision deficiency')).toBeVisible()
    await expect(modal.locator('text=WCAG Level: AAA')).toBeVisible()
    await expect(modal.locator('text=Color-blind friendly')).toBeVisible()
    await expect(modal.locator('text=High contrast')).toBeVisible()

    // Verify Dark Mode theme
    await expect(modal.locator('text=Dark Mode')).toBeVisible()
    await expect(modal.locator('text=Dark theme optimized for low-light environments')).toBeVisible()
    await expect(modal.locator('text=WCAG Level: AA')).toBeVisible()
    await expect(modal.locator('text=Dark mode')).toBeVisible()
    await expect(modal.locator('text=High contrast')).toBeVisible()

    console.log('✅ All three themes show correct accessibility information')
  })

  test('should change colors when switching between all themes', async ({ page }) => {
    await loginUserViaUI(page, TEST_USERS.STAFF.email, TEST_USERS.STAFF.password)

    // Navigate to profile screen
    await page.click('[data-testid="profile-button"]')
    await page.waitForSelector('[data-testid="profile-screen"]')

    const profileScreen = page.locator('[data-testid="profile-screen"]')
    const themeSelector = page.locator('[data-testid="theme-selector"]')

    // Get Healthcare theme background color
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')
    await modal.locator('text=Healthcare').click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await page.waitForTimeout(1000)
    
    const healthcareBgColor = await profileScreen.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    console.log('Healthcare theme background:', healthcareBgColor)

    // Switch to Color-Blind Friendly theme
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Color-Blind Friendly').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await page.waitForTimeout(1000)
    
    const colorblindBgColor = await profileScreen.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    console.log('Color-Blind Friendly theme background:', colorblindBgColor)

    // Switch to Dark Mode theme
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Dark Mode').click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await page.waitForTimeout(1000)
    
    const darkBgColor = await profileScreen.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    console.log('Dark Mode theme background:', darkBgColor)

    // Verify all colors are different
    expect(colorblindBgColor).not.toBe(healthcareBgColor)
    expect(darkBgColor).not.toBe(healthcareBgColor)
    expect(darkBgColor).not.toBe(colorblindBgColor)

    console.log('✅ All three themes have different background colors!')
  })
})

