import { test, expect } from '@playwright/test'

test.describe('Theme Selection and Verification', () => {
  test('should change theme and verify the change', async ({ page }) => {
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
    
    // Verify theme selector is visible and shows initial theme
    const themeSelector = page.locator('[data-testid="theme-selector"]')
    await expect(themeSelector).toBeVisible()
    await expect(themeSelector).toContainText('Healthcare')
    
    // Click to open theme selection modal
    await page.click('[data-testid="theme-selector"]')
    
    // Wait for modal to appear
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    
    // Verify both themes are available in the modal (use more specific selectors)
    const modal = page.locator('text=Select Theme').locator('..')
    await expect(modal.locator('text=Healthcare')).toBeVisible()
    await expect(modal.locator('text=Color-Blind Friendly')).toBeVisible()
    
    // Select the Color-Blind Friendly theme
    await modal.locator('text=Color-Blind Friendly').click()
    
    // Wait for modal to close
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    
    // Verify the theme selector now shows the new theme
    await expect(themeSelector).toContainText('Color-Blind Friendly')
    
    console.log('✅ Theme successfully changed to Color-Blind Friendly')
  })

  test('should show theme options with descriptions', async ({ page }) => {
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
    
    // Check that both themes and their descriptions are visible
    const modal = page.locator('text=Select Theme').locator('..')
    
    // Healthcare theme
    await expect(modal.locator('text=Healthcare')).toBeVisible()
    await expect(modal.locator('text=Professional medical theme with blue and green colors')).toBeVisible()
    
    // Color-Blind Friendly theme
    await expect(modal.locator('text=Color-Blind Friendly')).toBeVisible()
    await expect(modal.locator('text=High contrast theme optimized for color vision deficiency')).toBeVisible()
    
    console.log('✅ Theme descriptions are displayed correctly')
  })

  test('should allow switching between themes multiple times', async ({ page }) => {
    // Navigate and login
    await page.goto('/')
    await page.fill('[data-testid="email-input"]', 'fake@example.org')
    await page.fill('[data-testid="password-input"]', 'Password1')
    await page.click('[data-testid="login-button"]')
    
    // Wait for login and navigate to profile
    await page.waitForSelector('[data-testid="profile-button"]', { timeout: 15000 })
    await page.click('[data-testid="profile-button"]')
    await page.waitForSelector('[data-testid="theme-selector"]', { timeout: 10000 })
    
    const themeSelector = page.locator('[data-testid="theme-selector"]')
    
    // Start with Healthcare theme
    await expect(themeSelector).toContainText('Healthcare')
    
    // Switch to Color-Blind Friendly
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    const modal = page.locator('text=Select Theme').locator('..')
    await modal.locator('text=Color-Blind Friendly').click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await expect(themeSelector).toContainText('Color-Blind Friendly')
    
    // Switch back to Healthcare
    await page.click('[data-testid="theme-selector"]')
    await page.waitForSelector('text=Select Theme', { timeout: 5000 })
    await modal.locator('text=Healthcare').click()
    await page.waitForSelector('text=Select Theme', { state: 'hidden', timeout: 5000 })
    await expect(themeSelector).toContainText('Healthcare')
    
    console.log('✅ Theme switching works in both directions')
  })
})
