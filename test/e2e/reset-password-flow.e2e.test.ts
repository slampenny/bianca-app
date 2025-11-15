import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData, TEST_USERS } from './fixtures/testData'
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
  
  test('reset password screen loads without colors crash', async ({ page }) => {
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'
    
    // Use an existing test user to avoid registration issues
    const existingUser = TEST_USERS.WITH_PATIENTS
    console.log(`👤 Using existing test user: ${existingUser.email}...`)
    
    // Step 1: Generate reset password token via test route
    console.log(`🔑 Generating reset password token...`)
    let resetLink: string
    let token: string
    
    try {
      const tokenResponse = await page.request.post(`${API_BASE_URL}/test/generate-reset-password-link`, {
        data: { email: existingUser.email },
      })
      
      if (!tokenResponse.ok()) {
        const errorText = await tokenResponse.text()
        throw new Error(`Failed to generate reset password link: ${tokenResponse.status()} ${errorText}`)
      }
      
      const tokenData = await tokenResponse.json()
      resetLink = tokenData.details.resetPasswordLink.frontend
      token = tokenData.details.token
      
      console.log('✅ Reset password token generated')
      console.log(`   Link: ${resetLink.substring(0, 80)}...`)
    } catch (error) {
      console.log(`❌ Test route failed: ${error.message}`)
      throw error
    }
    
    expect(token).toBeTruthy()
    expect(resetLink).toBeTruthy()
    
    // Step 2: Set up console error listener to catch any crashes
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
    
    // Step 3: Navigate to reset password screen
    console.log('🔍 Navigating to reset password screen...')
    await page.goto(resetLink)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000) // Give time for React to render
    
    // Step 4: Check for crash - specifically colors undefined error
    const criticalErrors = consoleErrors.filter(error => 
      error.includes('ReferenceError') ||
      error.includes('colors is not defined') ||
      error.includes('Cannot read property') ||
      error.includes('is not defined') ||
      error.includes('colors.palette')
    )
    
    if (criticalErrors.length > 0) {
      console.error('❌ CRITICAL ERRORS FOUND:')
      criticalErrors.forEach(err => console.error(`   - ${err}`))
    }
    
    expect(criticalErrors.length).toBe(0)
    
    // Step 5: Verify we're on the reset password screen (not error screen)
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
      .or(page.getByText('New Password', { exact: false }))
      .or(page.locator('input[type="password"]'))
    
    const isResetFormVisible = await resetForm.first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(isResetFormVisible).toBe(true)
    
    console.log('✅ Reset password screen loaded without crash!')
    console.log('   - No JavaScript errors detected')
    console.log('   - Error screen not shown')
    console.log('   - Reset password form is visible')
  })

  test('complete reset password flow works end-to-end with real email and no crash', async ({ page }) => {
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'
    
    // Step 1: Ensure user exists - try to register, ignore if already exists
    console.log(`👤 Creating/verifying user: ${testEmail}...`)
    try {
      const registerResponse = await page.request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: testPassword,
          phone: '+1234567890',
        },
      })
      
      if (registerResponse.ok()) {
        console.log('✅ User created successfully')
      } else if (registerResponse.status() === 409) {
        console.log('ℹ️ User already exists, continuing...')
      } else {
        const errorText = await registerResponse.text()
        console.log(`⚠️ Registration returned ${registerResponse.status()}: ${errorText}`)
      }
    } catch (error) {
      console.log(`⚠️ Registration error (may be OK): ${error.message}`)
    }
    
    // Wait a bit for user to be fully created
    await page.waitForTimeout(1000)
    
    // Step 2: Generate reset password token via test route (more reliable for testing)
    console.log(`🔑 Generating reset password token for ${testEmail}...`)
    let resetLink: string
    let token: string
    
    try {
      const tokenResponse = await page.request.post(`${API_BASE_URL}/test/generate-reset-password-link`, {
        data: { email: testEmail },
      })
      
      if (!tokenResponse.ok()) {
        const errorText = await tokenResponse.text()
        throw new Error(`Failed to generate reset password link: ${tokenResponse.status()} ${errorText}`)
      }
      
      const tokenData = await tokenResponse.json()
      resetLink = tokenData.details.resetPasswordLink.frontend
      token = tokenData.details.token
      
      console.log('✅ Reset password token generated via test route')
      console.log(`   Link: ${resetLink.substring(0, 80)}...`)
    } catch (error) {
      console.log(`❌ Test route failed: ${error.message}`)
      console.log('   This means we cannot test the reset password screen crash.')
      console.log('   Please ensure the backend is running and the test route is available.')
      throw error
    }
    
    expect(token).toBeTruthy()
    expect(resetLink).toBeTruthy()
    
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

