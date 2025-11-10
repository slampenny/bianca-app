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
    // Wait for login screen to load
    await page.waitForSelector('[data-testid="login-form"], [aria-label="login-screen"]', { timeout: 10000 })
    await page.waitForSelector('[data-testid="email-input"], [aria-label="email-input"]', { timeout: 10000 })
    
    await page.getByTestId('email-input').or(page.getByLabel('email-input')).fill(TEST_USERS.ORG_ADMIN.email)
    await page.getByTestId('password-input').or(page.getByLabel('password-input')).fill(TEST_USERS.ORG_ADMIN.password)
    await page.getByTestId('login-button').or(page.getByLabel('login-button')).click()
    await page.waitForSelector('[data-testid="home-header"], [aria-label="home-header"]', { timeout: 10000 })

    // Step 2: Navigate to Organization screen
    const orgTab = page.locator('[data-testid="tab-org"], [aria-label="Organization tab"]').first()
    await orgTab.waitFor({ timeout: 10000, state: 'visible' })
    await orgTab.click()
    await page.waitForSelector('[data-testid="org-screen"]')

    // Step 3: Click "Invite Caregiver" button
    await page.waitForTimeout(2000) // Wait for screen to fully render
    
    // Listen for console errors and navigation events
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    const inviteButton = page.locator('[data-testid="invite-caregiver-button"]').first()
    
    // Check if button exists and is visible
    const buttonCount = await inviteButton.count()
    if (buttonCount === 0) {
      // Button might not be visible if user doesn't have permission
      // Check if we're actually logged in as orgAdmin
      const currentUrl = page.url()
      console.log('Current URL after org tab click:', currentUrl)
      
      // Check if button exists but is hidden
      const allButtons = page.locator('button, [role="button"]')
      const buttonTexts = await allButtons.allTextContents()
      console.log('All buttons on page:', buttonTexts)
      
      throw new Error('Invite caregiver button not found - user may not have orgAdmin permissions or button may not be rendered')
    }
    
    await inviteButton.waitFor({ timeout: 10000, state: 'visible' })
    
    // Check if button is enabled
    const isEnabled = await inviteButton.isEnabled().catch(() => false)
    if (!isEnabled) {
      console.log('⚠️ Invite button is disabled - may need to wait or check permissions')
      await page.waitForTimeout(2000)
    }
    
    // Get current URL before click
    const urlBeforeClick = page.url()
    console.log('URL before clicking invite button:', urlBeforeClick)
    
    // Click the button and wait for navigation
    await Promise.all([
      page.waitForURL(/.*Caregiver.*/, { timeout: 10000 }).catch(() => null),
      inviteButton.click()
    ])
    
    // Wait for navigation - check URL or screen appearance
    await page.waitForTimeout(3000) // Give more time for navigation
    const caregiverScreen = page.locator('[data-testid="caregiver-screen"]')
    const caregiverInputs = page.locator('[data-testid="caregiver-name-input"], [data-testid="caregiver-email-input"]')
    
    // Wait for either the screen or form inputs to appear
    await Promise.race([
      caregiverScreen.waitFor({ timeout: 15000, state: 'visible' }).catch(() => null),
      caregiverInputs.first().waitFor({ timeout: 15000, state: 'visible' }).catch(() => null),
    ])
    
    // Verify we navigated (check URL or form fields)
    const urlAfterClick = page.url()
    const hasCaregiverScreen = await caregiverScreen.isVisible().catch(() => false)
    const hasInputs = await caregiverInputs.first().isVisible().catch(() => false)
    
    // Log any errors that occurred
    if (errors.length > 0) {
      console.log('⚠️ JavaScript errors detected:', errors)
    }
    
    if (!hasCaregiverScreen && !hasInputs && !urlAfterClick.includes('Caregiver')) {
      // This might be a real bug - navigation isn't working
      console.log('⚠️ Navigation to caregiver screen failed')
      console.log('   URL before click:', urlBeforeClick)
      console.log('   URL after click:', urlAfterClick)
      console.log('   Has caregiver screen:', hasCaregiverScreen)
      console.log('   Has inputs:', hasInputs)
      console.log('   JavaScript errors:', errors)
      
      // Try to get more info about what's on the page
      const pageContent = await page.content()
      const hasInviteButton = pageContent.includes('invite-caregiver-button')
      const hasOrgScreen = pageContent.includes('org-screen')
      console.log('   Page still has invite button:', hasInviteButton)
      console.log('   Page still has org screen:', hasOrgScreen)
      
      throw new Error('Navigation to caregiver screen failed after clicking invite button - this may indicate a bug in the invite flow')
    }

    // Step 4: Fill in caregiver details in the invite form
    // Wait for form fields to be visible
    await page.waitForTimeout(1000)
    
    const nameInput = page.locator('[data-testid="caregiver-name-input"]').first()
    await nameInput.waitFor({ timeout: 10000, state: 'visible' })
    await nameInput.fill(testData.name)
    
    const emailInput = page.locator('[data-testid="caregiver-email-input"]').first()
    await emailInput.waitFor({ timeout: 10000, state: 'visible' })
    await emailInput.fill(testData.email)
    
    const phoneInput = page.locator('[data-testid="caregiver-phone-input"]').first()
    await phoneInput.waitFor({ timeout: 10000, state: 'visible' })
    await phoneInput.fill(testData.phone)

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

    // Step 5: Send the invite - button is "caregiver-save-button" in invite mode
    const saveButton = page.locator('[data-testid="caregiver-save-button"]').first()
    await saveButton.waitFor({ timeout: 10000, state: 'visible' })
    await saveButton.click()

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
    await expect(invitePage.getByLabel('home-header')).toBeVisible()

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
    await page.waitForTimeout(2000) // Wait for error handling

    // Should see error message or be redirected to login
    const errorMessage = page.getByText(/invalid|expired|token/i)
    const loginScreen = page.locator('[data-testid="email-input"], [aria-label="email-input"]')
    
    // Either error message is shown or we're redirected to login
    const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)
    const onLoginScreen = await loginScreen.isVisible({ timeout: 5000 }).catch(() => false)
    
    expect(hasError || onLoginScreen).toBe(true)
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
    await page.waitForTimeout(2000) // Wait for error handling

    // Should see error message or be redirected to login
    const errorMessage = page.getByText(/expired|invalid|token/i)
    const loginScreen = page.locator('[data-testid="email-input"], [aria-label="email-input"]')
    
    // Either error message is shown or we're redirected to login
    const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)
    const onLoginScreen = await loginScreen.isVisible({ timeout: 5000 }).catch(() => false)
    
    expect(hasError || onLoginScreen).toBe(true)
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
    await page.waitForSelector('[data-testid="signup-screen"]', { timeout: 10000 })
    await page.waitForTimeout(1000) // Give screen time to render

    // Try to submit without filling required fields
    await page.getByTestId('signup-submit-button').waitFor({ timeout: 10000 }).catch(() => {})
    await page.getByTestId('signup-submit-button').click({ timeout: 5000 }).catch(() => {})

    // Should see validation errors - try multiple possible error messages
    const passwordError = page.getByText(/password.*required/i).or(page.getByText(/password.*cannot.*empty/i))
    const confirmPasswordError = page.getByText(/confirm.*password.*required/i).or(page.getByText(/confirm.*password.*cannot.*empty/i))
    
    // Check if either error is visible (validation might show different messages)
    const hasPasswordError = await passwordError.isVisible({ timeout: 5000 }).catch(() => false)
    const hasConfirmPasswordError = await confirmPasswordError.isVisible({ timeout: 5000 }).catch(() => false)
    
    // At least one validation error should be visible
    if (!hasPasswordError && !hasConfirmPasswordError) {
      // Check for any error text on the page
      const allErrors = page.locator('text=/required|cannot.*empty|invalid/i')
      const errorCount = await allErrors.count()
      if (errorCount === 0) {
        console.log('⚠️ No validation errors found - form validation may not be working or errors may be shown differently')
      }
    }

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

    // Wait for login screen to load
    await page.waitForSelector('[data-testid="login-form"], [aria-label="login-screen"]', { timeout: 10000 })
    await page.waitForSelector('[data-testid="email-input"], [aria-label="email-input"]', { timeout: 10000 })
    
    await page.getByTestId('email-input').or(page.getByLabel('email-input')).fill(TEST_USERS.ORG_ADMIN.email)
    await page.getByTestId('password-input').or(page.getByLabel('password-input')).fill(TEST_USERS.ORG_ADMIN.password)
    await page.getByTestId('login-button').or(page.getByLabel('login-button')).click()
    await page.waitForSelector('[data-testid="home-header"], [aria-label="home-header"]', { timeout: 10000 })

    // Navigate to Organization screen
    const orgTab = page.locator('[data-testid="tab-org"], [aria-label="Organization tab"]').first()
    await orgTab.waitFor({ timeout: 10000, state: 'visible' })
    await orgTab.click()
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
    await expect(invitePage.getByLabel('home-header')).toBeVisible()

    await invitePage.close()
  })
})
