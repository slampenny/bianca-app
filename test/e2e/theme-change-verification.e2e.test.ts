import { test, expect } from '@playwright/test'

test.describe('Theme Selection and Verification', () => {
  test('should change theme and verify the change', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    
    // Login
    await page.fill('[data-testid="email-input"]', 'fake@example.org')
    await page.fill('[data-testid="password-input"]', 'Password1')
    await page.click('[data-testid="login-button"]')
    
    // Wait for login to complete - look for any element that indicates we're logged in
    await page.waitForSelector('[data-testid="profile-button"]', { timeout: 15000 })
    
    // Navigate to profile screen
    await page.click('[data-testid="profile-button"]')
    
    // Wait for profile screen to load
    await page.waitForSelector('[data-testid="theme-selector"]', { timeout: 10000 })
    
    // Verify theme selector is visible
    const themeSelector = page.locator('[data-testid="theme-selector"]')
    await expect(themeSelector).toBeVisible()
    
    // Check initial theme (should be Healthcare)
    await expect(themeSelector).toContainText('Healthcare')
    
    // Click to open theme selection modal
    await page.click('[data-testid="theme-selector"]')
    
    // Wait for modal to appear
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    
    // Verify both themes are available
    await expect(page.locator('text=Healthcare')).toBeVisible()
    await expect(page.locator('text=Color-Blind Friendly')).toBeVisible()
    
    // Select the Color-Blind Friendly theme
    await page.click('text=Color-Blind Friendly')
    
    // Wait for modal to close
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    // Verify the theme selector now shows the new theme
    await expect(themeSelector).toContainText('Color-Blind Friendly')
    
    // Verify the theme change was logged to console (since we're not implementing actual theme switching yet)
    // This is a placeholder - in a real implementation, you'd verify actual color changes
    console.log('Theme successfully changed to Color-Blind Friendly')
  })

  test('should show color swatches for theme preview', async ({ page }) => {
    // Navigate and login
    await page.goto('/')
    await page.fill('[data-testid="email-input"]', 'fake@example.org')
    await page.fill('[data-testid="password-input"]', 'Password1')
    await page.click('[data-testid="login-button"]')
    
    // Wait for login and navigate to profile
    await page.waitForSelector('[data-testid="profile-button"]', { timeout: 15000 })
    await page.click('[data-testid="profile-button"]')
    await page.waitForSelector('[data-testid="theme-selector"]', { timeout: 10000 })
    
    // Open theme selector
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    
    // Check that color swatches are visible in the modal
    // Look for the color swatch elements (they should have background colors)
    const colorSwatches = page.locator('.colorSwatch')
    await expect(colorSwatches).toHaveCount(6) // 3 for each theme (primary, success, error)
    
    // Verify swatches have different colors by checking their computed styles
    const swatchElements = await colorSwatches.all()
    const colors = []
    
    for (const swatch of swatchElements) {
      const backgroundColor = await swatch.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      )
      colors.push(backgroundColor)
    }
    
    // Should have different colors (not all the same)
    const uniqueColors = [...new Set(colors)]
    expect(uniqueColors.length).toBeGreaterThan(1)
    
    console.log('Color swatches verified:', uniqueColors)
  })

  test('should persist theme selection across modal interactions', async ({ page }) => {
    // Navigate and login
    await page.goto('/')
    await page.fill('[data-testid="email-input"]', 'fake@example.org')
    await page.fill('[data-testid="password-input"]', 'Password1')
    await page.click('[data-testid="login-button"]')
    
    // Wait for login and navigate to profile
    await page.waitForSelector('[data-testid="profile-button"]', { timeout: 15000 })
    await page.click('[data-testid="profile-button"]')
    await page.waitForSelector('[data-testid="theme-selector"]', { timeout: 10000 })
    
    // Change theme to Color-Blind Friendly
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await page.click('text=Color-Blind Friendly')
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    // Verify theme is still selected
    const themeSelector = page.locator('[data-testid="theme-selector"]')
    await expect(themeSelector).toContainText('Color-Blind Friendly')
    
    // Open modal again and verify Color-Blind Friendly is still selected
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    
    // The selected theme should be visually different (have different styling)
    const selectedTheme = page.locator('text=Color-Blind Friendly').locator('..')
    const backgroundColor = await selectedTheme.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    
    // Should have a different background color indicating selection
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)') // Not transparent
    
    console.log('Theme selection persisted:', backgroundColor)
  })
})
