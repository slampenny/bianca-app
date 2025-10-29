import { test, expect } from '@playwright/test'

test.describe('Theme Color Changes', () => {
  test('should change actual colors when switching themes', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    
    // Login
    await page.fill('[data-testid="email-input"]', 'fake@example.org')
    await page.fill('[data-testid="password-input"]', 'Password1')
    await page.click('[data-testid="login-button"]')
    
    // Wait for login to complete
    await page.waitForSelector('[data-testid="profile-button"]', { timeout: 15000 })
    
    // Navigate to profile screen
    await page.click('[data-testid="profile-button"]')
    
    // Wait for profile screen to load
    await page.waitForSelector('[data-testid="theme-selector"]', { timeout: 10000 })
    
    // Get initial colors (Healthcare theme)
    const themeSelector = page.locator('[data-testid="theme-selector"]')
    const initialPrimarySwatch = themeSelector.locator('[data-testid="colorSwatch-primary"]').first()
    const initialPrimaryColor = await initialPrimarySwatch.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    console.log('Initial Healthcare theme primary color:', initialPrimaryColor)
    
    // Switch to Color-Blind Friendly theme
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')
    await modal.locator('text=Color-Blind Friendly').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    // Wait a moment for theme to apply and re-find the selector
    await page.waitForTimeout(1000)
    await page.waitForSelector('[data-testid="theme-selector"]', { timeout: 5000 })
    
    // Get new colors (Color-Blind Friendly theme)
    const newThemeSelector = page.locator('[data-testid="theme-selector"]')
    const newPrimarySwatch = newThemeSelector.locator('[data-testid="colorSwatch-primary"]').first()
    const newPrimaryColor = await newPrimarySwatch.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    console.log('New Color-Blind Friendly theme primary color:', newPrimaryColor)
    
    // Verify colors actually changed
    expect(newPrimaryColor).not.toBe(initialPrimaryColor)
    
    // Verify the theme selector shows the new theme
    await expect(themeSelector).toContainText('Color-Blind Friendly')
    
    console.log('✅ Theme colors successfully changed!')
  })

  test('should persist theme selection across page reloads', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    
    // Login
    await page.fill('[data-testid="email-input"]', 'fake@example.org')
    await page.fill('[data-testid="password-input"]', 'Password1')
    await page.click('[data-testid="login-button"]')
    
    // Wait for login to complete
    await page.waitForSelector('[data-testid="profile-button"]', { timeout: 15000 })
    
    // Navigate to profile screen
    await page.click('[data-testid="profile-button"]')
    
    // Wait for profile screen to load
    await page.waitForSelector('[data-testid="theme-selector"]', { timeout: 10000 })
    
    // Switch to Color-Blind Friendly theme
    const themeSelector = page.locator('[data-testid="theme-selector"]')
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')
    await modal.locator('text=Color-Blind Friendly').first().click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    // Verify theme is selected
    await expect(themeSelector).toContainText('Color-Blind Friendly')
    
    // Reload the page
    await page.reload()
    
    // After reload, user needs to log in again
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 15000 })
    await page.fill('[data-testid="email-input"]', 'fake@example.org')
    await page.fill('[data-testid="password-input"]', 'Password1')
    await page.click('[data-testid="login-button"]')
    
    // Wait for login to complete and navigate back to profile
    await page.waitForSelector('[data-testid="profile-button"]', { timeout: 15000 })
    await page.click('[data-testid="profile-button"]')
    await page.waitForSelector('[data-testid="theme-selector"]', { timeout: 10000 })
    
    // Verify theme selection persisted
    const reloadedThemeSelector = page.locator('[data-testid="theme-selector"]')
    await expect(reloadedThemeSelector).toContainText('Color-Blind Friendly')
    
    console.log('✅ Theme selection persisted across page reload!')
  })
})

