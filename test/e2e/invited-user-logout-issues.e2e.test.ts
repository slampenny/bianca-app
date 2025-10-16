import { test, expect, Page } from '@playwright/test'
import { 
  setupMockAuthState, 
  createMockTokens, 
  createMockCaregiver,
  setupAuthMocks,
  getCurrentAuthState,
  verifyNotAuthenticated,
  performLogout
} from './helpers/authHelpers'

test.describe('Invited User Logout Issues', () => {
  
  test('Logout button does nothing when refresh token is expired', async ({ page }) => {
    // Create expired tokens but keep currentUser in state (common issue)
    const expiredTokens = createMockTokens(-3600000) // Expired 1 hour ago
    const mockUser = createMockCaregiver({
      email: 'invited@example.com',
      name: 'Invited User',
      role: 'staff'
    })

    // Set up Redux state with expired tokens but currentUser still there
    await setupMockAuthState(page, {
      tokens: expiredTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Mock logout API to fail due to expired refresh token
    await setupAuthMocks(page, {
      logoutSuccess: false
    })

    // Navigate to profile screen
    await page.goto('/profile')
    await page.waitForSelector('[data-testid="profile-screen"]')

    // Verify user can see profile (currentUser is in Redux)
    expect(await page.isVisible('[data-testid="profile-screen"]')).toBe(true)

    // Click logout button
    await page.getByTestId('profile-logout-button').click()
    await page.waitForSelector('[data-testid="logout-screen"]')

    // Click the actual logout button
    await page.getByTestId('logout-button').click()

    // Wait for any API calls to complete
    await page.waitForTimeout(2000)

    // The issue: logout button might not work properly with expired tokens
    // Check if we're still on logout screen or if we were redirected
    const currentUrl = page.url()
    const isOnLogoutScreen = await page.isVisible('[data-testid="logout-screen"]')
    const isOnLoginScreen = await page.isVisible('[data-testid="login-screen"]')

    console.log('Current URL:', currentUrl)
    console.log('On logout screen:', isOnLogoutScreen)
    console.log('On login screen:', isOnLoginScreen)

    // Expected behavior: should be redirected to login screen even if API fails
    // This test will help identify if the logout button is truly "doing nothing"
    if (!isOnLoginScreen && isOnLogoutScreen) {
      console.warn('⚠️ Logout button may not be working properly with expired tokens')
    }

    // Verify local state is cleared (this should happen regardless of API success)
    const authState = await getCurrentAuthState(page)
    expect(authState.tokens).toBeNull()
    expect(authState.currentUser).toBeNull()
  })

  test('Logout button works with valid tokens', async ({ page }) => {
    // Create valid tokens
    const validTokens = createMockTokens(3600000) // Valid for 1 hour
    const mockUser = createMockCaregiver({
      email: 'valid@example.com',
      name: 'Valid User',
      role: 'staff'
    })

    // Set up Redux state with valid tokens
    await setupMockAuthState(page, {
      tokens: validTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Mock successful logout
    await setupAuthMocks(page, {
      logoutSuccess: true
    })

    // Perform logout
    await performLogout(page)

    // Verify we're on login screen
    await page.waitForSelector('[data-testid="login-screen"]')

    // Verify auth state is cleared
    await verifyNotAuthenticated(page)
  })

  test('Logout button handles network errors gracefully', async ({ page }) => {
    const validTokens = createMockTokens(3600000)
    const mockUser = createMockCaregiver({
      email: 'network@example.com',
      name: 'Network Test User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: validTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Mock network error for logout API
    await page.route('**/v1/auth/logout', async (route) => {
      route.abort('failed') // Simulate network failure
    })

    // Navigate to profile and attempt logout
    await page.goto('/profile')
    await page.waitForSelector('[data-testid="profile-screen"]')
    
    await page.getByTestId('profile-logout-button').click()
    await page.waitForSelector('[data-testid="logout-screen"]')
    
    await page.getByTestId('logout-button').click()

    // Wait for any error handling
    await page.waitForTimeout(3000)

    // Should still clear local state and redirect to login despite network error
    const authState = await getCurrentAuthState(page)
    expect(authState.tokens).toBeNull()
    expect(authState.currentUser).toBeNull()

    // Should be redirected to login screen
    await page.waitForSelector('[data-testid="login-screen"]')
  })

  test('Invited user can logout after completing signup', async ({ page }) => {
    // Start with invite token
    const inviteToken = `mock_invite_token_${Date.now()}`
    await setupMockAuthState(page, {
      tokens: null,
      currentUser: null,
      authEmail: '',
      inviteToken: inviteToken
    })

    // Mock invite verification
    await setupAuthMocks(page, {
      inviteVerificationSuccess: true,
      registerWithInviteSuccess: true
    })

    // Navigate to signup (should be redirected from profile)
    await page.goto('/profile')
    await page.waitForSelector('[data-testid="signup-screen"]')

    // Complete signup
    await page.getByTestId('signup-password-input').fill('StrongPassword123!')
    await page.getByTestId('signup-confirm-password-input').fill('StrongPassword123!')
    await page.getByTestId('signup-submit-button').click()

    // Wait for successful registration
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Verify user is authenticated
    const authState = await getCurrentAuthState(page)
    expect(authState.tokens).not.toBeNull()
    expect(authState.currentUser).not.toBeNull()
    expect(authState.inviteToken).toBeNull()

    // Now test logout functionality
    await setupAuthMocks(page, {
      logoutSuccess: true
    })

    await performLogout(page)

    // Verify logout worked
    await page.waitForSelector('[data-testid="login-screen"]')
    await verifyNotAuthenticated(page)
  })

  test('Logout button behavior with missing tokens', async ({ page }) => {
    // Set up state with no tokens but currentUser present (edge case)
    const mockUser = createMockCaregiver({
      email: 'no-tokens@example.com',
      name: 'No Tokens User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: null, // No tokens
      currentUser: mockUser, // But user is still in state
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Navigate to profile
    await page.goto('/profile')
    await page.waitForSelector('[data-testid="profile-screen"]')

    // Try to logout
    await page.getByTestId('profile-logout-button').click()
    await page.waitForSelector('[data-testid="logout-screen"]')
    
    await page.getByTestId('logout-button').click()

    // Should handle gracefully - either redirect to login or clear state
    await page.waitForTimeout(2000)

    // Check what happened
    const isOnLoginScreen = await page.isVisible('[data-testid="login-screen"]')
    const isOnLogoutScreen = await page.isVisible('[data-testid="logout-screen"]')

    if (isOnLogoutScreen) {
      console.warn('⚠️ Logout button may be stuck on logout screen with no tokens')
    }

    // State should be cleared regardless
    const authState = await getCurrentAuthState(page)
    expect(authState.tokens).toBeNull()
    expect(authState.currentUser).toBeNull()
  })

  test('Multiple logout attempts', async ({ page }) => {
    const validTokens = createMockTokens(3600000)
    const mockUser = createMockCaregiver({
      email: 'multi-logout@example.com',
      name: 'Multi Logout User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: validTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    await setupAuthMocks(page, {
      logoutSuccess: true
    })

    // First logout attempt
    await page.goto('/profile')
    await page.waitForSelector('[data-testid="profile-screen"]')
    
    await page.getByTestId('profile-logout-button').click()
    await page.waitForSelector('[data-testid="logout-screen"]')
    
    // Click logout button multiple times quickly
    await page.getByTestId('logout-button').click()
    await page.getByTestId('logout-button').click()
    await page.getByTestId('logout-button').click()

    // Should handle multiple clicks gracefully
    await page.waitForTimeout(2000)

    // Should end up on login screen
    await page.waitForSelector('[data-testid="login-screen"]')
    await verifyNotAuthenticated(page)
  })

  test('Logout button with invite token present', async ({ page }) => {
    // Edge case: user has both invite token and is somehow logged in
    const validTokens = createMockTokens(3600000)
    const mockUser = createMockCaregiver({
      email: 'mixed-state@example.com',
      name: 'Mixed State User',
      role: 'staff'
    })
    const inviteToken = `mock_invite_token_${Date.now()}`

    await setupMockAuthState(page, {
      tokens: validTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: inviteToken // Both tokens and invite token
    })

    await setupAuthMocks(page, {
      logoutSuccess: true
    })

    // Attempt logout
    await page.goto('/profile')
    await page.waitForSelector('[data-testid="profile-screen"]')
    
    await page.getByTestId('profile-logout-button').click()
    await page.waitForSelector('[data-testid="logout-screen"]')
    
    await page.getByTestId('logout-button').click()

    // Wait for logout to complete
    await page.waitForTimeout(2000)

    // Should clear everything including invite token
    const authState = await getCurrentAuthState(page)
    expect(authState.tokens).toBeNull()
    expect(authState.currentUser).toBeNull()
    expect(authState.inviteToken).toBeNull()

    // Should be on login screen
    await page.waitForSelector('[data-testid="login-screen"]')
  })
})
