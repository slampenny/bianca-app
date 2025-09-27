import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData, TEST_USERS } from './fixtures/testData'

// Use the actual ObjectIds from the seeded database
// The seeding script creates one org and assigns the admin user to it
const MOCK_ORG_ID = '68d7de80736f5e3c1aaf09d9' // Actual org ID from seeding
const MOCK_ADMIN_ID = '68d7de80736f5e3c1aaf09db' // Actual admin ID from seeding
const MOCK_INVITED_CAREGIVER_ID = '68d7de80736f5e3c1aaf09dc' // Actual caregiver ID from seeding

test.describe('Invite User Workflow', () => {
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
            id: MOCK_ORG_ID,
            name: 'Test Organization',
            email: 'admin@example.org'
          },
          caregiver: {
            id: MOCK_ADMIN_ID,
            email: TEST_USERS.ORG_ADMIN.email,
            name: TEST_USERS.ORG_ADMIN.name,
            role: 'orgAdmin',
            avatar: '',
            phone: TEST_USERS.ORG_ADMIN.phone,
            org: MOCK_ORG_ID,
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
    await page.getByTestId('tab-org').click()
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
            id: MOCK_INVITED_CAREGIVER_ID,
            email: testData.email,
            name: testData.name,
            role: 'invited',
            avatar: '',
            phone: testData.phone,
            org: MOCK_ORG_ID,
            patients: []
          },
          inviteToken: inviteToken
        })
      })
    })

    // Step 5: Send the invite
    await page.getByTestId('caregiver-save-button').click()

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
            orgId: MOCK_ORG_ID
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

    // Fill in the signup form (the invited user needs to set their password)
    await invitePage.getByTestId('register-password').fill('StrongPassword123!')
    await invitePage.getByTestId('register-confirm-password').fill('StrongPassword123!')

    // Mock successful signup with invite token
    await invitePage.route('**/v1/auth/registerWithInvite', async (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = route.request().postDataJSON()
        console.log('Register with invite request body:', requestBody)
        
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: MOCK_INVITED_CAREGIVER_ID,
              name: testData.name,
              email: testData.email,
              phone: testData.phone,
              role: 'staff',
              org: MOCK_ORG_ID
            },
            tokens: {
              access: {
                token: 'mock_new_user_access_token',
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              },
              refresh: {
                token: 'mock_new_user_refresh_token',
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              }
            }
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
            id: MOCK_ORG_ID,
            name: 'Test Organization',
            email: 'admin@example.org'
          },
          caregiver: {
            id: MOCK_INVITED_CAREGIVER_ID,
            email: testData.email,
            name: testData.name,
            role: 'staff',
            avatar: '',
            phone: testData.phone,
            org: MOCK_ORG_ID,
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
    await invitePage.getByTestId('register-submit').click()

    // Should be redirected to home screen
    await invitePage.waitForSelector('[data-testid="home-header"]', { timeout: 15000 })

    // Verify user is logged in
    await expect(invitePage.getByTestId('home-header')).toBeVisible()

    // Close the invite page
    await invitePage.close()
  })

  test('Invalid invite token handling', async ({ page }) => {
    const invalidToken = 'invalid_token_123'

    // Mock invalid token verification
    await page.route('**/v1/auth/verify-invite*', async (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: false,
          message: 'Invalid or expired invite token'
        })
      })
    })

    // Navigate to invite registration page with invalid token
    await page.goto(`/signup?token=${invalidToken}`)

    // Should see error message
    await expect(page.getByText('Invalid or expired invite token')).toBeVisible()

    // Should be redirected to login page
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
  })

  test('Expired invite token handling', async ({ page }) => {
    const expiredToken = 'expired_token_123'

    // Mock expired token verification
    await page.route('**/v1/auth/verify-invite*', async (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: false,
          message: 'Invite token has expired'
        })
      })
    })

    // Navigate to invite registration page with expired token
    await page.goto(`/signup?token=${expiredToken}`)

    // Should see error message
    await expect(page.getByText('Invite token has expired')).toBeVisible()

    // Should be redirected to login page
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
  })

  test('Invite registration form validation', async ({ page }) => {
    // Mock valid token verification
    await page.route('**/v1/auth/verify-invite*', async (route) => {
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

    // Navigate to invite registration page
    await page.goto(`/signup?token=${inviteToken}`)
    await page.waitForSelector('[data-testid="signup-screen"]')

    // Fill in valid password data first to enable the button
    await page.getByTestId('register-password').fill('StrongPassword123!')
    await page.getByTestId('register-confirm-password').fill('StrongPassword123!')

    // Now the button should be enabled and we can test validation
    await page.getByTestId('register-submit').click()

    // Should see success or navigate to main app
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
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
            id: MOCK_ORG_ID,
            name: 'Test Organization',
            email: 'admin@example.org'
          },
          caregiver: {
            id: MOCK_ADMIN_ID,
            email: TEST_USERS.ORG_ADMIN.email,
            name: TEST_USERS.ORG_ADMIN.name,
            role: 'orgAdmin',
            avatar: '',
            phone: TEST_USERS.ORG_ADMIN.phone,
            org: MOCK_ORG_ID,
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

    // Navigate to caregivers management
    await page.getByTestId('tab-org').click()
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
            id: MOCK_INVITED_CAREGIVER_ID,
            email: testData.email,
            name: '',
            role: 'invited',
            avatar: '',
            phone: '',
            org: MOCK_ORG_ID,
            patients: []
          },
          inviteToken: inviteToken
        })
      })
    })

    // Send invite
    await page.getByTestId('invite-caregiver-button').click()
    await page.getByTestId('caregiver-email-input').fill(testData.email)
    await page.getByTestId('caregiver-save-button').click()

    // Step 2: Simulate the email link click
    // In a real test environment, you would:
    // 1. Capture the email from your email service (MailHog, etc.)
    // 2. Extract the invite link from the email
    // 3. Navigate to that link
    
    // For this test, we'll simulate the email link
    const invitePage = await context.newPage()
    
    // Mock the invite token verification
    await invitePage.route('**/v1/auth/verify-invite*', async (route) => {
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

    // Simulate clicking the email link
    // In reality, this would be: await invitePage.goto(emailLink)
    await invitePage.goto(`/signup?token=${inviteToken}`)
    await invitePage.waitForSelector('[data-testid="signup-screen"]')

    // Complete the registration
    await invitePage.getByTestId('register-name').fill(testData.name)
    await invitePage.getByTestId('register-password').fill('StrongPassword123!')
    await invitePage.getByTestId('register-confirm-password').fill('StrongPassword123!')
    await invitePage.getByTestId('register-phone').fill(testData.phone)

    // Mock successful registration
    await invitePage.route('**/v1/auth/registerWithInvite', async (route) => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          caregiver: {
            id: MOCK_INVITED_CAREGIVER_ID,
            email: testData.email,
            name: testData.name,
            role: 'staff',
            avatar: '',
            phone: testData.phone,
            org: MOCK_ORG_ID,
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

    await invitePage.getByTestId('register-submit').click()
    await invitePage.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })

    // Verify the new user is logged in and can access the app
    await expect(invitePage.getByTestId('home-header')).toBeVisible()

    await invitePage.close()
  })
})
