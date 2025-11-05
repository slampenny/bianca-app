import { test, expect } from '@playwright/test'

test.describe('Theme Selector Debug', () => {
  test('should find theme selector on profile screen', async ({ page }) => {
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
    
    // Wait for profile screen to load and take a screenshot
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'profile-screen.png' })
    
    // Check if theme selector exists
    const themeSelector = page.locator('[data-testid="theme-selector"]')
    const count = await themeSelector.count()
    console.log('Theme selector count:', count)
    
    if (count > 0) {
      console.log('Theme selector found!')
      await expect(themeSelector).toBeVisible()
      
      // Try to click it
      await themeSelector.click()
      await page.waitForTimeout(1000)
      
      // Check if modal opened
      const modal = page.locator('text=Select Theme')
      const modalCount = await modal.count()
      console.log('Modal count:', modalCount)
      
      if (modalCount > 0) {
        console.log('Modal opened!')
        await expect(modal).toBeVisible()
      } else {
        console.log('Modal did not open')
        // Take another screenshot to see what happened
        await page.screenshot({ path: 'after-click.png' })
      }
    } else {
      console.log('Theme selector not found')
      // Check what's actually on the page
      const pageContent = await page.textContent('body')
      console.log('Page content:', pageContent?.substring(0, 500))
    }
  })
})





