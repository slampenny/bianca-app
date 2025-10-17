import { Page, expect } from '@playwright/test'

/**
 * Logout workflow - tests logout functionality using real UI interactions
 * Follows the Given/When/Then pattern like other workflow tests
 */
export class LogoutWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  
  async givenIAmLoggedIn(email: string, password: string) {
    // Listen for console messages
    this.page.on('console', msg => console.log('Browser console:', msg.text()))
    
    // Listen for failed requests
    this.page.on('requestfailed', request => {
      console.log('Failed request:', request.url(), request.failure()?.errorText)
    })
    
    // Navigate to login
    await this.page.goto('http://localhost:8082/')
    await this.page.waitForSelector('[aria-label="email-input"]', { timeout: 10000 })
    
    // Login
    console.log(`Logging in with ${email} / ${password}`)
    await this.page.fill('[aria-label="email-input"]', email)
    await this.page.fill('[aria-label="password-input"]', password)
    await this.page.click('[aria-label="login-button"]')
    
    // Wait for home screen
    await this.page.waitForTimeout(5000)
    
    // Log current URL for debugging
    console.log('Current URL after login:', this.page.url())
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
    await logoutButton.click()
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
    await confirmButton.click()
    await confirmButton.click().catch(() => {}) // Might fail if already logged out
    await confirmButton.click().catch(() => {}) // Might fail if already logged out
  }

  // THEN steps - Assertions
  
  async thenIShouldSeeTheLogoutConfirmationScreen() {
    await expect(this.page.locator('[aria-label="logout-screen"]')).toBeVisible({ timeout: 5000 })
  }

  async thenIShouldBeLoggedOut() {
    // Should be redirected to login screen
    await this.page.waitForTimeout(2000)
    await expect(this.page.locator('[aria-label="login-screen"]')).toBeVisible({ timeout: 10000 })
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
