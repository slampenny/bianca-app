import { Page } from '@playwright/test'

export interface MockAuthState {
  tokens: {
    access: {
      token: string
      expires: string
    }
    refresh: {
      token: string
      expires: string
    }
  } | null
  authEmail: string
  currentUser: {
    id: string
    email: string
    name: string
    role: string
    avatar: string
    phone: string
    org: string
    patients: any[]
  } | null
  inviteToken: string | null
}

export interface MockCaregiver {
  id: string
  email: string
  name: string
  role: string
  avatar: string
  phone: string
  org: string
  patients: any[]
}

export interface MockTokens {
  access: {
    token: string
    expires: string
  }
  refresh: {
    token: string
    expires: string
  }
}

/**
 * Sets up mock Redux state in localStorage
 */
export async function setupMockAuthState(page: Page, authState: Partial<MockAuthState>) {
  await page.addInitScript((state) => {
    const mockReduxState = {
      auth: {
        tokens: null,
        authEmail: '',
        currentUser: null,
        inviteToken: null,
        ...state
      }
    }
    localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
  }, authState)
}

/**
 * Creates mock tokens with specified expiration
 */
export function createMockTokens(expiresInMs: number = 3600000): MockTokens {
  const now = new Date()
  const accessExpires = new Date(now.getTime() + expiresInMs)
  const refreshExpires = new Date(now.getTime() + 7 * 24 * 3600000) // 7 days

  return {
    access: {
      token: `mock_access_token_${Date.now()}`,
      expires: accessExpires.toISOString()
    },
    refresh: {
      token: `mock_refresh_token_${Date.now()}`,
      expires: refreshExpires.toISOString()
    }
  }
}

/**
 * Creates mock caregiver data
 */
export function createMockCaregiver(overrides: Partial<MockCaregiver> = {}): MockCaregiver {
  return {
    id: `mock_caregiver_id_${Date.now()}`,
    email: 'test@example.com',
    name: 'Test User',
    role: 'staff',
    avatar: '',
    phone: '+1234567890',
    org: 'mock_org_id',
    patients: [],
    ...overrides
  }
}

/**
 * Sets up mock API routes for authentication
 */
export async function setupAuthMocks(page: Page, options: {
  loginSuccess?: boolean
  logoutSuccess?: boolean
  refreshSuccess?: boolean
  inviteVerificationSuccess?: boolean
  registerWithInviteSuccess?: boolean
} = {}) {
  const {
    loginSuccess = true,
    logoutSuccess = true,
    refreshSuccess = true,
    inviteVerificationSuccess = true,
    registerWithInviteSuccess = true
  } = options

  // Mock login endpoint
  await page.route('**/v1/auth/login', async (route) => {
    if (loginSuccess) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          org: {
            id: 'mock_org_id',
            name: 'Test Organization',
            email: 'admin@example.org'
          },
          caregiver: createMockCaregiver(),
          patients: [],
          alerts: [],
          tokens: createMockTokens()
        })
      })
    } else {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid credentials'
        })
      })
    }
  })

  // Mock logout endpoint
  await page.route('**/v1/auth/logout', async (route) => {
    if (logoutSuccess) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      })
    } else {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Logout failed'
        })
      })
    }
  })

  // Mock refresh tokens endpoint
  await page.route('**/v1/auth/refresh-tokens', async (route) => {
    if (refreshSuccess) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tokens: createMockTokens()
        })
      })
    } else {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Refresh token expired'
        })
      })
    }
  })

  // Mock invite verification endpoint
  await page.route('**/v1/orgs/verifyInvite*', async (route) => {
    if (inviteVerificationSuccess) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orgId: 'mock_org_id'
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

  // Mock register with invite endpoint
  await page.route('**/v1/auth/registerWithInvite', async (route) => {
    if (registerWithInviteSuccess) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          caregiver: createMockCaregiver(),
          tokens: createMockTokens()
        })
      })
    } else {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Registration failed'
        })
      })
    }
  })
}

/**
 * Waits for Redux state to be updated
 */
export async function waitForReduxStateUpdate(page: Page, expectedState: Partial<MockAuthState>) {
  await page.waitForFunction((expected) => {
    const state = localStorage.getItem('redux-persist:root')
    if (!state) return false
    
    const reduxState = JSON.parse(state)
    const authState = reduxState.auth
    
    // Check if expected state properties match
    for (const [key, value] of Object.entries(expected)) {
      if (authState[key] !== value) {
        return false
      }
    }
    
    return true
  }, expectedState, { timeout: 5000 })
}

/**
 * Gets current Redux auth state
 */
export async function getCurrentAuthState(page: Page): Promise<MockAuthState> {
  return await page.evaluate(() => {
    const state = localStorage.getItem('redux-persist:root')
    if (!state) return null
    return JSON.parse(state).auth
  })
}

/**
 * Clears all authentication state
 */
export async function clearAuthState(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('redux-persist:root')
  })
}

/**
 * Simulates token expiration by mocking API responses
 */
export async function simulateTokenExpiration(page: Page) {
  await page.route('**/v1/**', async (route) => {
    const headers = route.request().headers()
    const authHeader = headers['authorization']
    
    // If request has expired token, return 401
    if (authHeader && authHeader.includes('expired')) {
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
}

/**
 * Waits for navigation to complete and verifies the target screen
 * Note: React Native Web uses accessibilityLabel which maps to aria-label in the DOM
 */
export async function waitForScreen(page: Page, screenLabel: string, timeout: number = 5000) {
  await page.waitForSelector(`[aria-label="${screenLabel}"]`, { timeout })
}

/**
 * Verifies that user is properly authenticated
 */
export async function verifyAuthentication(page: Page, expectedUser?: MockCaregiver) {
  const authState = await getCurrentAuthState(page)
  
  expect(authState.tokens).not.toBeNull()
  expect(authState.currentUser).not.toBeNull()
  expect(authState.inviteToken).toBeNull()
  
  if (expectedUser) {
    expect(authState.currentUser.email).toBe(expectedUser.email)
    expect(authState.currentUser.name).toBe(expectedUser.name)
  }
}

/**
 * Verifies that user is not authenticated
 */
export async function verifyNotAuthenticated(page: Page) {
  const authState = await getCurrentAuthState(page)
  
  expect(authState.tokens).toBeNull()
  expect(authState.currentUser).toBeNull()
}

/**
 * Performs logout through the UI
 * Note: Uses aria-label selectors for React Native Web compatibility
 */
export async function performLogout(page: Page) {
  // Navigate to profile screen
  await page.goto('/profile')
  await waitForScreen(page, 'profile-screen')
  
  // Click logout button using aria-label
  await page.click('[aria-label="profile-logout-button"]')
  await waitForScreen(page, 'logout-screen')
  
  // Confirm logout
  await page.click('[aria-label="logout-button"]')
  
  // Wait for redirect to login
  await waitForScreen(page, 'login-screen')
}
