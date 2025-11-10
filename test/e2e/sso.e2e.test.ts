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

    // Mock Google OAuth flow - intercept the OAuth redirect
    // Expo AuthSession will redirect to the redirectUri with the token
    const redirectUri = await page.evaluate(() => {
      // Get the redirect URI that Expo AuthSession would use
      return window.location.origin + '/'
    })
    
    // Intercept OAuth redirects
    await page.route('**/accounts.google.com/o/oauth2/v2/auth**', async (route) => {
      // Instead of fulfilling, redirect to the callback URL with mock token
      const mockToken = 'mock_google_access_token'
      const callbackUrl = `${redirectUri}?access_token=${mockToken}&token_type=Bearer&expires_in=3600`
      await route.fulfill({
        status: 302,
        headers: { 'Location': callbackUrl }
      })
    })
    
    // Also handle the redirect callback
    page.on('framenavigated', async (frame) => {
      const url = frame.url()
      if (url.includes('access_token=')) {
        // OAuth callback received - trigger the success handler
        await page.evaluate(() => {
          window.postMessage({
            type: 'EXPO_AUTH_SESSION_SUCCESS',
            data: {
              type: 'success',
              params: {
                access_token: new URLSearchParams(window.location.search).get('access_token')
              }
            }
          }, '*')
        })
      }
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

    // Wait for login screen and SSO buttons to be visible
    await page.waitForSelector('[data-testid="login-form"], [aria-label="login-screen"]', { timeout: 10000 })
    // Wait for SSO button - it might take a moment to render
    await page.waitForTimeout(3000)
    
    // Check if SSO buttons are available
    const googleSSOButton = page.locator('[data-testid="google-sso-button"]').first()
    const buttonCount = await googleSSOButton.count()
    
    if (buttonCount === 0) {
      test.skip(true, 'SSO buttons not available - SSO may not be configured')
      return
    }
    
    await googleSSOButton.waitFor({ timeout: 10000, state: 'visible' })
    
    // Click Google SSO button
    await googleSSOButton.click()

    // Wait for SSO flow to complete - this may take time as it opens a browser window
    // Wait for either profile screen (unverified users) or home screen (verified users)
    // Also wait for the backend API call to complete
    await page.waitForTimeout(5000) // Give time for OAuth flow
    
    // Check for navigation - could be profile screen, home screen, or still on login
    const profileScreen = page.locator('[data-testid="profile-screen"], [aria-label="profile-screen"]')
    const homeScreen = page.locator('[data-testid="home-header"], [aria-label="home-header"], [aria-label="profile-button"]')
    
    // Wait for either screen to appear
    await Promise.race([
      profileScreen.waitFor({ timeout: 15000, state: 'visible' }).catch(() => null),
      homeScreen.waitFor({ timeout: 15000, state: 'visible' }).catch(() => null),
    ])
    
    // Verify we're not still on login screen
    const loginScreen = page.locator('[data-testid="login-form"], [aria-label="login-screen"]')
    const stillOnLogin = await loginScreen.isVisible().catch(() => false)
    
    if (stillOnLogin) {
      // Check if there's an error message
      const errorMessage = page.locator('text=/SSO|error|failed/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      if (hasError) {
        const errorText = await errorMessage.textContent().catch(() => '')
        throw new Error(`SSO login failed with error: ${errorText}`)
      }
      throw new Error('SSO login did not complete - still on login screen after timeout')
    }
    
    // For unverified users, we should be on profile screen
    const isProfileVisible = await profileScreen.isVisible().catch(() => false)
    if (!isProfileVisible) {
      // Might be on home screen if user is verified - that's also valid
      const isHomeVisible = await homeScreen.isVisible().catch(() => false)
      if (!isHomeVisible) {
        throw new Error('SSO login completed but did not navigate to expected screen')
      }
    }

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

    // Wait for login screen and SSO buttons to be visible
    await page.waitForSelector('[data-testid="login-form"], [aria-label="login-screen"]', { timeout: 10000 })
    // Wait for SSO button - it might take a moment to render
    await page.waitForTimeout(3000)
    
    // Check if SSO buttons are available
    const microsoftSSOButton = page.locator('[data-testid="microsoft-sso-button"]').first()
    const buttonCount = await microsoftSSOButton.count()
    
    if (buttonCount === 0) {
      test.skip(true, 'SSO buttons not available - SSO may not be configured')
      return
    }
    
    await microsoftSSOButton.waitFor({ timeout: 10000, state: 'visible' })
    
    // Click Microsoft SSO button
    await microsoftSSOButton.click()

    // Wait for SSO flow to complete - this may take time as it opens a browser window
    await page.waitForTimeout(5000) // Give time for OAuth flow
    
    // Check for navigation - could be profile screen, home screen, or still on login
    const profileScreen = page.locator('[data-testid="profile-screen"], [aria-label="profile-screen"]')
    const homeScreen = page.locator('[data-testid="home-header"], [aria-label="home-header"], [aria-label="profile-button"]')
    
    // Wait for either screen to appear
    await Promise.race([
      profileScreen.waitFor({ timeout: 15000, state: 'visible' }).catch(() => null),
      homeScreen.waitFor({ timeout: 15000, state: 'visible' }).catch(() => null),
    ])
    
    // Verify we're not still on login screen
    const loginScreen = page.locator('[data-testid="login-form"], [aria-label="login-screen"]')
    const stillOnLogin = await loginScreen.isVisible().catch(() => false)
    
    if (stillOnLogin) {
      // Check if there's an error message
      const errorMessage = page.locator('text=/SSO|error|failed/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      if (hasError) {
        const errorText = await errorMessage.textContent().catch(() => '')
        throw new Error(`SSO login failed with error: ${errorText}`)
      }
      throw new Error('SSO login did not complete - still on login screen after timeout')
    }
    
    // For unverified users, we should be on profile screen
    const isProfileVisible = await profileScreen.isVisible().catch(() => false)
    if (!isProfileVisible) {
      // Might be on home screen if user is verified - that's also valid
      const isHomeVisible = await homeScreen.isVisible().catch(() => false)
      if (!isHomeVisible) {
        throw new Error('SSO login completed but did not navigate to expected screen')
      }
    }

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

    // Wait for login screen and SSO buttons to be visible
    await page.waitForSelector('[data-testid="login-form"], [aria-label="login-screen"]', { timeout: 10000 })
    // Wait for SSO button - it might take a moment to render
    await page.waitForTimeout(3000)
    
    // Check if SSO buttons are available
    const googleSSOButton = page.locator('[data-testid="google-sso-button"]').first()
    const buttonCount = await googleSSOButton.count()
    
    if (buttonCount === 0) {
      test.skip(true, 'SSO buttons not available - SSO may not be configured')
      return
    }
    
    await googleSSOButton.waitFor({ timeout: 10000, state: 'visible' })
    
    // Click Google SSO button
    await googleSSOButton.click()

    // Should see error message
    await expect(page.getByText('SSO login failed: SSO authentication failed')).toBeVisible()

    // Should still be on login screen
    await expect(page.getByTestId('email-input')).toBeVisible()
  })
})
