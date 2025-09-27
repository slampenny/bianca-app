import { test, expect, Page, BrowserContext } from '@playwright/test'
import { generateUniqueTestData, TEST_USERS } from './fixtures/testData'
import { setupEmailTesting, simulateInviteWorkflow } from './helpers/emailTestHelpers'

test.describe('SSO and Invite Integration Workflow', () => {
  let testData: ReturnType<typeof generateUniqueTestData>

  test.beforeEach(() => {
    testData = generateUniqueTestData('integration')
  })

  test('Complete workflow: SSO admin invites user, user completes registration', async ({ page, context }) => {
    // Step 1: Admin logs in via SSO
    await page.goto('/')
    await page.waitForSelector('[data-testid="email-input"]')

    // Mock Google SSO flow for admin
    await page.route('**/accounts.google.com/o/oauth2/v2/auth**', async (route) => {
      const mockOAuthResponse = {
        type: 'success',
        params: {
          access_token: 'mock_admin_google_token',
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

    // Mock Google user info for admin
    await page.route('**/www.googleapis.com/oauth2/v2/userinfo**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock_admin_google_id',
          email: TEST_USERS.ORG_ADMIN.email,
          name: TEST_USERS.ORG_ADMIN.name,
          picture: 'https://example.com/admin-avatar.jpg'
        })
      })
    })

    // Mock SSO login for admin
    await page.route('**/v1/sso/login', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'SSO login successful',
          tokens: {
            access: {
              token: 'mock_admin_access_token',
              expires: new Date(Date.now() + 3600000).toISOString()
            },
            refresh: {
              token: 'mock_admin_refresh_token',
              expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
            }
          },
          user: {
            id: 'mock_admin_id',
            email: TEST_USERS.ORG_ADMIN.email,
            name: TEST_USERS.ORG_ADMIN.name,
            role: 'orgAdmin',
            avatar: 'https://example.com/admin-avatar.jpg',
            phone: TEST_USERS.ORG_ADMIN.phone,
            org: 'mock_org_id',
            patients: []
          }
        })
      })
    })

    // Admin logs in via Google SSO
    await page.getByTestId('google-sso-button').click()
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Step 2: Admin navigates to Organization screen
    await page.getByTestId('organization-tab').click()
    await page.waitForSelector('[data-testid="org-screen"]')

    // Set up email testing
    const emailHelper = await setupEmailTesting(page)

    // Step 3: Click "Invite Caregiver" button
    await page.getByTestId('invite-caregiver-button').click()
    await page.waitForSelector('[data-testid="caregiver-screen"]')

    // Step 4: Fill in caregiver details
    await page.getByTestId('caregiver-name-input').fill(testData.name)
    await page.getByTestId('caregiver-email-input').fill(testData.email)
    await page.getByTestId('caregiver-phone-input').fill(testData.phone)

    // Step 5: Send the invite
    await page.getByTestId('send-invite-button').click()

    // Step 6: Verify success screen
    await page.waitForSelector('[data-testid="caregiver-invited-screen"]')
    await expect(page.getByText('Invitation Sent!')).toBeVisible()

    // Step 7: Get the email and simulate clicking the link
    const email = emailHelper.getLatestEmail(testData.email)
    expect(email).toBeTruthy()
    expect(email!.links).toHaveLength(1)

    // Create new page for invitee
    const inviteePage = await context.newPage()

    // Mock invite token verification
    await inviteePage.route('**/v1/orgs/verifyInvite*', async (route) => {
      const url = new URL(route.request().url())
      const token = url.searchParams.get('token')
      
      if (token) {
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
            message: 'Invalid invite token'
          })
        })
      }
    })

    // Navigate to signup page with invite token
    await inviteePage.goto(email!.links[0])
    await inviteePage.waitForSelector('[data-testid="signup-screen"]')

    // Step 4: Complete registration
    await inviteePage.getByTestId('register-name').fill(testData.name)
    await inviteePage.getByTestId('register-password').fill('StrongPassword123!')
    await inviteePage.getByTestId('register-confirm-password').fill('StrongPassword123!')
    await inviteePage.getByTestId('register-phone').fill(testData.phone)

    // Mock successful registration
    await inviteePage.route('**/v1/auth/registerWithInvite', async (route) => {
      route.fulfill({
        status: 201,
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

    // Submit registration
    await inviteePage.getByTestId('register-submit').click()

    // Step 5: Verify new user is logged in
    await inviteePage.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
    await expect(inviteePage.getByTestId('home-header')).toBeVisible()

    // Step 6: Verify admin can see the new user in caregivers list
    await page.getByTestId('caregivers-tab').click()
    await page.waitForSelector('[data-testid="caregivers-screen"]')

    // Mock caregivers list API to include the new user
    await page.route('**/v1/caregivers**', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 'mock_admin_id',
              email: TEST_USERS.ORG_ADMIN.email,
              name: TEST_USERS.ORG_ADMIN.name,
              role: 'orgAdmin',
              avatar: 'https://example.com/admin-avatar.jpg',
              phone: TEST_USERS.ORG_ADMIN.phone,
              org: 'mock_org_id',
              patients: []
            },
            {
              id: 'mock_new_caregiver_id',
              email: testData.email,
              name: testData.name,
              role: 'staff',
              avatar: '',
              phone: testData.phone,
              org: 'mock_org_id',
              patients: []
            }
          ],
          totalResults: 2,
          totalPages: 1,
          page: 1,
          limit: 10
        })
      })
    })

    // Refresh the caregivers list
    await page.reload()
    await page.waitForSelector('[data-testid="caregivers-screen"]')

    // Verify the new user appears in the list
    await expect(page.getByText(testData.name)).toBeVisible()
    await expect(page.getByText(testData.email)).toBeVisible()

    // Clean up
    await inviteePage.close()
  })

  test('SSO user with unverified role cannot send invites', async ({ page }) => {
    // Step 1: New user logs in via SSO (gets unverified role)
    await page.goto('/')
    await page.waitForSelector('[data-testid="email-input"]')

    // Mock Google SSO flow
    await page.route('**/accounts.google.com/o/oauth2/v2/auth**', async (route) => {
      const mockOAuthResponse = {
        type: 'success',
        params: {
          access_token: 'mock_google_token',
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

    // Mock Google user info
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

    // Mock SSO login with unverified role
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

    // User logs in via Google SSO
    await page.getByTestId('google-sso-button').click()

    // Step 2: User is redirected to profile screen
    await page.waitForSelector('[data-testid="profile-screen"]', { timeout: 10000 })

    // Verify unverified banner is shown
    await expect(page.getByText('Complete Your Profile')).toBeVisible()

    // Step 3: Try to navigate to caregivers tab
    await page.getByTestId('caregivers-tab').click()

    // Should be blocked and see alert
    await expect(page.getByText('Complete Your Profile')).toBeVisible()
    await expect(page.getByText('Please complete your profile by adding a phone number before continuing.')).toBeVisible()

    // Dismiss alert
    await page.getByRole('button', { name: 'OK' }).click()

    // Step 4: Complete profile
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

    // Step 5: Now should be able to access caregivers tab
    await page.getByTestId('caregivers-tab').click()
    await page.waitForSelector('[data-testid="caregivers-screen"]')

    // Should now be able to send invites
    await expect(page.getByTestId('invite-caregiver-button')).toBeVisible()
  })

  test('Invited user can later use SSO to log in', async ({ page, context }) => {
    // Step 1: Admin invites user (simplified version)
    await page.goto('/')
    await page.waitForSelector('[data-testid="email-input"]')

    // Mock admin login
    await page.route('**/v1/auth/login', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          org: {
            id: 'mock_org_id',
            name: 'Test Organization',
            email: 'admin@example.org'
          },
          caregiver: {
            id: 'mock_admin_id',
            email: TEST_USERS.ORG_ADMIN.email,
            name: TEST_USERS.ORG_ADMIN.name,
            role: 'orgAdmin',
            avatar: '',
            phone: TEST_USERS.ORG_ADMIN.phone,
            org: 'mock_org_id',
            patients: []
          },
          patients: [],
          alerts: [],
          tokens: {
            access: {
              token: 'mock_admin_access_token',
              expires: new Date(Date.now() + 3600000).toISOString()
            },
            refresh: {
              token: 'mock_admin_refresh_token',
              expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
            }
          }
        })
      })
    })

    // Login as admin
    await page.getByTestId('email-input').fill(TEST_USERS.ORG_ADMIN.email)
    await page.getByTestId('password-input').fill(TEST_USERS.ORG_ADMIN.password)
    await page.getByTestId('login-button').click()
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Send invite
    await page.getByTestId('caregivers-tab').click()
    await page.waitForSelector('[data-testid="caregivers-screen"]')

    const emailHelper = await setupEmailTesting(page)
    await page.getByTestId('invite-caregiver-button').click()
    await page.getByTestId('invite-email-input').fill(testData.email)
    await page.getByTestId('send-invite-button').click()

    // Step 2: User completes registration via invite
    const email = emailHelper.getLatestEmail(testData.email)
    const inviteePage = await context.newPage()

    // Mock invite verification and registration
    await inviteePage.route('**/v1/auth/verify-invite*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          email: testData.email,
          orgName: 'Test Organization'
        })
      })
    })

    await inviteePage.route('**/v1/auth/registerWithInvite', async (route) => {
      route.fulfill({
        status: 201,
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

    // Complete registration
    await inviteePage.goto(email!.links[0])
    await inviteePage.waitForSelector('[data-testid="register-with-invite-screen"]')
    await inviteePage.getByTestId('register-name').fill(testData.name)
    await inviteePage.getByTestId('register-password').fill('StrongPassword123!')
    await inviteePage.getByTestId('register-confirm-password').fill('StrongPassword123!')
    await inviteePage.getByTestId('register-phone').fill(testData.phone)
    await inviteePage.getByTestId('register-submit').click()
    await inviteePage.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Step 3: User logs out
    await inviteePage.getByTestId('profile-tab').click()
    await inviteePage.waitForSelector('[data-testid="profile-screen"]')

    // Mock logout
    await inviteePage.route('**/v1/auth/logout', async (route) => {
      route.fulfill({
        status: 204,
        body: ''
      })
    })

    await inviteePage.getByTestId('logout-button').click()
    await inviteePage.waitForSelector('[data-testid="logout-screen"]')
    await inviteePage.getByTestId('confirm-logout-button').click()
    await inviteePage.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })

    // Step 4: User logs in via SSO
    // Mock Google SSO flow
    await inviteePage.route('**/accounts.google.com/o/oauth2/v2/auth**', async (route) => {
      const mockOAuthResponse = {
        type: 'success',
        params: {
          access_token: 'mock_google_token',
        }
      }
      
      await inviteePage.evaluate((response) => {
        window.postMessage({
          type: 'EXPO_AUTH_SESSION_SUCCESS',
          data: response
        }, '*')
      }, mockOAuthResponse)
      
      route.fulfill({ status: 200 })
    })

    // Mock Google user info
    await inviteePage.route('**/www.googleapis.com/oauth2/v2/userinfo**', async (route) => {
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

    // Mock SSO login for existing user
    await inviteePage.route('**/v1/sso/login', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'SSO login successful',
          tokens: {
            access: {
              token: 'mock_sso_access_token',
              expires: new Date(Date.now() + 3600000).toISOString()
            },
            refresh: {
              token: 'mock_sso_refresh_token',
              expires: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
            }
          },
          user: {
            id: 'mock_new_caregiver_id',
            email: testData.email,
            name: testData.name,
            role: 'staff',
            avatar: 'https://example.com/avatar.jpg',
            phone: testData.phone,
            org: 'mock_org_id',
            patients: []
          }
        })
      })
    })

    // Login via SSO
    await inviteePage.getByTestId('google-sso-button').click()
    await inviteePage.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Step 5: Verify user is logged in and can access the app
    await expect(inviteePage.getByTestId('home-header')).toBeVisible()

    // Clean up
    await inviteePage.close()
  })
})
