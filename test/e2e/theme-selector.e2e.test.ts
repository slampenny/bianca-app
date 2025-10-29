import { test, expect } from '@playwright/test'

test.describe('Theme Selector', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/')
    await page.fill('[data-testid="email-input"]', 'fake@example.org')
    await page.fill('[data-testid="password-input"]', 'Password1')
    await page.click('[data-testid="login-button"]')
    
    // Wait for login to complete - navigate to home
    await page.waitForURL('**/MainTabs/Home/**', { timeout: 15000 })
    
    // Navigate to profile screen
    await page.click('[data-testid="profile-button"]')
    await page.waitForURL('**/profile', { timeout: 15000 })
  })

  test('should display theme selector on profile screen', async ({ page }) => {
    // Check that theme selector is visible
    const themeSelector = page.locator('[data-testid="theme-selector"]')
    await expect(themeSelector).toBeVisible()
    
    // Check that it shows the current theme
    const themeLabel = themeSelector.locator('text=Theme')
    await expect(themeLabel).toBeVisible()
  })

  test('should open theme selection modal when clicked', async ({ page }) => {
    // Click the theme selector
    await page.click('[data-testid="theme-selector"]')
    
    // Check that modal opens
    const modal = page.locator('text=Select Theme')
    await expect(modal).toBeVisible()
    
    // Check that both themes are available
    await expect(page.locator('text=Healthcare')).toBeVisible()
    await expect(page.locator('text=Color-Blind Friendly')).toBeVisible()
  })

  test('should allow theme selection', async ({ page }) => {
    // Open theme selector
    await page.click('[data-testid="theme-selector"]')
    
    // Select colorblind theme
    await page.click('text=Color-Blind Friendly')
    
    // Modal should close
    const modal = page.locator('text=Select Theme')
    await expect(modal).not.toBeVisible()
    
    // Theme selector should show the new selection
    const themeSelector = page.locator('[data-testid="theme-selector"]')
    await expect(themeSelector).toContainText('Color-Blind Friendly')
  })

  test('should show color swatches for each theme', async ({ page }) => {
    // Open theme selector
    await page.click('[data-testid="theme-selector"]')
    
    // Check that color swatches are visible
    const colorSwatches = page.locator('[data-testid="theme-selector"] .colorSwatch')
    await expect(colorSwatches).toHaveCount(3) // Primary, success, error colors
  })
})

