import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData, TEST_USERS } from './fixtures/testData'

test.describe('Invited User Authentication Workflow', () => {
  let testData: ReturnType<typeof generateUniqueTestData>
  let inviteToken: string

  test.beforeEach(() => {
    testData = generateUniqueTestData('invite')
    inviteToken = `mock_invite_token_${Date.now()}`
  })

  test.describe('Invited User Profile Screen Issues', () => {
    test('Invited user gets stuck on profile screen without credentials', async ({ page }) => {
      // Mock localStorage with invite token but no current user
      await page.addInitScript((token) => {
        // Simulate Redux state with invite token but no authenticated user
        const mockReduxState = {
          auth: {
            tokens: null,
            authEmail: '',
            currentUser: null,
            inviteToken: token
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      }, inviteToken)

      // Navigate to profile screen (this happens when user returns to app)
      await page.goto('/profile')
      
      // Should see the error message for unauthenticated users
      await expect(page.getByText('Error: Please authenticate')).toBeVisible()
      await expect(page.getByText('Please log in to access your profile.')).toBeVisible()
      
      // Should see the "Go to Login" button
      const goToLoginButton = page.getByTestId('go-to-login-button')
      await expect(goToLoginButton).toBeVisible()
      
      // Click the "Go to Login" button
      await goToLoginButton.click()
      
      // Should be redirected to login screen
      await page.waitForSelector('[data-testid="email-input"]', { timeout: 5000 })
      await expect(page.getByTestId('login-screen')).toBeVisible()
    })

    test('Invited user with invite token gets redirected to signup', async ({ page }) => {
      // Mock localStorage with invite token
      await page.addInitScript((token) => {
        const mockReduxState = {
          auth: {
            tokens: null,
            authEmail: '',
            currentUser: null,
            inviteToken: token
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      }, inviteToken)

      // Navigate to profile screen
      await page.goto('/profile')
      
      // Should be redirected to signup screen with token
      await page.waitForSelector('[data-testid="signup-screen"]', { timeout: 5000 })
      
      // Verify the invite token is stored in Redux
      const reduxState = await page.evaluate(() => {
        const state = localStorage.getItem('redux-persist:root')
        return state ? JSON.parse(state) : null
      })
      
      expect(reduxState.auth.inviteToken).toBe(inviteToken)
    })

    test('Invited user can complete signup and access profile', async ({ page }) => {
      // Mock localStorage with invite token
      await page.addInitScript((token) => {
        const mockReduxState = {
          auth: {
            tokens: null,
            authEmail: '',
            currentUser: null,
            inviteToken: token
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      }, inviteToken)

      // Mock invite token verification
      await page.route('**/v1/orgs/verifyInvite*', async (route) => {
        const url = new URL(route.request().url())
        const token = url.searchParams.get('token')
        
        if (token === inviteToken) {
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

      // Navigate to profile screen (should redirect to signup)
      await page.goto('/profile')
      await page.waitForSelector('[data-testid="signup-screen"]', { timeout: 5000 })

      // Fill in signup form
      await page.getByTestId('signup-password-input').fill('StrongPassword123!')
      await page.getByTestId('signup-confirm-password-input').fill('StrongPassword123!')

      // Mock successful signup
      await page.route('**/v1/auth/registerWithInvite', async (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: 'mock_new_caregiver_id',
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
                token: 'mock_new_user_access_token',
                expires: new Date(Date.now() + 3600000).toISOString()
              },
              refresh: {
                token: 'mock_new_user_refresh_token',
                expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
              }
            }
          })
        })
      })

      // Submit signup
      await page.getByTestId('signup-submit-button').click()

      // Should be redirected to home screen
      await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
      
      // Verify user is authenticated
      await expect(page.getByTestId('home-header')).toBeVisible()
      
      // Navigate to profile to verify access
      await page.getByTestId('profile-button').click()
      await page.waitForSelector('[data-testid="profile-screen"]')
      
      // Should see profile content, not error message
      await expect(page.getByText('Error: Please authenticate')).not.toBeVisible()
    })
  })

  test.describe('Logout Functionality Issues', () => {
    test('Logout button does nothing when tokens are expired', async ({ page }) => {
      // Mock localStorage with expired tokens but current user still in state
      await page.addInitScript(() => {
        const expiredTime = new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        const mockReduxState = {
          auth: {
            tokens: {
              access: {
                token: 'expired_access_token',
                expires: expiredTime
              },
              refresh: {
                token: 'expired_refresh_token',
                expires: expiredTime
              }
            },
            authEmail: testData.email,
            currentUser: {
              id: 'mock_user_id',
              email: testData.email,
              name: testData.name,
              role: 'staff',
              avatar: '',
              phone: testData.phone,
              org: 'mock_org_id',
              patients: []
            },
            inviteToken: null
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      })

      // Mock API calls to return 401 for expired tokens
      await page.route('**/v1/**', async (route) => {
        if (route.request().headers()['authorization']?.includes('expired_access_token')) {
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

      // Navigate to profile screen
      await page.goto('/profile')
      
      // Should see profile content (currentUser is in Redux state)
      await page.waitForSelector('[data-testid="profile-screen"]')
      
      // Click logout button
      const logoutButton = page.getByTestId('profile-logout-button')
      await expect(logoutButton).toBeVisible()
      await logoutButton.click()
      
      // Should navigate to logout screen
      await page.waitForSelector('[data-testid="logout-screen"]')
      
      // Click the actual logout button
      const confirmLogoutButton = page.getByTestId('logout-button')
      await expect(confirmLogoutButton).toBeVisible()
      await confirmLogoutButton.click()
      
      // Mock logout API call to fail due to expired refresh token
      await page.route('**/v1/auth/logout', async (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Refresh token expired'
          })
        })
      })

      // Wait for any API calls to complete
      await page.waitForTimeout(1000)
      
      // Even if logout API fails, the local state should be cleared
      // Check that we're redirected to login screen
      await page.waitForSelector('[data-testid="login-screen"]', { timeout: 5000 })
      
      // Verify Redux state is cleared
      const reduxState = await page.evaluate(() => {
        const state = localStorage.getItem('redux-persist:root')
        return state ? JSON.parse(state) : null
      })
      
      expect(reduxState.auth.tokens).toBeNull()
      expect(reduxState.auth.currentUser).toBeNull()
    })

    test('Logout button works correctly with valid tokens', async ({ page }) => {
      // Mock localStorage with valid tokens and current user
      await page.addInitScript(() => {
        const validTime = new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        const mockReduxState = {
          auth: {
            tokens: {
              access: {
                token: 'valid_access_token',
                expires: validTime
              },
              refresh: {
                token: 'valid_refresh_token',
                expires: validTime
              }
            },
            authEmail: testData.email,
            currentUser: {
              id: 'mock_user_id',
              email: testData.email,
              name: testData.name,
              role: 'staff',
              avatar: '',
              phone: testData.phone,
              org: 'mock_org_id',
              patients: []
            },
            inviteToken: null
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      })

      // Mock successful logout API call
      await page.route('**/v1/auth/logout', async (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({})
        })
      })

      // Navigate to profile screen
      await page.goto('/profile')
      await page.waitForSelector('[data-testid="profile-screen"]')
      
      // Click logout button
      await page.getByTestId('profile-logout-button').click()
      await page.waitForSelector('[data-testid="logout-screen"]')
      
      // Click confirm logout
      await page.getByTestId('logout-button').click()
      
      // Should be redirected to login screen
      await page.waitForSelector('[data-testid="login-screen"]', { timeout: 5000 })
      
      // Verify Redux state is cleared
      const reduxState = await page.evaluate(() => {
        const state = localStorage.getItem('redux-persist:root')
        return state ? JSON.parse(state) : null
      })
      
      expect(reduxState.auth.tokens).toBeNull()
      expect(reduxState.auth.currentUser).toBeNull()
    })

    test('Logout button handles network errors gracefully', async ({ page }) => {
      // Mock localStorage with valid tokens
      await page.addInitScript(() => {
        const validTime = new Date(Date.now() + 3600000).toISOString()
        const mockReduxState = {
          auth: {
            tokens: {
              access: {
                token: 'valid_access_token',
                expires: validTime
              },
              refresh: {
                token: 'valid_refresh_token',
                expires: validTime
              }
            },
            authEmail: testData.email,
            currentUser: {
              id: 'mock_user_id',
              email: testData.email,
              name: testData.name,
              role: 'staff',
              avatar: '',
              phone: testData.phone,
              org: 'mock_org_id',
              patients: []
            },
            inviteToken: null
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      })

      // Mock logout API call to fail with network error
      await page.route('**/v1/auth/logout', async (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Internal server error'
          })
        })
      })

      // Navigate to profile screen
      await page.goto('/profile')
      await page.waitForSelector('[data-testid="profile-screen"]')
      
      // Click logout button
      await page.getByTestId('profile-logout-button').click()
      await page.waitForSelector('[data-testid="logout-screen"]')
      
      // Click confirm logout
      await page.getByTestId('logout-button').click()
      
      // Even with network error, should clear local state and redirect to login
      await page.waitForSelector('[data-testid="login-screen"]', { timeout: 5000 })
      
      // Verify Redux state is cleared despite API failure
      const reduxState = await page.evaluate(() => {
        const state = localStorage.getItem('redux-persist:root')
        return state ? JSON.parse(state) : null
      })
      
      expect(reduxState.auth.tokens).toBeNull()
      expect(reduxState.auth.currentUser).toBeNull()
    })
  })

  test.describe('Token Expiration Scenarios', () => {
    test('User can navigate app with expired tokens but currentUser in state', async ({ page }) => {
      // Mock localStorage with expired tokens but currentUser still persisted
      await page.addInitScript(() => {
        const expiredTime = new Date(Date.now() - 3600000).toISOString()
        const mockReduxState = {
          auth: {
            tokens: {
              access: {
                token: 'expired_access_token',
                expires: expiredTime
              },
              refresh: {
                token: 'expired_refresh_token',
                expires: expiredTime
              }
            },
            authEmail: testData.email,
            currentUser: {
              id: 'mock_user_id',
              email: testData.email,
              name: testData.name,
              role: 'staff',
              avatar: '',
              phone: testData.phone,
              org: 'mock_org_id',
              patients: []
            },
            inviteToken: null
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      })

      // Mock all API calls to return 401 for expired tokens
      await page.route('**/v1/**', async (route) => {
        if (route.request().headers()['authorization']?.includes('expired_access_token')) {
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

      // User can still navigate to different screens because currentUser is in Redux
      await page.goto('/')
      await expect(page.getByTestId('home-header')).toBeVisible()
      
      await page.goto('/profile')
      await expect(page.getByTestId('profile-screen')).toBeVisible()
      
      await page.goto('/alerts')
      await expect(page.getByTestId('alerts-screen')).toBeVisible()
      
      // But any API calls should fail
      await page.waitForTimeout(1000)
      
      // Check console for 401 errors (if any API calls were made)
      const consoleLogs = await page.evaluate(() => {
        return window.consoleLogs || []
      })
      
      // API calls should fail but UI navigation should still work
      // This demonstrates the problem: user can navigate but can't perform actions
    })

    test('Token refresh attempt fails and user is logged out', async ({ page }) => {
      // Mock localStorage with tokens that are about to expire
      await page.addInitScript(() => {
        const soonToExpireTime = new Date(Date.now() + 5000).toISOString() // 5 seconds from now
        const mockReduxState = {
          auth: {
            tokens: {
              access: {
                token: 'soon_to_expire_access_token',
                expires: soonToExpireTime
              },
              refresh: {
                token: 'valid_refresh_token',
                expires: new Date(Date.now() + 3600000).toISOString()
              }
            },
            authEmail: testData.email,
            currentUser: {
              id: 'mock_user_id',
              email: testData.email,
              name: testData.name,
              role: 'staff',
              avatar: '',
              phone: testData.phone,
              org: 'mock_org_id',
              patients: []
            },
            inviteToken: null
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      })

      // Mock refresh token API to fail
      await page.route('**/v1/auth/refresh-tokens', async (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Refresh token expired'
          })
        })
      })

      // Navigate to any screen
      await page.goto('/profile')
      
      // Wait for token refresh attempt
      await page.waitForTimeout(10000)
      
      // Should be redirected to login screen after failed refresh
      await page.waitForSelector('[data-testid="login-screen"]', { timeout: 5000 })
      
      // Verify Redux state is cleared
      const reduxState = await page.evaluate(() => {
        const state = localStorage.getItem('redux-persist:root')
        return state ? JSON.parse(state) : null
      })
      
      expect(reduxState.auth.tokens).toBeNull()
      expect(reduxState.auth.currentUser).toBeNull()
    })

    test('User returns to app after session expired and gets proper error', async ({ page }) => {
      // Simulate user returning to app after their session expired
      // No tokens in localStorage, but currentUser might still be there from before
      await page.addInitScript(() => {
        const mockReduxState = {
          auth: {
            tokens: null,
            authEmail: testData.email,
            currentUser: {
              id: 'mock_user_id',
              email: testData.email,
              name: testData.name,
              role: 'staff',
              avatar: '',
              phone: testData.phone,
              org: 'mock_org_id',
              patients: []
            },
            inviteToken: null
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      })

      // Navigate to profile screen
      await page.goto('/profile')
      
      // Should see authentication error since no tokens
      await expect(page.getByText('Error: Please authenticate')).toBeVisible()
      await expect(page.getByText('Please log in to access your profile.')).toBeVisible()
      
      // Click "Go to Login" button
      await page.getByTestId('go-to-login-button').click()
      
      // Should be redirected to login screen
      await page.waitForSelector('[data-testid="login-screen"]', { timeout: 5000 })
    })
  })

  test.describe('Invite Token Persistence', () => {
    test('Invite token persists across navigation', async ({ page }) => {
      // Mock localStorage with invite token
      await page.addInitScript((token) => {
        const mockReduxState = {
          auth: {
            tokens: null,
            authEmail: '',
            currentUser: null,
            inviteToken: token
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      }, inviteToken)

      // Navigate to different screens
      await page.goto('/')
      
      // Should be redirected to signup screen
      await page.waitForSelector('[data-testid="signup-screen"]', { timeout: 5000 })
      
      // Navigate away and back
      await page.goto('/profile')
      await page.waitForSelector('[data-testid="signup-screen"]', { timeout: 5000 })
      
      // Verify invite token is still in Redux
      const reduxState = await page.evaluate(() => {
        const state = localStorage.getItem('redux-persist:root')
        return state ? JSON.parse(state) : null
      })
      
      expect(reduxState.auth.inviteToken).toBe(inviteToken)
    })

    test('Invite token is cleared after successful registration', async ({ page }) => {
      // Mock localStorage with invite token
      await page.addInitScript((token) => {
        const mockReduxState = {
          auth: {
            tokens: null,
            authEmail: '',
            currentUser: null,
            inviteToken: token
          }
        }
        localStorage.setItem('redux-persist:root', JSON.stringify(mockReduxState))
      }, inviteToken)

      // Mock invite token verification
      await page.route('**/v1/orgs/verifyInvite*', async (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: 'mock_org_id'
          })
        })
      })

      // Navigate to signup screen
      await page.goto('/signup')
      await page.waitForSelector('[data-testid="signup-screen"]')

      // Fill in signup form
      await page.getByTestId('signup-password-input').fill('StrongPassword123!')
      await page.getByTestId('signup-confirm-password-input').fill('StrongPassword123!')

      // Mock successful registration
      await page.route('**/v1/auth/registerWithInvite', async (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: 'mock_new_caregiver_id',
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
                token: 'mock_new_user_access_token',
                expires: new Date(Date.now() + 3600000).toISOString()
              },
              refresh: {
                token: 'mock_new_user_refresh_token',
                expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
              }
            }
          })
        })
      })

      // Submit signup
      await page.getByTestId('signup-submit-button').click()

      // Should be redirected to home screen
      await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

      // Verify invite token is cleared from Redux
      const reduxState = await page.evaluate(() => {
        const state = localStorage.getItem('redux-persist:root')
        return state ? JSON.parse(state) : null
      })
      
      expect(reduxState.auth.inviteToken).toBeNull()
      expect(reduxState.auth.currentUser).not.toBeNull()
      expect(reduxState.auth.tokens).not.toBeNull()
    })
  })
})
