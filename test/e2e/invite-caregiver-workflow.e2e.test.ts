import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData, TEST_USERS } from './fixtures/testData'
import { getEmailFromEthereal } from './helpers/backendHelpers'
import { loginUserViaUI } from './helpers/testHelpers'

test.describe('Invite Caregiver Workflow - End to End with Ethereal', () => {
  let testData: ReturnType<typeof generateUniqueTestData>
  let inviteEmail: string
  const invitePassword = 'StrongPassword123!'

  test.beforeEach(() => {
    testData = generateUniqueTestData('invite-caregiver')
    // Use a unique email for each test run to avoid conflicts
    inviteEmail = `invite-caregiver-${Date.now()}@example.com`
  })

  test('complete invite caregiver workflow works end-to-end with real email', async ({ page, context }) => {
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
            await page.goto('http://localhost:8081')
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
    const orgTab = page.locator('[data-testid="tab-org"], [aria-label="Organization tab"]').first()
    await orgTab.waitFor({ timeout: 10000, state: 'visible' })
    await orgTab.click()
    await page.waitForSelector('[data-testid="org-screen"]', { timeout: 10000 })

    // Step 3: Click "Invite Caregiver" button
    const inviteButton = page.locator('[data-testid="invite-caregiver-button"]').first()
    await inviteButton.waitFor({ timeout: 10000, state: 'visible' })
    await inviteButton.click()
    
    // Wait for navigation to caregiver screen
    await page.waitForSelector('[data-testid="caregiver-screen"]', { timeout: 15000 })
    await page.waitForTimeout(2000) // Give React time to render

    // Step 4: Fill in caregiver details in the invite form
    const nameInput = page.locator('[data-testid="caregiver-name-input"]').first()
    await nameInput.waitFor({ timeout: 10000, state: 'visible' })
    await nameInput.fill(testData.name)
    
    const emailInput = page.locator('[data-testid="caregiver-email-input"]').first()
    await emailInput.waitFor({ timeout: 10000, state: 'visible' })
    await emailInput.fill(inviteEmail)
    
    const phoneInput = page.locator('[data-testid="caregiver-phone-input"]').first()
    await phoneInput.waitFor({ timeout: 10000, state: 'visible' })
    await phoneInput.fill(testData.phone)

    // Step 5: Send the invite - button is "caregiver-save-button" in invite mode
    const saveButton = page.locator('[data-testid="caregiver-save-button"]').first()
    await saveButton.waitFor({ timeout: 10000, state: 'visible' })
    await saveButton.click()

    // Step 6: Verify we're on the success screen
    await page.waitForSelector('[data-testid="caregiver-invited-screen"]', { timeout: 10000 })
    await expect(page.getByText('Invitation Sent!', { exact: false })).toBeVisible()

    // Step 7: Retrieve the invite email from Ethereal
    console.log(`📧 Waiting for invite email to ${inviteEmail}...`)
    await page.waitForTimeout(3000) // Give email time to be sent
    
    let email
    try {
      email = await getEmailFromEthereal(page, inviteEmail, true, 30000) // Wait up to 30 seconds
    } catch (error) {
      console.error('Failed to retrieve email from Ethereal:', error)
      throw new Error(`Could not retrieve invite email: ${error.message}`)
    }
    
    // Verify email was received
    expect(email).toBeTruthy()
    expect(email.subject).toContain('Invitation')
    expect(email.tokens.invite).toBeTruthy()
    
    console.log('✅ Invite email retrieved from Ethereal')
    console.log(`   Subject: ${email.subject}`)
    console.log(`   Token extracted: ${email.tokens.invite ? 'Yes' : 'No'}`)
    
    // Step 8: Extract invite token from email
    const inviteToken = email.tokens.invite
    expect(inviteToken).toBeTruthy()
    
    // Step 9: Simulate clicking the email link
    // Create a new page context to simulate the invite link
    const invitePage = await context.newPage()

    // Navigate to signup page with invite token (this is what the email link points to)
    const inviteLink = `http://localhost:8081/signup?token=${inviteToken}`
    await invitePage.goto(inviteLink)
    await invitePage.waitForSelector('[data-testid="signup-screen"]', { timeout: 10000 })

    // Step 10: Fill in the signup form
    // Note: The form requires name, email, phone, and password (token validation happens on backend)
    // We use the same test data that was used to send the invite
    await invitePage.waitForTimeout(1000) // Give form time to render
    
    // Fill name, email, phone (these should match what was sent in the invite)
    // Use data-testid for TextField inputs (TextField needs input[data-testid="..."] pattern)
    const nameField = invitePage.locator('input[data-testid="register-name"]')
    const emailField = invitePage.locator('input[data-testid="register-email"]')
    const phoneField = invitePage.locator('input[data-testid="register-phone"]')
    const passwordField = invitePage.locator('input[data-testid="register-password"]')
    const confirmPasswordField = invitePage.locator('input[data-testid="register-confirm-password"]')
    
    // Wait for all fields to be visible
    await Promise.all([
      nameField.waitFor({ timeout: 10000, state: 'visible' }).catch(() => {}),
      emailField.waitFor({ timeout: 10000, state: 'visible' }).catch(() => {}),
      phoneField.waitFor({ timeout: 10000, state: 'visible' }).catch(() => {}),
      passwordField.waitFor({ timeout: 10000, state: 'visible' }).catch(() => {}),
      confirmPasswordField.waitFor({ timeout: 10000, state: 'visible' }).catch(() => {})
    ])
    
    // Fill the form fields
    // Note: Fields might be readonly if token prefills them, so we'll remove readonly and set them
    await nameField.evaluate((el: HTMLInputElement, value: string) => {
      el.removeAttribute('readonly')
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        el.value = value
      }
    }, testData.name)
    
    await emailField.evaluate((el: HTMLInputElement, value: string) => {
      el.removeAttribute('readonly')
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        el.value = value
      }
    }, inviteEmail)
    
    await phoneField.evaluate((el: HTMLInputElement, value: string) => {
      el.removeAttribute('readonly')
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        el.value = value
      }
    }, testData.phone)
    
    await passwordField.waitFor({ timeout: 10000, state: 'visible' })
    await passwordField.fill(invitePassword)
    
    await confirmPasswordField.waitFor({ timeout: 10000, state: 'visible' })
    await confirmPasswordField.fill(invitePassword)

    // Step 11: Submit the signup form
    const submitButton = invitePage.getByTestId('signup-submit-button')
    await submitButton.waitFor({ timeout: 10000, state: 'visible' })
    await submitButton.click()

    // Step 12: Verify user is logged in and redirected to home
    await invitePage.waitForSelector('[data-testid="home-header"]', { timeout: 15000 })
    await expect(invitePage.getByLabel('home-header').or(invitePage.getByTestId('home-header'))).toBeVisible()

    console.log('✅ End-to-end invite caregiver workflow completed successfully!')
    console.log('   - Admin logged in')
    console.log('   - Invite sent via real backend API')
    console.log('   - Real email sent via Ethereal')
    console.log('   - Email retrieved from Ethereal IMAP')
    console.log('   - Token extracted from email content')
    console.log('   - Invite link clicked')
    console.log('   - Signup form completed')
    console.log('   - User registered and logged in')

    // Close the invite page
    await invitePage.close()
  })

  test('invite email contains correct link format', async ({ page }) => {
    // Step 1: Admin logs in
    await page.goto('http://localhost:8081')
    await loginUserViaUI(page, TEST_USERS.ORG_ADMIN.email, TEST_USERS.ORG_ADMIN.password)

    // Step 2: Navigate to Organization screen
    const orgTab = page.locator('[data-testid="tab-org"], [aria-label="Organization tab"]').first()
    await orgTab.waitFor({ timeout: 10000, state: 'visible' })
    await orgTab.click()
    await page.waitForSelector('[data-testid="org-screen"]', { timeout: 10000 })

    // Step 3: Send invite
    const inviteButton = page.locator('[data-testid="invite-caregiver-button"]').first()
    await inviteButton.waitFor({ timeout: 10000, state: 'visible' })
    await inviteButton.click()
    
    await page.waitForSelector('[data-testid="caregiver-screen"]', { timeout: 15000 })
    await page.waitForTimeout(2000)

    const nameInput = page.locator('[data-testid="caregiver-name-input"]').first()
    await nameInput.waitFor({ timeout: 10000, state: 'visible' })
    await nameInput.fill(testData.name)
    
    const emailInput = page.locator('[data-testid="caregiver-email-input"]').first()
    await emailInput.waitFor({ timeout: 10000, state: 'visible' })
    await emailInput.fill(inviteEmail)
    
    const phoneInput = page.locator('[data-testid="caregiver-phone-input"]').first()
    await phoneInput.waitFor({ timeout: 10000, state: 'visible' })
    await phoneInput.fill(testData.phone)

    const saveButton = page.locator('[data-testid="caregiver-save-button"]').first()
    await saveButton.waitFor({ timeout: 10000, state: 'visible' })
    await saveButton.click()

    await page.waitForSelector('[data-testid="caregiver-invited-screen"]', { timeout: 10000 })

    // Step 4: Retrieve the email from Ethereal
    console.log(`📧 Retrieving invite email from Ethereal for ${inviteEmail}...`)
    await page.waitForTimeout(3000) // Give email time to arrive
    
    const email = await getEmailFromEthereal(page, inviteEmail, true, 30000)
    
    // Extract the invite link from the email
    const emailText = email.text || ''
    const emailHtml = email.html || ''
    
    // Find the invite link in the email
    const linkMatch = emailText.match(/http:\/\/localhost:8081\/signup\?token=[^\s]+/) ||
                      emailHtml.match(/http:\/\/localhost:8081\/signup\?token=[^"'\s&]+/)
    
    expect(linkMatch).toBeTruthy()
    const frontendLink = linkMatch[0]
    
    // Verify link format
    expect(frontendLink).toMatch(/^http:\/\/localhost:8081\/signup\?token=.+$/)
    expect(frontendLink).not.toContain('localhost:3000')
    expect(frontendLink).not.toContain('/v1')
    
    // Parse and verify URL components
    const url = new URL(frontendLink)
    expect(url.protocol).toBe('http:')
    expect(url.hostname).toBe('localhost')
    expect(url.port).toBe('8081')
    expect(url.pathname).toBe('/signup')
    expect(url.searchParams.get('token')).toBeTruthy()
    
    // Verify the token matches the one extracted from email
    const emailToken = email.tokens.invite
    const linkToken = url.searchParams.get('token')
    expect(emailToken).toBe(linkToken)
    
    console.log('✅ Invite email retrieved and link format verified')
    console.log(`   Email subject: ${email.subject}`)
    console.log(`   Token matches: ${emailToken === linkToken}`)
  })
})

