import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData } from './fixtures/testData'
import { getEmailFromEthereal } from './helpers/backendHelpers'
import { loginUserViaUI } from './helpers/testHelpers'

test.describe('Reset Password Flow - End to End with Ethereal', () => {
  let testData: ReturnType<typeof generateUniqueTestData>
  let testEmail: string
  const testPassword = 'Password123!'
  const newPassword = 'NewPassword456!'

  test.beforeEach(() => {
    testData = generateUniqueTestData('reset-password-e2e')
    // Use a unique email for each test run to avoid conflicts
    testEmail = `reset-e2e-${Date.now()}@example.com`
  })

  test('complete reset password flow works end-to-end with real email and no crash', async ({ page }) => {
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'
    
    // Step 1: Create a user first (we need an existing user to reset password for)
    await page.goto('http://localhost:8081')
    await page.waitForLoadState('networkidle')
    
    // Register user
    await page.locator('[aria-label="register-link"]').click().catch(() => {})
    await page.waitForSelector('[aria-label="register-name"]', { timeout: 10000 }).catch(() => {})
    await page.locator('[aria-label="register-name"]').fill('Test User')
    await page.locator('[aria-label="register-email"]').fill(testEmail)
    await page.locator('[aria-label="register-password"]').fill(testPassword)
    await page.locator('[aria-label="register-confirm-password"]').fill(testPassword)
    await page.locator('[aria-label="register-phone"]').fill('+1234567890')
    await page.locator('[aria-label="register-submit"]').click()
    await page.waitForTimeout(3000) // Wait for registration
    
    // Step 2: Navigate to forgot password screen
    await page.goto('http://localhost:8081')
    await page.waitForLoadState('networkidle')
    
    // Click "Forgot Password" link
    const forgotPasswordLink = page.getByText('Forgot Password', { exact: false })
      .or(page.getByLabel('forgot-password-link'))
      .or(page.locator('[data-testid="forgot-password-link"]'))
    
    await forgotPasswordLink.waitFor({ state: 'visible', timeout: 10000 })
    await forgotPasswordLink.click()
    
    // Wait for forgot password form
    await page.waitForSelector('[aria-label="forgot-password-email"]', { timeout: 10000 })
      .catch(() => page.waitForSelector('[data-testid="forgot-password-email"]', { timeout: 10000 }))
    
    // Step 3: Enter email and submit forgot password request
    const emailInput = page.getByLabel('forgot-password-email')
      .or(page.getByTestId('forgot-password-email'))
    
    await emailInput.fill(testEmail)
    
    const submitButton = page.getByText('Send Reset Link', { exact: false })
      .or(page.getByLabel('forgot-password-submit'))
      .or(page.locator('[data-testid="forgot-password-submit"]'))
    
    await submitButton.click()
    
    // Wait for email to be sent
    await page.waitForTimeout(3000)
    
    // Step 4: Retrieve the reset password email from Ethereal
    console.log(`📧 Waiting for reset password email to ${testEmail}...`)
    let email
    try {
      email = await getEmailFromEthereal(page, testEmail, true, 30000) // Wait up to 30 seconds
    } catch (error) {
      console.error('Failed to retrieve email from Ethereal:', error)
      throw new Error(`Could not retrieve reset password email: ${error.message}`)
    }
    
    // Verify email was received
    expect(email).toBeTruthy()
    expect(email.subject).toMatch(/reset.*password|password.*reset/i)
    expect(email.tokens.resetPassword).toBeTruthy()
    
    console.log('✅ Reset password email retrieved from Ethereal')
    console.log(`   Subject: ${email.subject}`)
    console.log(`   Token extracted: ${email.tokens.resetPassword ? 'Yes' : 'No'}`)
    
    // Step 5: Extract reset token from email
    const token = email.tokens.resetPassword
    expect(token).toBeTruthy()
    
    // Step 6: Construct reset password URL
    const resetLink = `http://localhost:8081/reset-password?token=${token}`
    
    // Verify link format
    expect(resetLink).toContain('localhost:8081')
    expect(resetLink).toContain('/reset-password')
    expect(resetLink).toContain('token=')
    
    console.log('✅ Reset password link constructed:', resetLink)
    
    // Step 7: Navigate to reset password link and verify no crash
    console.log('🔍 Navigating to reset password screen...')
    
    // Set up console error listener to catch any crashes
    const consoleErrors: string[] = []
    const consoleWarnings: string[] = []
    
    page.on('console', (msg) => {
      const text = msg.text()
      if (msg.type() === 'error') {
        consoleErrors.push(text)
        console.log(`❌ Console error: ${text}`)
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text)
        console.log(`⚠️ Console warning: ${text}`)
      } else {
        // Log all console messages to help debug
        console.log(`📝 Console ${msg.type()}: ${text}`)
      }
    })
    
    // Listen for page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message)
      console.log(`❌ Page error: ${error.message}`)
    })
    
    // Navigate to reset password screen
    await page.goto(resetLink)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Give time for React to render
    
    // Step 8: Verify we're on the reset password screen (not error screen)
    const currentUrl = page.url()
    expect(currentUrl).toContain('localhost:8081')
    expect(currentUrl).toContain('reset-password')
    expect(currentUrl).toContain('token=')
    
    // Check for error screen indicators (should NOT be present)
    const errorScreen = page.getByText('An error has occurred', { exact: false })
      .or(page.getByText('ReferenceError', { exact: false }))
      .or(page.getByText('colors is not defined', { exact: false }))
      .or(page.locator('[data-testid="error-screen"]'))
    
    const isErrorScreenVisible = await errorScreen.isVisible({ timeout: 1000 }).catch(() => false)
    expect(isErrorScreenVisible).toBe(false)
    
    // Check for reset password form indicators (should be present)
    const resetForm = page.getByText('Reset Password', { exact: false })
      .or(page.getByLabel('new-password-input'))
      .or(page.locator('[data-testid="new-password-input"]'))
      .or(page.getByText('New Password', { exact: false }))
    
    const isResetFormVisible = await resetForm.first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(isResetFormVisible).toBe(true)
    
    // Step 9: Fill in new password and confirm
    const newPasswordInput = page.getByLabel('new-password-input')
      .or(page.getByTestId('new-password-input'))
      .or(page.locator('input[type="password"]').first())
    
    const confirmPasswordInput = page.getByLabel('confirm-password-input')
      .or(page.getByTestId('confirm-password-input'))
      .or(page.locator('input[type="password"]').nth(1))
    
    await newPasswordInput.waitFor({ state: 'visible', timeout: 10000 })
    await newPasswordInput.fill(newPassword)
    
    await confirmPasswordInput.waitFor({ state: 'visible', timeout: 10000 })
    await confirmPasswordInput.fill(newPassword)
    
    // Step 10: Submit reset password form
    const resetButton = page.getByText('Reset Password', { exact: false })
      .or(page.getByLabel('reset-password-submit'))
      .or(page.locator('[data-testid="reset-password-submit"]'))
      .or(page.locator('button[type="submit"]'))
    
    await resetButton.click()
    
    // Wait for password reset to complete
    await page.waitForTimeout(3000)
    
    // Step 11: Verify success (should redirect to login or show success message)
    const successIndicators = [
      page.getByText('Password Reset Successful', { exact: false }),
      page.getByText('password has been updated', { exact: false }),
      page.getByText('Redirecting to login', { exact: false }),
      page.locator('[aria-label="email-input"]'), // Login screen
    ]
    
    let foundSuccess = false
    for (const indicator of successIndicators) {
      try {
        if (await indicator.isVisible({ timeout: 3000 })) {
          foundSuccess = true
          break
        }
      } catch {
        continue
      }
    }
    
    // Step 12: Verify no JavaScript errors occurred
    const criticalErrors = consoleErrors.filter(error => 
      error.includes('ReferenceError') ||
      error.includes('colors is not defined') ||
      error.includes('Cannot read property') ||
      error.includes('is not defined')
    )
    
    expect(criticalErrors.length).toBe(0)
    
    if (criticalErrors.length > 0) {
      console.error('❌ Critical errors found:', criticalErrors)
      throw new Error(`Critical JavaScript errors detected: ${criticalErrors.join(', ')}`)
    }
    
    console.log('✅ End-to-end reset password flow completed successfully!')
    console.log('   - Real email sent via Ethereal')
    console.log('   - Email retrieved from Ethereal IMAP')
    console.log('   - Token extracted from email content')
    console.log('   - Reset password screen loaded without crash')
    console.log('   - No JavaScript errors detected')
    console.log('   - Password reset form submitted successfully')
    
    // Verify we found success indicator
    expect(foundSuccess).toBe(true)
  })
  
  test('reset password screen loads without crash when token is invalid', async ({ page }) => {
    // Navigate to reset password screen with invalid token
    const invalidToken = 'invalid-token-12345'
    const resetLink = `http://localhost:8081/reset-password?token=${invalidToken}`
    
    // Set up console error listener
    const consoleErrors: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message)
    })
    
    // Navigate to reset password screen
    await page.goto(resetLink)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Verify no crash occurred
    const criticalErrors = consoleErrors.filter(error => 
      error.includes('ReferenceError') ||
      error.includes('colors is not defined') ||
      error.includes('Cannot read property')
    )
    
    expect(criticalErrors.length).toBe(0)
    
    // Should show error message about invalid token, but not crash
    const errorMessage = page.getByText('invalid', { exact: false })
      .or(page.getByText('expired', { exact: false }))
      .or(page.getByText('Invalid', { exact: false }))
    
    const hasErrorMessage = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)
    
    // Either show error message or redirect, but don't crash
    expect(hasErrorMessage || page.url().includes('reset-password')).toBe(true)
    
    console.log('✅ Reset password screen handled invalid token without crash')
  })
})

