import { test, expect, Page } from '@playwright/test'
import { 
  setupMockAuthState, 
  createMockTokens, 
  createMockCaregiver,
  setupAuthMocks,
  getCurrentAuthState,
  simulateTokenExpiration,
  waitForScreen
} from './helpers/authHelpers'

test.describe('Token Expiration and Navigation Issues', () => {
  
  test('User can navigate app with expired tokens but currentUser in Redux state', async ({ page }) => {
    // This test demonstrates the core issue: user appears logged in but can't perform actions
    
    // Create expired tokens but keep currentUser in Redux (common scenario)
    const expiredTokens = createMockTokens(-3600000) // Expired 1 hour ago
    const mockUser = createMockCaregiver({
      email: 'expired@example.com',
      name: 'Expired Token User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: expiredTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Mock all API calls to return 401 for expired tokens
    await simulateTokenExpiration(page)

    console.log('🧪 Testing navigation with expired tokens...')

    // User can still navigate to different screens because currentUser is in Redux
    await page.goto('/')
    await waitForScreen(page, 'home-screen')
    console.log('✅ Can navigate to home screen')

    await page.goto('/profile')
    await waitForScreen(page, 'profile-screen')
    console.log('✅ Can navigate to profile screen')

    await page.goto('/alerts')
    await waitForScreen(page, 'alerts-screen')
    console.log('✅ Can navigate to alerts screen')

    // But any API calls should fail silently or show errors
    // This is the problem: user can navigate but can't perform actions
    
    // Wait a bit to see if any API calls are made
    await page.waitForTimeout(2000)
    
    // Check for any error indicators in the UI
    const hasErrorMessages = await page.isVisible('[data-testid="error-message"]')
    const hasLoadingSpinners = await page.isVisible('[data-testid="loading-spinner"]')
    
    console.log('Has error messages:', hasErrorMessages)
    console.log('Has loading spinners:', hasLoadingSpinners)
    
    // This demonstrates the UX issue: user can navigate but functionality is broken
    expect(await page.isVisible('[data-testid="home-screen"]')).toBe(true)
  })

  test('API calls fail with expired tokens but UI navigation works', async ({ page }) => {
    const expiredTokens = createMockTokens(-3600000)
    const mockUser = createMockCaregiver({
      email: 'api-test@example.com',
      name: 'API Test User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: expiredTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Track API calls
    const apiCalls: string[] = []
    await page.route('**/v1/**', async (route) => {
      const url = route.request().url()
      apiCalls.push(url)
      
      if (route.request().headers()['authorization']?.includes('expired')) {
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

    // Navigate around the app
    await page.goto('/')
    await page.waitForTimeout(1000)
    
    await page.goto('/profile')
    await page.waitForTimeout(1000)
    
    await page.goto('/alerts')
    await page.waitForTimeout(1000)

    console.log('API calls made:', apiCalls)
    
    // User can navigate but API calls fail
    // This is the core issue: navigation works but functionality doesn't
    expect(apiCalls.length).toBeGreaterThan(0)
    
    // Check if any 401 errors were handled gracefully
    const hasUnauthorizedErrors = apiCalls.some(url => url.includes('401'))
    console.log('Has 401 errors:', hasUnauthorizedErrors)
  })

  test('Token refresh fails and user should be logged out', async ({ page }) => {
    // Create tokens that are about to expire
    const soonToExpireTokens = createMockTokens(5000) // 5 seconds from now
    const mockUser = createMockCaregiver({
      email: 'refresh-test@example.com',
      name: 'Refresh Test User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: soonToExpireTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Mock refresh token API to fail
    await setupAuthMocks(page, {
      refreshSuccess: false
    })

    // Navigate to any screen
    await page.goto('/profile')
    await waitForScreen(page, 'profile-screen')

    // Wait for token refresh attempt (should happen automatically)
    await page.waitForTimeout(10000)

    // Should be redirected to login screen after failed refresh
    await waitForScreen(page, 'login-screen')

    // Verify auth state is cleared
    const authState = await getCurrentAuthState(page)
    expect(authState.tokens).toBeNull()
    expect(authState.currentUser).toBeNull()
  })

  test('User returns to app after session expired', async ({ page }) => {
    // Simulate user returning to app after their session expired
    // No tokens in localStorage, but currentUser might still be there from before
    const mockUser = createMockCaregiver({
      email: 'returning@example.com',
      name: 'Returning User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: null, // No tokens
      currentUser: mockUser, // But user is still in state
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Navigate to profile screen
    await page.goto('/profile')

    // Should see authentication error since no tokens
    await expect(page.getByText('Error: Please authenticate')).toBeVisible()
    await expect(page.getByText('Please log in to access your profile.')).toBeVisible()

    // Click "Go to Login" button
    await page.getByTestId('go-to-login-button').click()

    // Should be redirected to login screen
    await waitForScreen(page, 'login-screen')
  })

  test('Mixed state: expired access token but valid refresh token', async ({ page }) => {
    // Edge case: access token expired but refresh token is still valid
    const expiredAccessTime = new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    const validRefreshTime = new Date(Date.now() + 3600000).toISOString() // 1 hour from now

    const mixedTokens = {
      access: {
        token: 'expired_access_token',
        expires: expiredAccessTime
      },
      refresh: {
        token: 'valid_refresh_token',
        expires: validRefreshTime
      }
    }

    const mockUser = createMockCaregiver({
      email: 'mixed-tokens@example.com',
      name: 'Mixed Tokens User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: mixedTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Mock refresh to succeed
    await setupAuthMocks(page, {
      refreshSuccess: true
    })

    // Navigate to profile
    await page.goto('/profile')
    await waitForScreen(page, 'profile-screen')

    // Wait for automatic token refresh
    await page.waitForTimeout(5000)

    // Should still be on profile screen with refreshed tokens
    await waitForScreen(page, 'profile-screen')

    // Verify tokens were refreshed
    const authState = await getCurrentAuthState(page)
    expect(authState.tokens).not.toBeNull()
    expect(authState.tokens.access.token).not.toBe('expired_access_token')
  })

  test('User navigates to protected route with no tokens', async ({ page }) => {
    // User has no tokens at all but somehow navigates to protected route
    await setupMockAuthState(page, {
      tokens: null,
      currentUser: null,
      authEmail: '',
      inviteToken: null
    })

    // Try to navigate to protected routes
    await page.goto('/profile')
    
    // Should be redirected to login
    await waitForScreen(page, 'login-screen')

    await page.goto('/alerts')
    
    // Should be redirected to login
    await waitForScreen(page, 'login-screen')

    await page.goto('/')
    
    // Should be redirected to login
    await waitForScreen(page, 'login-screen')
  })

  test('Token expiration during user interaction', async ({ page }) => {
    // Start with valid tokens
    const validTokens = createMockTokens(10000) // Valid for 10 seconds
    const mockUser = createMockCaregiver({
      email: 'interaction@example.com',
      name: 'Interaction User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: validTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Navigate to profile
    await page.goto('/profile')
    await waitForScreen(page, 'profile-screen')

    // Wait for tokens to expire
    await page.waitForTimeout(12000)

    // Try to perform an action (like updating profile)
    await page.getByTestId('update-profile-button').click()

    // Should handle token expiration gracefully
    await page.waitForTimeout(2000)

    // Check if user was redirected to login or if error was shown
    const isOnLoginScreen = await page.isVisible('[data-testid="login-screen"]')
    const hasErrorMessage = await page.isVisible('[data-testid="error-message"]')

    console.log('Redirected to login:', isOnLoginScreen)
    console.log('Shows error message:', hasErrorMessage)

    // Either should happen - user should be informed of the issue
    expect(isOnLoginScreen || hasErrorMessage).toBe(true)
  })

  test('Concurrent token refresh attempts', async ({ page }) => {
    const soonToExpireTokens = createMockTokens(5000)
    const mockUser = createMockCaregiver({
      email: 'concurrent@example.com',
      name: 'Concurrent User',
      role: 'staff'
    })

    await setupMockAuthState(page, {
      tokens: soonToExpireTokens,
      currentUser: mockUser,
      authEmail: mockUser.email,
      inviteToken: null
    })

    // Mock refresh to succeed but with delay
    await page.route('**/v1/auth/refresh-tokens', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tokens: createMockTokens(3600000)
        })
      })
    })

    // Navigate to profile
    await page.goto('/profile')
    await waitForScreen(page, 'profile-screen')

    // Wait for token refresh
    await page.waitForTimeout(10000)

    // Should handle concurrent refresh attempts gracefully
    await waitForScreen(page, 'profile-screen')

    // Verify tokens were refreshed
    const authState = await getCurrentAuthState(page)
    expect(authState.tokens).not.toBeNull()
  })
})
