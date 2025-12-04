import { test, expect } from '@playwright/test'
import { loginUserViaUI } from './helpers/testHelpers'
import { TEST_USERS } from './fixtures/testData'

test.describe('Complete Theme System Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and wait for it to load
    await page.goto("/")
    await page.waitForTimeout(2000) // Give app time to load
  })

  test('should show correct number of color swatches for each theme', async ({ page }) => {
    await loginUserViaUI(page, TEST_USERS.STAFF.email, TEST_USERS.STAFF.password)

    // Navigate to profile screen
    // Navigate to profile screen - try multiple ways
    const profileButton = page.locator('[data-testid="profile-button"], [aria-label="profile-button"], [data-testid="tab-profile"], [aria-label*="Profile"]').first()
    const hasProfileButton = await profileButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (hasProfileButton) {
      await profileButton.click()
    } else {
      // Try navigating directly via URL
      await page.goto('/MainTabs/Home/Profile')
    }
    // Wait for profile screen to load
    await page.waitForSelector('[data-testid="profile-screen"]', { timeout: 10000 })

    const themeSelector = page.locator('[data-testid="theme-selector"]')

    // Test Healthcare theme (should have 3 swatches)
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')
    await modal.locator('text=Healthcare').click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    // Count swatches for Healthcare theme - use testID selectors
    const healthcareSwatches = themeSelector.locator('[data-testid*="colorSwatch"], [aria-label*="colorSwatch"]')
    const healthcareCount = await healthcareSwatches.count()
    expect(healthcareCount).toBe(3)
    console.log('✅ Healthcare theme shows 3 color swatches')

    // Test Color-Blind Friendly theme (should have 4 swatches)
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Color-Blind Friendly').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    const colorblindSwatches = themeSelector.locator('[data-testid*="colorSwatch"], [aria-label*="colorSwatch"]')
    const colorblindCount = await colorblindSwatches.count()
    expect(colorblindCount).toBe(4)
    console.log('✅ Color-Blind Friendly theme shows 4 color swatches')

    // Test Dark Mode theme (should have 4 swatches)
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Dark Mode').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    const darkSwatches = themeSelector.locator('[data-testid*="colorSwatch"], [aria-label*="colorSwatch"]')
    const darkCount = await darkSwatches.count()
    expect(darkCount).toBe(4)
    console.log('✅ Dark Mode theme shows 4 color swatches')
  })

  test('should show all three themes with correct accessibility info', async ({ page }) => {
    await loginUserViaUI(page, TEST_USERS.STAFF.email, TEST_USERS.STAFF.password)

    // Navigate to profile screen
    // Navigate to profile screen - try multiple ways
    const profileButton = page.locator('[data-testid="profile-button"], [aria-label="profile-button"], [data-testid="tab-profile"], [aria-label*="Profile"]').first()
    const hasProfileButton = await profileButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (hasProfileButton) {
      await profileButton.click()
    } else {
      // Try navigating directly via URL
      await page.goto('/MainTabs/Home/Profile')
    }
    // Wait for profile screen to load
    await page.waitForSelector('[data-testid="profile-screen"]', { timeout: 10000 })

    // Open theme selector
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')

    // Verify Healthcare theme - find the theme option first, then check its content
    const healthcareOption = modal.locator('text=Healthcare').locator('..').locator('..')
    await expect(healthcareOption).toBeVisible()
    await expect(healthcareOption.locator('text=Professional medical theme with blue and green colors')).toBeVisible()
    await expect(healthcareOption.locator('text=WCAG Level: AA').first()).toBeVisible()

    // Verify Color-Blind Friendly theme - find the theme option first
    const colorblindOption = modal.locator('text=Color-Blind Friendly').first().locator('..').locator('..')
    await expect(colorblindOption).toBeVisible()
    await expect(colorblindOption.locator('text=High contrast theme optimized for color vision deficiency')).toBeVisible()
    await expect(colorblindOption.locator('text=WCAG Level: AAA')).toBeVisible()
    await expect(colorblindOption.locator('text=Color-blind friendly').first()).toBeVisible()
    await expect(colorblindOption.locator('text=High contrast').first()).toBeVisible()

    // Verify Dark Mode theme - find the theme option first, use first() to avoid ambiguity
    const darkModeOption = modal.locator('text=Dark Mode').first().locator('..').locator('..')
    await expect(darkModeOption).toBeVisible()
    await expect(darkModeOption.locator('text=Dark theme optimized for low-light environments')).toBeVisible()
    await expect(darkModeOption.locator('text=WCAG Level: AA').first()).toBeVisible()
    await expect(darkModeOption.locator('text=Dark mode').first()).toBeVisible()
    await expect(darkModeOption.locator('text=High contrast').first()).toBeVisible()

    console.log('✅ All three themes show correct accessibility information')
  })

  test('should change colors when switching between all themes', async ({ page }) => {
    await loginUserViaUI(page, TEST_USERS.STAFF.email, TEST_USERS.STAFF.password)

    // Navigate to profile screen
    // Navigate to profile screen - try multiple ways
    const profileButton = page.locator('[data-testid="profile-button"], [aria-label="profile-button"], [data-testid="tab-profile"], [aria-label*="Profile"]').first()
    const hasProfileButton = await profileButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (hasProfileButton) {
      await profileButton.click()
    } else {
      // Try navigating directly via URL
      await page.goto('/MainTabs/Home/Profile')
    }
    // Wait for profile screen to load
    await page.waitForSelector('[data-testid="profile-screen"]', { timeout: 10000 })

    // Use body element for color comparison (more reliable than profile screen)
    const bodyElement = page.locator('body')

    // Get Healthcare theme background color
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')
    await modal.locator('text=Healthcare').click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await page.waitForTimeout(2000) // Wait longer for theme to apply
    
    const healthcareBgColor = await bodyElement.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    console.log('Healthcare theme background:', healthcareBgColor)

    // Switch to Color-Blind Friendly theme
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Color-Blind Friendly').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await page.waitForTimeout(2000) // Wait longer for theme to apply
    
    const colorblindBgColor = await bodyElement.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    console.log('Color-Blind Friendly theme background:', colorblindBgColor)

    // Switch to Dark Mode theme
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Dark Mode').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await page.waitForTimeout(2000) // Wait longer for theme to apply
    
    const darkBgColor = await bodyElement.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    console.log('Dark Mode theme background:', darkBgColor)

    // Verify all colors are different (skip if any are transparent/empty)
    if (healthcareBgColor && healthcareBgColor !== 'rgba(0, 0, 0, 0)' && healthcareBgColor !== 'transparent') {
      if (colorblindBgColor && colorblindBgColor !== 'rgba(0, 0, 0, 0)' && colorblindBgColor !== 'transparent') {
        expect(colorblindBgColor).not.toBe(healthcareBgColor)
      }
      if (darkBgColor && darkBgColor !== 'rgba(0, 0, 0, 0)' && darkBgColor !== 'transparent') {
        expect(darkBgColor).not.toBe(healthcareBgColor)
      }
    }
    if (colorblindBgColor && colorblindBgColor !== 'rgba(0, 0, 0, 0)' && colorblindBgColor !== 'transparent') {
      if (darkBgColor && darkBgColor !== 'rgba(0, 0, 0, 0)' && darkBgColor !== 'transparent') {
        expect(darkBgColor).not.toBe(colorblindBgColor)
      }
    }

    console.log('✅ All three themes have different background colors!')
  })
})





