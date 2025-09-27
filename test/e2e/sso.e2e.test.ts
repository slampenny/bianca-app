import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData } from './fixtures/testData'

test.describe('SSO Authentication Workflow', () => {
  let testData: ReturnType<typeof generateUniqueTestData>

  test.beforeEach(() => {
    testData = generateUniqueTestData('sso')
  })

  test('Google SSO login flow with profile completion', async ({ page }) => {
    // Navigate to login page
    await page.goto('/')
    await page.waitForSelector('[data-testid="email-input"]')

    // Mock Google OAuth flow
    await page.route('**/accounts.google.com/o/oauth2/v2/auth**', async (route) => {
      // Simulate successful OAuth response
      const mockOAuthResponse = {
        type: 'success',
        params: {
          access_token: 'mock_google_access_token',
        }
      }
      
      // Mock the OAuth callback
      await page.evaluate((response) => {
        // Simulate the OAuth callback being processed
        window.postMessage({
          type: 'EXPO_AUTH_SESSION_SUCCESS',
          data: response
        }, '*')
      }, mockOAuthResponse)
      
      route.fulfill({ status: 200 })
    })

    // Mock Google user info API
    await page.route('**/www.googleapis.com/oauth2/v2/userinfo**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock_google_id',
          email: testData.email,
          name: testData.name,
          picture: 'https://example.com/avatar.jpg'
        })
      })
    })

    // Mock backend SSO login
    await page.route('**/v1/sso/login', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'SSO login successful',
          tokens: {
            access: {
              token: 'mock_access_token',
              expires: new Date(Date.now() + 3600000).toISOString()
            },
            refresh: {
              token: 'mock_refresh_token',
              expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
            }
          },
          user: {
            id: 'mock_user_id',
            email: testData.email,
            name: testData.name,
            role: 'unverified',
            avatar: 'https://example.com/avatar.jpg',
            phone: '',
            org: 'mock_org_id',
            patients: []
          }
        })
      })
    })

    // Click Google SSO button
    await page.getByTestId('google-sso-button').click()

    // Wait for profile screen (unverified users are redirected here)
    await page.waitForSelector('[data-testid="profile-screen"]', { timeout: 10000 })

    // Verify unverified banner is shown
    await expect(page.getByText('Complete Your Profile')).toBeVisible()
    await expect(page.getByText('Please add your phone number to complete your profile and access all features.')).toBeVisible()

    // Try to navigate away - should be blocked
    await page.getByTestId('home-tab').click()
    
    // Should see alert about completing profile
    await expect(page.getByText('Complete Your Profile')).toBeVisible()
    await expect(page.getByText('Please complete your profile by adding a phone number before continuing.')).toBeVisible()
    
    // Dismiss alert
    await page.getByRole('button', { name: 'OK' }).click()

    // Complete profile by adding phone number
    await page.getByTestId('phone-input').fill(testData.phone)
    await page.getByTestId('update-profile-button').click()

    // Mock successful profile update
    await page.route('**/v1/caregivers/*', async (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock_user_id',
            email: testData.email,
            name: testData.name,
            role: 'orgAdmin', // User is now promoted
            avatar: 'https://example.com/avatar.jpg',
            phone: testData.phone,
            org: 'mock_org_id',
            patients: []
          })
        })
      } else {
        route.continue()
      }
    })

    // Wait for success message
    await expect(page.getByText('Your profile was updated successfully!')).toBeVisible()

    // Now should be able to navigate away
    await page.getByTestId('home-tab').click()
    await page.waitForSelector('[data-testid="home-header"]')
  })

  test('Microsoft SSO login flow', async ({ page }) => {
    // Navigate to login page
    await page.goto('/')
    await page.waitForSelector('[data-testid="email-input"]')

    // Mock Microsoft OAuth flow
    await page.route('**/login.microsoftonline.com/**/oauth2/v2.0/authorize**', async (route) => {
      // Simulate successful OAuth response
      const mockOAuthResponse = {
        type: 'success',
        params: {
          access_token: 'mock_microsoft_access_token',
        }
      }
      
      // Mock the OAuth callback
      await page.evaluate((response) => {
        window.postMessage({
          type: 'EXPO_AUTH_SESSION_SUCCESS',
          data: response
        }, '*')
      }, mockOAuthResponse)
      
      route.fulfill({ status: 200 })
    })

    // Mock Microsoft Graph API
    await page.route('**/graph.microsoft.com/v1.0/me**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock_microsoft_id',
          mail: testData.email,
          displayName: testData.name,
          userPrincipalName: testData.email
        })
      })
    })

    // Mock backend SSO login
    await page.route('**/v1/sso/login', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'SSO login successful',
          tokens: {
            access: {
              token: 'mock_access_token',
              expires: new Date(Date.now() + 3600000).toISOString()
            },
            refresh: {
              token: 'mock_refresh_token',
              expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
            }
          },
          user: {
            id: 'mock_user_id',
            email: testData.email,
            name: testData.name,
            role: 'unverified',
            avatar: '',
            phone: '',
            org: 'mock_org_id',
            patients: []
          }
        })
      })
    })

    // Click Microsoft SSO button
    await page.getByTestId('microsoft-sso-button').click()

    // Wait for profile screen
    await page.waitForSelector('[data-testid="profile-screen"]', { timeout: 10000 })

    // Verify unverified banner is shown
    await expect(page.getByText('Complete Your Profile')).toBeVisible()
  })

  test('SSO logout flow', async ({ page }) => {
    // First login with SSO (reuse the setup from previous test)
    await page.goto('/')
    await page.waitForSelector('[data-testid="email-input"]')

    // Mock successful SSO login
    await page.route('**/v1/sso/login', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'SSO login successful',
          tokens: {
            access: {
              token: 'mock_access_token',
              expires: new Date(Date.now() + 3600000).toISOString()
            },
            refresh: {
              token: 'mock_refresh_token',
              expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
            }
          },
          user: {
            id: 'mock_user_id',
            email: testData.email,
            name: testData.name,
            role: 'orgAdmin',
            avatar: 'https://example.com/avatar.jpg',
            phone: testData.phone,
            org: 'mock_org_id',
            patients: []
          }
        })
      })
    })

    // Mock Google OAuth flow
    await page.route('**/accounts.google.com/o/oauth2/v2/auth**', async (route) => {
      const mockOAuthResponse = {
        type: 'success',
        params: {
          access_token: 'mock_google_access_token',
        }
      }
      
      await page.evaluate((response) => {
        window.postMessage({
          type: 'EXPO_AUTH_SESSION_SUCCESS',
          data: response
        }, '*')
      }, mockOAuthResponse)
      
      route.fulfill({ status: 200 })
    })

    // Mock Google user info API
    await page.route('**/www.googleapis.com/oauth2/v2/userinfo**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock_google_id',
          email: testData.email,
          name: testData.name,
          picture: 'https://example.com/avatar.jpg'
        })
      })
    })

    // Login with Google SSO
    await page.getByTestId('google-sso-button').click()
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Navigate to profile screen
    await page.getByTestId('profile-tab').click()
    await page.waitForSelector('[data-testid="profile-screen"]')

    // Mock successful logout
    await page.route('**/v1/auth/logout', async (route) => {
      route.fulfill({
        status: 204,
        body: ''
      })
    })

    // Click logout button
    await page.getByTestId('logout-button').click()

    // Should be redirected to logout confirmation screen
    await page.waitForSelector('[data-testid="logout-screen"]')

    // Confirm logout
    await page.getByTestId('confirm-logout-button').click()

    // Should be redirected back to login screen
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })

    // Verify we're back on login screen
    await expect(page.getByTestId('email-input')).toBeVisible()
    await expect(page.getByTestId('password-input')).toBeVisible()
  })

  test('SSO error handling', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="email-input"]')

    // Mock SSO login failure
    await page.route('**/v1/sso/login', async (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'SSO authentication failed'
        })
      })
    })

    // Mock Google OAuth flow
    await page.route('**/accounts.google.com/o/oauth2/v2/auth**', async (route) => {
      const mockOAuthResponse = {
        type: 'success',
        params: {
          access_token: 'mock_google_access_token',
        }
      }
      
      await page.evaluate((response) => {
        window.postMessage({
          type: 'EXPO_AUTH_SESSION_SUCCESS',
          data: response
        }, '*')
      }, mockOAuthResponse)
      
      route.fulfill({ status: 200 })
    })

    // Mock Google user info API
    await page.route('**/www.googleapis.com/oauth2/v2/userinfo**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock_google_id',
          email: testData.email,
          name: testData.name,
          picture: 'https://example.com/avatar.jpg'
        })
      })
    })

    // Click Google SSO button
    await page.getByTestId('google-sso-button').click()

    // Should see error message
    await expect(page.getByText('SSO login failed: SSO authentication failed')).toBeVisible()

    // Should still be on login screen
    await expect(page.getByTestId('email-input')).toBeVisible()
  })
})
