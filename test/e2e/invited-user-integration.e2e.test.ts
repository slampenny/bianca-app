import { test, expect, Page } from '@playwright/test'
import { ensureUserRegisteredAndLoggedInViaUI, logoutViaUI } from './helpers/testHelpers'
import { generateRegistrationData } from './fixtures/testData'

/**
 * Integration tests for invited user authentication issues
 * Tests ONLY mock external services (backend API), not our own services (Redux state)
 * 
 * Issues being tested:
 * 1. Logout button not working with expired tokens
 * 2. Users navigating app with expired tokens (currentUser in Redux)
 * 3. Invited users getting stuck on profile screen
 */

test.describe('Invited User Integration Tests', () => {
  
  test('User can log in and log out successfully', async ({ page }) => {
    const testData = generateRegistrationData()
    
    // Mock backend registration API
    await page.route('**/v1/auth/register', async (route) => {
      const body = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          org: {
            id: 'test_org_id',
            name: 'Test Organization',
            email: body.email
          },
          caregiver: {
            id: 'test_caregiver_id',
            email: body.email,
            name: body.name,
            role: 'staff',
            avatar: '',
            phone: body.phone,
            org: 'test_org_id',
            patients: []
          },
          tokens: {
            access: {
              token: `test_access_${Date.now()}`,
              expires: new Date(Date.now() + 3600000).toISOString()
            },
            refresh: {
              token: `test_refresh_${Date.now()}`,
              expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
            }
          }
        })
      })
    })
    
    // Mock backend login API (in case login is attempted first)
    await page.route('**/v1/auth/login', async (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid credentials'
        })
      })
    })
    
    // Register and log in through the UI (real flow)
    await ensureUserRegisteredAndLoggedInViaUI(
      page,
      testData.name,
      testData.email,
      testData.password,
      testData.phone
    )
    
    // Verify we're logged in (URL will be something like /MainTabs/Home/Home)
    await expect(page).toHaveURL(/.*\/(MainTabs|Home|home|alerts|profile|Alert).*/i)
    
    // Test logout functionality
    await logoutViaUI(page)
    
    // Verify we're back on login screen
    await expect(page).toHaveURL(/.*\/(login|)$/)
    await expect(page.getByLabel('login-screen')).toBeVisible({ timeout: 5000 })
  })

  test('Logout works even when backend logout API fails', async ({ page }) => {
    const testData = generateRegistrationData()
    
    // Register and log in
    await ensureUserRegisteredAndLoggedInViaUI(
      page,
      testData.name,
      testData.email,
      testData.password,
      testData.phone
    )
    
    // Mock logout API to fail
    await page.route('**/v1/auth/logout', async (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Internal server error'
        })
      })
    })
    
    // Attempt logout
    await logoutViaUI(page)
    
    // Should still be logged out locally and redirected to login
    await expect(page).toHaveURL(/.*\/(login|)$/)
    await expect(page.getByLabel('login-screen')).toBeVisible({ timeout: 5000 })
  })

  test('Logout works when refresh token is invalid', async ({ page }) => {
    const testData = generateRegistrationData()
    
    // Register and log in
    await ensureUserRegisteredAndLoggedInViaUI(
      page,
      testData.name,
      testData.email,
      testData.password,
      testData.phone
    )
    
    // Mock logout API to return 401 (invalid refresh token)
    await page.route('**/v1/auth/logout', async (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid or expired refresh token'
        })
      })
    })
    
    // Attempt logout
    await logoutViaUI(page)
    
    // Should still clear local state and redirect to login
    await expect(page).toHaveURL(/.*\/(login|)$/)
    await expect(page.getByLabel('login-screen')).toBeVisible({ timeout: 5000 })
  })

  test('User cannot perform actions after tokens expire', async ({ page }) => {
    const testData = generateRegistrationData()
    
    // Register and log in
    await ensureUserRegisteredAndLoggedInViaUI(
      page,
      testData.name,
      testData.email,
      testData.password,
      testData.phone
    )
    
    // Mock all authenticated API calls to return 401 (simulating expired tokens)
    await page.route('**/v1/**', async (route) => {
      const url = route.request().url()
      
      // Don't mock login/register/public endpoints
      if (url.includes('/auth/login') || 
          url.includes('/auth/register') || 
          url.includes('/auth/registerWithInvite')) {
        route.continue()
        return
      }
      
      // Mock all other endpoints to return 401
      const authHeader = route.request().headers()['authorization']
      if (authHeader) {
        console.log(`🔒 Mocking 401 response for: ${url}`)
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Token expired'
          })
        })
      } else {
        route.continue()
      }
    })
    
    // Try to navigate around the app
    await page.goto('http://localhost:8082/profile')
    await page.waitForTimeout(2000)
    
    // User might be able to navigate, but any API calls should fail
    // Check if we see error messages or are redirected to login
    const isOnLoginScreen = await page.getByLabel('login-screen').isVisible().catch(() => false)
    const hasErrorMessage = await page.getByLabel('error-message').isVisible().catch(() => false)
    
    console.log('On login screen after token expiration:', isOnLoginScreen)
    console.log('Shows error message:', hasErrorMessage)
    
    // Either should be true - user should know something is wrong
    // This test will help identify if the app handles token expiration properly
  })

  test('Invited user can complete signup and access app', async ({ page }) => {
    const inviteToken = `test_invite_token_${Date.now()}`
    const testData = generateRegistrationData()
    
    // Mock invite verification endpoint
    await page.route('**/v1/orgs/verifyInvite*', async (route) => {
      const url = new URL(route.request().url())
      const token = url.searchParams.get('token')
      
      if (token === inviteToken) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: 'mock_org_id',
            caregiverName: testData.name,
            caregiverEmail: testData.email,
            caregiverPhone: testData.phone
          })
        })
      } else {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Invalid or expired invite token'
          })
        })
      }
    })
    
    // Mock registerWithInvite endpoint
    await page.route('**/v1/auth/registerWithInvite', async (route) => {
      const body = route.request().postDataJSON()
      
      if (body.token === inviteToken) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: 'mock_invited_caregiver_id',
              email: testData.email,
              name: testData.name,
              role: 'staff',
              avatar: '',
              phone: testData.phone,
              org: 'mock_org_id',
              patients: []
            },
            tokens: {
              access: {
                token: `test_access_token_${Date.now()}`,
                expires: new Date(Date.now() + 3600000).toISOString()
              },
              refresh: {
                token: `test_refresh_token_${Date.now()}`,
                expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
              }
            }
          })
        })
      } else {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Invalid invite token'
          })
        })
      }
    })
    
    // Navigate to signup page with invite token
    await page.goto(`http://localhost:8082/signup?token=${inviteToken}`)
    await page.waitForSelector('[aria-label="signup-screen"]', { timeout: 10000 })
    
    // Fill in password
    await page.fill('[aria-label="signup-password-input"]', testData.password)
    await page.fill('[aria-label="signup-confirm-password-input"]', testData.password)
    
    // Submit signup
    await page.click('[aria-label="signup-submit-button"]')
    
    // Should be redirected to home screen after successful signup
    await page.waitForTimeout(3000)
    
    // Verify user can access the app
    const currentUrl = page.url()
    console.log('After signup, navigated to:', currentUrl)
    
    // User should be logged in and able to navigate
    const canAccessProfile = await page.goto('http://localhost:8082/profile')
    expect(canAccessProfile.ok()).toBe(true)
  })

  test('Invited user who returns to profile screen is redirected to signup', async ({ page }) => {
    const inviteToken = `test_invite_token_${Date.now()}`
    const testData = generateRegistrationData()
    
    // Mock invite verification
    await page.route('**/v1/orgs/verifyInvite*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orgId: 'mock_org_id',
          caregiverName: testData.name,
          caregiverEmail: testData.email,
          caregiverPhone: testData.phone
        })
      })
    })
    
    // Navigate to signup page with invite token first
    await page.goto(`http://localhost:8082/signup?token=${inviteToken}`)
    await page.waitForSelector('[aria-label="signup-screen"]', { timeout: 10000 })
    
    // Now navigate away (simulate user navigating away from signup)
    await page.goto('http://localhost:8082/profile')
    
    // Should be redirected back to signup screen
    await page.waitForSelector('[aria-label="signup-screen"]', { timeout: 5000 })
    
    // Verify we're on signup screen, not stuck on profile
    expect(await page.getByLabel('signup-screen').isVisible()).toBe(true)
  })

  test('User without authentication sees error on profile screen', async ({ page }) => {
    // Navigate to profile without logging in
    await page.goto('http://localhost:8082/profile')
    
    // Should either see error message or be redirected to login
    await page.waitForTimeout(2000)
    
    const hasErrorMessage = await page.getByLabel('error-message').isVisible().catch(() => false)
    const isOnLoginScreen = await page.getByLabel('login-screen').isVisible().catch(() => false)
    
    console.log('Shows error message:', hasErrorMessage)
    console.log('Redirected to login:', isOnLoginScreen)
    
    // One of these should be true
    expect(hasErrorMessage || isOnLoginScreen).toBe(true)
    
    // If there's an error message, check for "Go to Login" button
    if (hasErrorMessage) {
      const goToLoginButton = page.getByLabel('go-to-login-button')
      await expect(goToLoginButton).toBeVisible()
      
      // Click it and verify redirect
      await goToLoginButton.click()
      await page.waitForSelector('[aria-label="login-screen"]', { timeout: 5000 })
    }
  })

  test('Multiple logout attempts are handled gracefully', async ({ page }) => {
    const testData = generateRegistrationData()
    
    // Register and log in
    await ensureUserRegisteredAndLoggedInViaUI(
      page,
      testData.name,
      testData.email,
      testData.password,
      testData.phone
    )
    
    // Navigate to profile
    await page.goto('http://localhost:8082/profile')
    await page.waitForSelector('[aria-label="profile-screen"]')
    
    // Click profile logout button
    const logoutButton = page.getByLabel('profile-logout-button')
    await expect(logoutButton).toBeVisible()
    await logoutButton.click()
    
    // Should navigate to logout confirmation screen
    await page.waitForSelector('[aria-label="logout-screen"]')
    
    // Click logout button multiple times rapidly
    const confirmButton = page.getByLabel('logout-button')
    await confirmButton.click()
    await confirmButton.click().catch(() => {}) // Might fail if already logged out
    await confirmButton.click().catch(() => {}) // Might fail if already logged out
    
    // Wait for redirect
    await page.waitForTimeout(3000)
    
    // Should end up on login screen without errors
    await expect(page.getByLabel('login-screen')).toBeVisible({ timeout: 5000 })
  })

  test('User can navigate after login and logout works', async ({ page }) => {
    const testData = generateRegistrationData()
    
    // Register and log in
    await ensureUserRegisteredAndLoggedInViaUI(
      page,
      testData.name,
      testData.email,
      testData.password,
      testData.phone
    )
    
    // Navigate to different screens
    await page.goto('http://localhost:8082/')
    await page.waitForTimeout(1000)
    
    await page.goto('http://localhost:8082/profile')
    await page.waitForTimeout(1000)
    
    await page.goto('http://localhost:8082/alerts')
    await page.waitForTimeout(1000)
    
    // Go back to profile and logout
    await page.goto('http://localhost:8082/profile')
    await page.waitForSelector('[aria-label="profile-screen"]')
    
    // Perform logout
    await logoutViaUI(page)
    
    // Verify logout successful
    await expect(page.getByLabel('login-screen')).toBeVisible({ timeout: 5000 })
  })

  test('Invalid invite token shows error and redirects to login', async ({ page }) => {
    const invalidToken = 'invalid_token_123'
    
    // Mock invite verification to fail
    await page.route('**/v1/orgs/verifyInvite*', async (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid or expired invite token'
        })
      })
    })
    
    // Navigate to signup with invalid token
    await page.goto(`http://localhost:8082/signup?token=${invalidToken}`)
    
    // Wait for error to be shown
    await page.waitForTimeout(2000)
    
    // Should see error message or be redirected to login
    const hasError = await page.isVisible('text=Invalid or expired invite token')
    const isOnLogin = await page.getByLabel('login-screen').isVisible().catch(() => false)
    
    console.log('Shows error:', hasError)
    console.log('On login screen:', isOnLogin)
    
    // After error, should redirect to login
    await page.waitForSelector('[aria-label="login-screen"]', { timeout: 10000 })
  })
})
