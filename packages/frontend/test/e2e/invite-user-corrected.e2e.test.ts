import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData, TEST_USERS } from './fixtures/testData'
import { loginUserViaUI } from './helpers/testHelpers'
import { getEmailFromEthereal } from './helpers/backendHelpers'
import { navigateToOrgScreen } from './helpers/navigation'

test.describe('Invite User Workflow - Corrected (Real Backend)', () => {
  let testData: ReturnType<typeof generateUniqueTestData>
  let inviteEmail: string

  test.beforeEach(() => {
    testData = generateUniqueTestData('invite')
    // Use a unique email for each test run to avoid conflicts
    inviteEmail = `invite-corrected-${Date.now()}@example.com`
  })

  test('Complete invite user workflow with email link', async ({ page, context }) => {
    // Step 1: Admin user logs in (using real backend, no mocks)
    await page.goto('/')
    
    // Try login first - if it fails due to email verification, handle it
    try {
      await loginUserViaUI(page, TEST_USERS.ORG_ADMIN.email, TEST_USERS.ORG_ADMIN.password)
    } catch (error) {
      // If login fails, check if we're on email verification screen
      const currentUrl = page.url()
      if (currentUrl.includes('EmailVerificationRequired')) {
        console.log('Login requires email verification, verifying admin email...')
        const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'
        try {
          // Send verification email for admin user
          await page.request.post(`${API_BASE_URL}/test/send-verification-email`, {
            data: { email: TEST_USERS.ORG_ADMIN.email }
          })
          
          // Retrieve and verify the email
          const email = await getEmailFromEthereal(page, TEST_USERS.ORG_ADMIN.email, true, 30000)
          const token = email.tokens.verification
          if (token) {
            // Verify the email by navigating to the verification link
            await page.goto(`http://localhost:8081/auth/verify-email?token=${token}`)
            await page.waitForTimeout(2000)
            // Try login again
            await page.goto('/')
            await loginUserViaUI(page, TEST_USERS.ORG_ADMIN.email, TEST_USERS.ORG_ADMIN.password)
          } else {
            throw new Error('Could not retrieve verification token from email')
          }
        } catch (verifyError) {
          console.log('Email verification failed:', verifyError.message)
          throw error // Re-throw original login error
        }
      } else {
        // Login failed for a different reason
        throw error
      }
    }

    // Step 2: Navigate to Organization screen
    await navigateToOrgScreen(page)

    // Step 3: Click "Invite Caregiver" button
    const inviteButton = page.locator('[data-testid="invite-caregiver-button"]').first()
    await inviteButton.waitFor({ timeout: 10000, state: 'visible' })
    await inviteButton.click()
    
    // Wait for navigation to caregiver screen
    await page.waitForSelector('[data-testid="caregiver-screen"]', { timeout: 15000 })
    await page.waitForTimeout(2000) // Give React time to render

    // Step 4: Fill in caregiver details in the invite form
    const nameInput = page.locator('[data-testid="caregiver-name-input"]').first()
    const emailInput = page.locator('[data-testid="caregiver-email-input"]').first()
    const phoneInput = page.locator('[data-testid="caregiver-phone-input"]').first()
    
    // Wait for all inputs to be visible
    await Promise.all([
      nameInput.waitFor({ timeout: 15000, state: 'visible' }),
      emailInput.waitFor({ timeout: 15000, state: 'visible' }),
      phoneInput.waitFor({ timeout: 15000, state: 'visible' })
    ])
    
    await nameInput.fill(testData.name)
    await emailInput.fill(inviteEmail)
    // Phone validation expects +1XXXXXXXXXX or XXXXXXXXXX (no dashes)
    // testData.phone has format +1-604-555-XXXX, so we need to remove dashes
    const phoneWithoutDashes = testData.phone.replace(/-/g, '')
    await phoneInput.fill(phoneWithoutDashes)
    
    // Wait for form validation to complete
    await page.waitForTimeout(2000)

    // Step 5: Send the invite (real backend call - will send real email via Ethereal)
    const saveButton = page.locator('[data-testid="caregiver-save-button"]').first()
    
    // Wait for button to be enabled (not disabled)
    await page.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="caregiver-save-button"]') as HTMLButtonElement
        return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'
      },
      { timeout: 10000 }
    )
    
    // Click the button
    await saveButton.click()

    // Step 6: Verify we're on the success screen
    await page.waitForTimeout(1000) // Wait for navigation
    await page.waitForSelector('[data-testid="caregiver-invited-screen"]', { timeout: 15000 })
    await expect(page.getByText('Invitation Sent!', { exact: false })).toBeVisible()

    // Step 7: Retrieve the invite email from Ethereal (real backend sent it)
    console.log(`📧 Retrieving invite email from Ethereal for ${inviteEmail}...`)
    const email = await getEmailFromEthereal(page, inviteEmail, true, 30000)
    
    expect(email).toBeTruthy()
    expect(email.subject.toLowerCase()).toMatch(/invited|invitation/)
    
    // Extract invite token from email
    const inviteToken = email.tokens.invite
    expect(inviteToken).toBeTruthy()
    
    console.log('✅ Invite email retrieved from Ethereal')
    console.log(`   Subject: ${email.subject}`)
    console.log(`   Token extracted: ${inviteToken ? 'Yes' : 'No'}`)

    // Step 8: Simulate clicking the email link (using real backend, no mocks)
    const invitePage = await context.newPage()
    
    // Navigate to signup page with invite token (this is what the email link points to)
    const inviteLink = `http://localhost:8081/signup?token=${inviteToken}`
    await invitePage.goto(inviteLink)
    await invitePage.waitForSelector('[data-testid="signup-screen"]', { timeout: 15000 })

    // Step 9: Fill in the signup form (the invited user needs to set their password)
    // Use correct testIDs - SignupScreen uses register-password, register-confirm-password, register-submit
    await invitePage.locator('input[data-testid="register-password"]').fill('StrongPassword123!')
    await invitePage.locator('input[data-testid="register-confirm-password"]').fill('StrongPassword123!')
    await invitePage.waitForTimeout(1000) // Wait for validation

    // Submit signup (using real backend, no mocks)
    const submitButton = invitePage.locator('[data-testid="register-submit"]')
    await submitButton.waitFor({ state: 'visible', timeout: 10000 })
    await submitButton.click()

    // Should be redirected to home screen after successful registration
    await invitePage.waitForSelector('[data-testid="home-header"]', { timeout: 15000 })

    // Verify user is logged in
    await expect(invitePage.getByLabel('home-header')).toBeVisible()

    // Close the invite page
    await invitePage.close()
  })

  test('Invalid invite token handling', async ({ page }) => {
    const invalidToken = 'invalid_token_123'

    // Navigate to signup page with invalid token (using real backend, no mocks)
    await page.goto(`/signup?token=${invalidToken}`)
    await page.waitForTimeout(2000) // Wait for error handling

    // Should see error message or be redirected to login (real backend will return error)
    const errorMessage = page.getByText(/invalid|expired|token/i)
    const loginScreen = page.locator('[data-testid="email-input"], [aria-label="email-input"]')
    
    // Either error message is shown or we're redirected to login
    const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)
    const onLoginScreen = await loginScreen.isVisible({ timeout: 5000 }).catch(() => false)
    
    expect(hasError || onLoginScreen).toBe(true)
  })

  test('Expired invite token handling', async ({ page }) => {
    const expiredToken = 'expired_token_123'

    // Navigate to signup page with expired token (using real backend, no mocks)
    await page.goto(`/signup?token=${expiredToken}`)
    await page.waitForTimeout(2000) // Wait for error handling

    // Should see error message or be redirected to login (real backend will return error)
    const errorMessage = page.getByText(/expired|invalid|token/i)
    const loginScreen = page.locator('[data-testid="email-input"], [aria-label="email-input"]')
    
    // Either error message is shown or we're redirected to login
    const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)
    const onLoginScreen = await loginScreen.isVisible({ timeout: 5000 }).catch(() => false)
    
    expect(hasError || onLoginScreen).toBe(true)
  })

  test('Invite signup form validation', async ({ page }) => {
    // First, create a real invite to get a valid token
    await page.goto('/')
    try {
      await loginUserViaUI(page, TEST_USERS.ORG_ADMIN.email, TEST_USERS.ORG_ADMIN.password)
    } catch (error) {
      // Handle email verification if needed
      const currentUrl = page.url()
      if (currentUrl.includes('EmailVerificationRequired')) {
        const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'
        await page.request.post(`${API_BASE_URL}/test/send-verification-email`, {
          data: { email: TEST_USERS.ORG_ADMIN.email }
        })
        const email = await getEmailFromEthereal(page, TEST_USERS.ORG_ADMIN.email, true, 30000)
        const token = email.tokens.verification
        if (token) {
          await page.goto(`http://localhost:8081/auth/verify-email?token=${token}`)
          await page.waitForTimeout(2000)
          await page.goto('/')
          await loginUserViaUI(page, TEST_USERS.ORG_ADMIN.email, TEST_USERS.ORG_ADMIN.password)
        }
      }
    }
    
    await navigateToOrgScreen(page)
    const inviteButton = page.locator('[data-testid="invite-caregiver-button"]').first()
    await inviteButton.waitFor({ timeout: 10000, state: 'visible' })
    await inviteButton.click()
    await page.waitForSelector('[data-testid="caregiver-screen"]', { timeout: 15000 })
    
    const validationEmail = `validation-${Date.now()}@example.com`
    await page.locator('[data-testid="caregiver-name-input"]').first().fill('Test User')
    await page.locator('[data-testid="caregiver-email-input"]').first().fill(validationEmail)
    // Use proper E.164 format phone number
    const timestamp = Date.now()
    const last4 = timestamp.toString().slice(-4)
    const phoneNumber = `+1604555${last4}` // E.164 format: +1XXXXXXXXXX
    await page.locator('[data-testid="caregiver-phone-input"]').first().fill(phoneNumber)
    await page.waitForTimeout(2000)
    
    const saveButton = page.locator('[data-testid="caregiver-save-button"]').first()
    // Wait for button to be enabled
    await page.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="caregiver-save-button"]') as HTMLButtonElement
        return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'
      },
      { timeout: 10000 }
    )
    await saveButton.click()
    await page.waitForSelector('[data-testid="caregiver-invited-screen"]', { timeout: 15000 })
    
    // Get real invite token from email
    const email = await getEmailFromEthereal(page, validationEmail, true, 30000)
    const realInviteToken = email.tokens.invite
    expect(realInviteToken).toBeTruthy()

    // Navigate to signup page with valid token (using real backend, no mocks)
    await page.goto(`/signup?token=${realInviteToken}`)
    await page.waitForSelector('[data-testid="signup-screen"]', { timeout: 10000 })
    await page.waitForTimeout(1000) // Give screen time to render

    // Fill in invalid data first (before trying to submit)
    await page.locator('input[data-testid="register-password"]').fill('weak') // Too weak (less than 6 chars)
    await page.locator('input[data-testid="register-confirm-password"]').fill('different') // Doesn't match
    await page.waitForTimeout(1000) // Wait for validation to trigger

    // Should see validation errors - check for password length error (min 6 for signup) or mismatch
    // PasswordField shows "Passwords do not match" for confirm field
    const passwordMatchError = page.getByText(/passwords.*do.*not.*match/i)
      .or(page.getByText(/password.*match/i))
    
    // Check if password length error is shown (PasswordField shows rules)
    const passwordLengthError = page.getByText(/at least.*6.*characters/i)
      .or(page.getByText(/password.*must.*be.*at.*least/i))
      .or(page.locator('text=/password/i').filter({ hasText: /at least|too short|minimum/i }))
    
    // At least one error should be visible (mismatch should definitely show)
    const hasMatchError = await passwordMatchError.isVisible({ timeout: 3000 }).catch(() => false)
    const hasLengthError = await passwordLengthError.isVisible({ timeout: 3000 }).catch(() => false)
    
    // The "Passwords do not match" error should definitely be visible
    expect(hasMatchError).toBe(true)
    
    if (!hasMatchError && !hasLengthError) {
      // If no errors visible, check if button is disabled (which would indicate validation is working)
      const submitButton = page.locator('[data-testid="register-submit"]')
      const isEnabled = await submitButton.isEnabled().catch(() => true)
      if (isEnabled) {
        console.log('⚠️ Submit button is enabled despite invalid data - validation may not be working')
      } else {
        console.log('✅ Submit button is disabled (validation is working, but errors not visible)')
      }
    }
  })

  test('Email link simulation with real email service', async ({ page, context }) => {
    // This test uses real backend with Ethereal email service (no mocks)
    
    // Step 1: Admin logs in (using real backend, no mocks)
    await page.goto('/')
    try {
      await loginUserViaUI(page, TEST_USERS.ORG_ADMIN.email, TEST_USERS.ORG_ADMIN.password)
    } catch (error) {
      // Handle email verification if needed
      const currentUrl = page.url()
      if (currentUrl.includes('EmailVerificationRequired')) {
        const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'
        await page.request.post(`${API_BASE_URL}/test/send-verification-email`, {
          data: { email: TEST_USERS.ORG_ADMIN.email }
        })
        const email = await getEmailFromEthereal(page, TEST_USERS.ORG_ADMIN.email, true, 30000)
        const token = email.tokens.verification
        if (token) {
          await page.goto(`http://localhost:8081/auth/verify-email?token=${token}`)
          await page.waitForTimeout(2000)
          await page.goto('/')
          await loginUserViaUI(page, TEST_USERS.ORG_ADMIN.email, TEST_USERS.ORG_ADMIN.password)
        }
      }
    }

    // Navigate to Organization screen
    await navigateToOrgScreen(page)

    // Send invite (real backend call - will send real email via Ethereal)
    const emailForLinkTest = `link-test-${Date.now()}@example.com`
    const inviteButton = page.locator('[data-testid="invite-caregiver-button"]').first()
    await inviteButton.waitFor({ timeout: 10000, state: 'visible' })
    await inviteButton.click()
    await page.waitForSelector('[data-testid="caregiver-screen"]', { timeout: 15000 })
    
    await page.locator('[data-testid="caregiver-name-input"]').first().fill(testData.name)
    await page.locator('[data-testid="caregiver-email-input"]').first().fill(emailForLinkTest)
    // Phone validation expects +1XXXXXXXXXX or XXXXXXXXXX (no dashes)
    // testData.phone has format +1-604-555-XXXX, so we need to remove dashes
    const phoneWithoutDashes = testData.phone.replace(/-/g, '')
    await page.locator('[data-testid="caregiver-phone-input"]').first().fill(phoneWithoutDashes)
    await page.waitForTimeout(2000)
    
    const saveButton = page.locator('[data-testid="caregiver-save-button"]').first()
    // Wait for button to be enabled
    await page.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="caregiver-save-button"]') as HTMLButtonElement
        return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'
      },
      { timeout: 10000 }
    )
    await saveButton.click()
    await page.waitForSelector('[data-testid="caregiver-invited-screen"]', { timeout: 15000 })

    // Step 2: Retrieve the invite email from Ethereal (real backend sent it)
    console.log(`📧 Retrieving invite email from Ethereal for ${emailForLinkTest}...`)
    const email = await getEmailFromEthereal(page, emailForLinkTest, true, 30000)
    
    expect(email).toBeTruthy()
    const realInviteToken = email.tokens.invite
    expect(realInviteToken).toBeTruthy()
    
    // Step 3: Simulate clicking the email link (using real backend, no mocks)
    const invitePage = await context.newPage()
    
    // Navigate to the actual invite link from the email
    const inviteLink = `http://localhost:8081/signup?token=${realInviteToken}`
    await invitePage.goto(inviteLink)
    await invitePage.waitForSelector('[data-testid="signup-screen"]', { timeout: 15000 })

    // Complete the signup (using real backend, no mocks)
    // Use correct testIDs - SignupScreen uses register-password, register-confirm-password, register-submit
    await invitePage.locator('input[data-testid="register-password"]').fill('StrongPassword123!')
    await invitePage.locator('input[data-testid="register-confirm-password"]').fill('StrongPassword123!')
    await invitePage.waitForTimeout(1000) // Wait for validation

    // Wait for submit button to be visible and enabled
    const submitButton = invitePage.locator('[data-testid="register-submit"]')
    await submitButton.waitFor({ state: 'visible', timeout: 10000 })
    
    // Wait for button to be enabled
    await invitePage.waitForFunction(
      () => {
        const button = document.querySelector('[data-testid="register-submit"]') as HTMLButtonElement
        return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'
      },
      { timeout: 10000 }
    )
    
    await submitButton.click()
    await invitePage.waitForSelector('[data-testid="home-header"]', { timeout: 15000 })

    // Verify the new user is logged in and can access the app
    await expect(invitePage.getByLabel('home-header')).toBeVisible()

    await invitePage.close()
  })
})
