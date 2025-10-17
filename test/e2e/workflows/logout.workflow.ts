import { Page, expect } from '@playwright/test'

/**
 * Logout workflow - tests logout functionality using real UI interactions
 * Follows the Given/When/Then pattern like other workflow tests
 */
export class LogoutWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  
  async givenIAmLoggedIn(email: string, password: string) {
    // Listen for ALL requests
    this.page.on('request', request => {
      if (request.url().includes('/v1/')) {
        console.log('→ Request:', request.method(), request.url())
      }
    })
    
    // Listen for ALL responses
    this.page.on('response', async response => {
      if (response.url().includes('/v1/')) {
        const status = response.status()
        console.log('← Response:', status, response.url())
        if (status >= 400) {
          try {
            const body = await response.text()
            console.log('  Error body:', body.substring(0, 200))
          } catch (e) {}
        }
      }
    })
    
    // Listen for console messages
    this.page.on('console', msg => {
      const text = msg.text()
      if (text.includes('error') || text.includes('Error') || text.includes('fail')) {
        console.log('Browser console:', text)
      }
    })
    
    // Listen for failed requests
    this.page.on('requestfailed', request => {
      console.log('Failed request:', request.url(), request.failure()?.errorText)
    })
    
    // Navigate to login
    await this.page.goto('http://localhost:8082/')
    await this.page.waitForSelector('[aria-label="email-input"]', { timeout: 10000 })
    
    // Login
    console.log(`\n🔐 Logging in with ${email} / ${password}`)
    await this.page.fill('[aria-label="email-input"]', email)
    await this.page.fill('[aria-label="password-input"]', password)
    await this.page.click('[aria-label="login-button"]')
    
    // Wait for response
    console.log('⏳ Waiting for login response...')
    await this.page.waitForTimeout(5000)
    
    // Log current URL for debugging
    console.log('📍 Current URL after login:', this.page.url())
  }

  async givenIAmOnTheProfileScreen() {
    // Click the profile button in the header
    const profileButton = this.page.locator('[aria-label="profile-button"]')
    await expect(profileButton).toBeVisible({ timeout: 5000 })
    await profileButton.click()
    
    // Wait for profile screen to load
    await this.page.waitForTimeout(2000)
    await expect(this.page.locator('[aria-label="profile-screen"]')).toBeVisible({ timeout: 5000 })
  }

  // WHEN steps - Actions
  
  async whenIClickTheLogoutButton() {
    const logoutButton = this.page.locator('[aria-label="profile-logout-button"]')
    await expect(logoutButton).toBeVisible({ timeout: 5000 })
    console.log('Found logout button, clicking...')
    await logoutButton.click()
    console.log('Clicked logout button, waiting for navigation...')
    await this.page.waitForTimeout(2000)
    console.log('Current URL after logout click:', this.page.url())
  }

  async whenIConfirmLogout() {
    // Wait for logout confirmation screen
    await this.page.waitForTimeout(1000)
    const confirmButton = this.page.locator('[aria-label="logout-button"]')
    await expect(confirmButton).toBeVisible({ timeout: 5000 })
    await confirmButton.click()
  }

  async whenIClickLogoutMultipleTimes() {
    const logoutButton = this.page.locator('[aria-label="profile-logout-button"]')
    await logoutButton.click()
    
    // Wait for logout screen
    await this.page.waitForTimeout(1000)
    
    const confirmButton = this.page.locator('[aria-label="logout-button"]')
    
    // Test rapid clicks: click 3 times as fast as possible
    // The app should handle this gracefully (ideally by disabling the button after first click)
    try {
      await Promise.all([
        confirmButton.click().catch(() => {}),
        confirmButton.click().catch(() => {}),
        confirmButton.click().catch(() => {}),
      ])
    } catch (error) {
      console.log('Multiple clicks caused expected errors:', error)
    }
    
    // Wait for navigation, but don't fail if page closes (that's expected after logout)
    await this.page.waitForTimeout(2000).catch(() => {})
  }

  // THEN steps - Assertions
  
  async thenIShouldSeeTheLogoutConfirmationScreen() {
    await expect(this.page.locator('[aria-label="logout-screen"]')).toBeVisible({ timeout: 5000 })
  }

  async thenIShouldBeLoggedOut() {
    // Should be redirected to login screen
    // Use a longer timeout as rapid clicks might take time to process
    await this.page.waitForTimeout(3000).catch(() => {
      console.log('Page navigated during wait (expected)')
    })
    
    // Check if we're on the login screen
    await expect(this.page.locator('[aria-label="login-screen"]')).toBeVisible({ timeout: 15000 })
  }

  async thenIShouldSeeTheLoginScreen() {
    await expect(this.page.locator('[aria-label="email-input"]')).toBeVisible({ timeout: 5000 })
  }

  async thenIShouldNotBeAbleToAccessProtectedScreens() {
    // Try to navigate to home screen
    await this.page.goto('http://localhost:8082/')
    await this.page.waitForTimeout(2000)
    
    // Should be on login screen, not home screen
    const isOnLogin = await this.page.locator('[aria-label="login-screen"]').isVisible().catch(() => false)
    const isOnHome = await this.page.locator('[aria-label="home-header"]').isVisible().catch(() => false)
    
    expect(isOnLogin).toBe(true)
    expect(isOnHome).toBe(false)
  }
}
