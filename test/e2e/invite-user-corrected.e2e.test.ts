import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData, TEST_USERS } from './fixtures/testData'

test.describe('Invite User Workflow - Corrected', () => {
  let testData: ReturnType<typeof generateUniqueTestData>
  let inviteToken: string

  test.beforeEach(() => {
    testData = generateUniqueTestData('invite')
    inviteToken = `mock_invite_token_${Date.now()}`
  })

  test('Complete invite user workflow with email link', async ({ page, context }) => {
    // Step 1: Admin user logs in
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

    // Step 2: Navigate to Organization screen
    await page.getByTestId('organization-tab').click()
    await page.waitForSelector('[data-testid="org-screen"]')

    // Step 3: Click "Invite Caregiver" button
    await page.getByTestId('invite-caregiver-button').click()
    await page.waitForSelector('[data-testid="caregiver-screen"]')

    // Step 4: Fill in caregiver details in the invite form
    await page.getByTestId('caregiver-name-input').fill(testData.name)
    await page.getByTestId('caregiver-email-input').fill(testData.email)
    await page.getByTestId('caregiver-phone-input').fill(testData.phone)

    // Mock successful invite sending
    await page.route('**/v1/orgs/*/sendInvite', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          caregiver: {
            id: 'mock_invited_caregiver_id',
            email: testData.email,
            name: testData.name,
            role: 'invited',
            avatar: '',
            phone: testData.phone,
            org: 'mock_org_id',
            patients: []
          },
          inviteToken: inviteToken
        })
      })
    })

    // Step 5: Send the invite
    await page.getByTestId('send-invite-button').click()

    // Step 6: Verify we're on the success screen
    await page.waitForSelector('[data-testid="caregiver-invited-screen"]')
    await expect(page.getByText('Invitation Sent!')).toBeVisible()
    await expect(page.getByText(`An invitation has been sent to ${testData.name} at ${testData.email}.`)).toBeVisible()

    // Step 7: Simulate clicking the email link
    // Create a new page context to simulate the invite link
    const invitePage = await context.newPage()
    
    // Mock the invite token verification (backend endpoint)
    await invitePage.route('**/v1/orgs/verifyInvite*', async (route) => {
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

    // Navigate to signup page with invite token (this is what the email link points to)
    await invitePage.goto(`/signup?token=${inviteToken}`)
    await invitePage.waitForSelector('[data-testid="signup-screen"]')

    // Step 8: Fill in the signup form (the invited user needs to set their password)
    await invitePage.getByTestId('signup-password-input').fill('StrongPassword123!')
    await invitePage.getByTestId('signup-confirm-password-input').fill('StrongPassword123!')

    // Mock successful signup with invite token
    await invitePage.route('**/v1/orgs/verifyInvite', async (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: 'mock_org_id'
          })
        })
      } else {
        route.continue()
      }
    })

    // Mock login after successful signup
    await invitePage.route('**/v1/auth/login', async (route) => {
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
            id: 'mock_new_caregiver_id',
            email: testData.email,
            name: testData.name,
            role: 'staff',
            avatar: '',
            phone: testData.phone,
            org: 'mock_org_id',
            patients: []
          },
          patients: [],
          alerts: [],
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
    await invitePage.getByTestId('signup-submit-button').click()

    // Should be redirected to home screen
    await invitePage.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Verify user is logged in
    await expect(invitePage.getByTestId('home-header')).toBeVisible()

    // Close the invite page
    await invitePage.close()
  })

  test('Invalid invite token handling', async ({ page }) => {
    const invalidToken = 'invalid_token_123'

    // Mock invalid token verification
    await page.route('**/v1/orgs/verifyInvite*', async (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invalid or expired invite token'
        })
      })
    })

    // Navigate to signup page with invalid token
    await page.goto(`/signup?token=${invalidToken}`)

    // Should see error message
    await expect(page.getByText('Invalid or expired invite token')).toBeVisible()

    // Should be redirected to login page
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
  })

  test('Expired invite token handling', async ({ page }) => {
    const expiredToken = 'expired_token_123'

    // Mock expired token verification
    await page.route('**/v1/orgs/verifyInvite*', async (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invite token has expired'
        })
      })
    })

    // Navigate to signup page with expired token
    await page.goto(`/signup?token=${expiredToken}`)

    // Should see error message
    await expect(page.getByText('Invite token has expired')).toBeVisible()

    // Should be redirected to login page
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
  })

  test('Invite signup form validation', async ({ page }) => {
    // Mock valid token verification
    await page.route('**/v1/orgs/verifyInvite*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orgId: 'mock_org_id'
        })
      })
    })

    // Navigate to signup page with valid token
    await page.goto(`/signup?token=${inviteToken}`)
    await page.waitForSelector('[data-testid="signup-screen"]')

    // Try to submit without filling required fields
    await page.getByTestId('signup-submit-button').click()

    // Should see validation errors
    await expect(page.getByText('Password is required')).toBeVisible()
    await expect(page.getByText('Confirm password is required')).toBeVisible()

    // Fill in invalid data
    await page.getByTestId('signup-password-input').fill('weak') // Too weak
    await page.getByTestId('signup-confirm-password-input').fill('different') // Doesn't match

    await page.getByTestId('signup-submit-button').click()

    // Should see validation errors
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
    await expect(page.getByText('Passwords do not match')).toBeVisible()
  })

  test('Email link simulation with real email service', async ({ page, context }) => {
    // This test simulates the real-world scenario where a user clicks an email link
    // In a real test environment, you might use a service like MailHog or similar
    
    // Step 1: Admin sends invite (same as first test)
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

    await page.getByTestId('email-input').fill(TEST_USERS.ORG_ADMIN.email)
    await page.getByTestId('password-input').fill(TEST_USERS.ORG_ADMIN.password)
    await page.getByTestId('login-button').click()
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Navigate to Organization screen
    await page.getByTestId('organization-tab').click()
    await page.waitForSelector('[data-testid="org-screen"]')

    // Mock email service that would send the actual email
    await page.route('**/v1/orgs/*/sendInvite', async (route) => {
      // In a real test, you might capture the email here
      // For now, we'll just mock the response
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          caregiver: {
            id: 'mock_invited_caregiver_id',
            email: testData.email,
            name: testData.name,
            role: 'invited',
            avatar: '',
            phone: testData.phone,
            org: 'mock_org_id',
            patients: []
          },
          inviteToken: inviteToken
        })
      })
    })

    // Send invite
    await page.getByTestId('invite-caregiver-button').click()
    await page.waitForSelector('[data-testid="caregiver-screen"]')
    await page.getByTestId('caregiver-name-input').fill(testData.name)
    await page.getByTestId('caregiver-email-input').fill(testData.email)
    await page.getByTestId('caregiver-phone-input').fill(testData.phone)
    await page.getByTestId('send-invite-button').click()

    // Step 2: Simulate the email link click
    // In a real test environment, you would:
    // 1. Capture the email from your email service (MailHog, etc.)
    // 2. Extract the invite link from the email
    // 3. Navigate to that link
    
    // For this test, we'll simulate the email link
    const invitePage = await context.newPage()
    
    // Mock the invite token verification
    await invitePage.route('**/v1/orgs/verifyInvite*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orgId: 'mock_org_id'
        })
      })
    })

    // Simulate clicking the email link
    // In reality, this would be: await invitePage.goto(emailLink)
    await invitePage.goto(`/signup?token=${inviteToken}`)
    await invitePage.waitForSelector('[data-testid="signup-screen"]')

    // Complete the signup
    await invitePage.getByTestId('signup-password-input').fill('StrongPassword123!')
    await invitePage.getByTestId('signup-confirm-password-input').fill('StrongPassword123!')

    // Mock successful signup
    await invitePage.route('**/v1/orgs/verifyInvite', async (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: 'mock_org_id'
          })
        })
      } else {
        route.continue()
      }
    })

    // Mock login after successful signup
    await invitePage.route('**/v1/auth/login', async (route) => {
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
            id: 'mock_new_caregiver_id',
            email: testData.email,
            name: testData.name,
            role: 'staff',
            avatar: '',
            phone: testData.phone,
            org: 'mock_org_id',
            patients: []
          },
          patients: [],
          alerts: [],
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

    await invitePage.getByTestId('signup-submit-button').click()
    await invitePage.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Verify the new user is logged in and can access the app
    await expect(invitePage.getByTestId('home-header')).toBeVisible()

    await invitePage.close()
  })
})
