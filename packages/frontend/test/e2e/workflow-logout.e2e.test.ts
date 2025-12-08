import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { AuthWorkflow } from './workflows/auth.workflow'
import { LogoutWorkflow } from './workflows/logout.workflow'

/**
 * Logout Workflow Tests
 * Tests the complete logout flow using real UI interactions
 * Following the pattern: ONLY mock external services, not our own backend/Redux
 */

test.describe('Logout Workflow - Real Backend Integration', () => {
  
  test('Workflow: User can successfully log out', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    const logout = new LogoutWorkflow(page)
    
    // GIVEN: I am logged in as a valid user
    await auth.givenIAmOnTheLoginScreen()
    const creds = await auth.givenIHaveValidCredentials()
    await auth.whenIEnterCredentials(creds.email, creds.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()
    
    // WHEN: I navigate to my profile
    await logout.givenIAmOnTheProfileScreen()
    
    // AND: I click the logout button
    await logout.whenIClickTheLogoutButton()
    
    // THEN: I should see the logout confirmation screen
    await logout.thenIShouldSeeTheLogoutConfirmationScreen()
    
    // WHEN: I confirm logout
    await logout.whenIConfirmLogout()
    
    // THEN: I should be logged out and see the login screen
    await logout.thenIShouldBeLoggedOut()
    await logout.thenIShouldSeeTheLoginScreen()
  })

  test('Workflow: Logout works even when backend API fails', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    const logout = new LogoutWorkflow(page)
    
    // GIVEN: I am logged in
    await auth.givenIAmOnTheLoginScreen()
    const creds = await auth.givenIHaveValidCredentials()
    await auth.whenIEnterCredentials(creds.email, creds.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()
    
    // AND: The backend logout API is failing
    await page.route('**/v1/auth/logout', async (route) => {
      console.log('🔒 Mocking logout API failure (500 error)')
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Internal server error'
        })
      })
    })
    
    // WHEN: I attempt to logout
    await logout.givenIAmOnTheProfileScreen()
    await logout.whenIClickTheLogoutButton()
    await logout.thenIShouldSeeTheLogoutConfirmationScreen()
    await logout.whenIConfirmLogout()
    
    // THEN: I should still be logged out locally despite API failure
    await logout.thenIShouldBeLoggedOut()
    
    // AND: I should not be able to access protected screens
    await logout.thenIShouldNotBeAbleToAccessProtectedScreens()
  })

  test('Workflow: Logout handles invalid refresh token', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    const logout = new LogoutWorkflow(page)
    
    // GIVEN: I am logged in
    await auth.givenIAmOnTheLoginScreen()
    const creds = await auth.givenIHaveValidCredentials()
    await auth.whenIEnterCredentials(creds.email, creds.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()
    
    // AND: My refresh token is invalid/expired
    await page.route('**/v1/auth/logout', async (route) => {
      console.log('🔒 Mocking logout API with 401 (invalid token)')
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid or expired refresh token'
        })
      })
    })
    
    // WHEN: I attempt to logout
    await logout.givenIAmOnTheProfileScreen()
    await logout.whenIClickTheLogoutButton()
    await logout.whenIConfirmLogout()
    
    // THEN: I should still be logged out locally
    await logout.thenIShouldBeLoggedOut()
  })

  test('Workflow: Multiple rapid logout clicks are handled gracefully', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    const logout = new LogoutWorkflow(page)
    
    // GIVEN: I am logged in
    await auth.givenIAmOnTheLoginScreen()
    const creds = await auth.givenIHaveValidCredentials()
    await auth.whenIEnterCredentials(creds.email, creds.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()
    
    // WHEN: I navigate to profile and click logout multiple times rapidly
    await logout.givenIAmOnTheProfileScreen()
    await logout.whenIClickLogoutMultipleTimes()
    
    // THEN: I should be logged out without errors
    await logout.thenIShouldBeLoggedOut()
  })

  test('Workflow: User without authentication sees error on profile', async ({ page }) => {
    // GIVEN: I am not logged in
    await page.goto('http://localhost:8081/')
    
    // WHEN: I try to access the profile screen (via profile button)
    const profileButton = page.locator('[aria-label="profile-button"]')
    
    // THEN: Profile button might not be visible when not logged in
    // OR clicking it should show an authentication error
    const buttonVisible = await profileButton.isVisible().catch(() => false)
    
    if (buttonVisible) {
      await profileButton.click()
      await page.waitForTimeout(2000)
      
      // Should see error message or be on login screen
      const hasError = await page.locator('[aria-label="error-message"]').isVisible().catch(() => false)
      const isOnLogin = await page.locator('[aria-label="login-screen"]').isVisible().catch(() => false)
      
      expect(hasError || isOnLogin).toBe(true)
    } else {
      // If profile button isn't visible, user is probably on login screen already
      await expect(page.locator('[aria-label="login-screen"]')).toBeVisible()
    }
  })
})











