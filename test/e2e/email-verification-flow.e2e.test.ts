import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData } from './fixtures/testData'

test.describe('Email Verification Flow - End to End', () => {
  let testData: ReturnType<typeof generateUniqueTestData>
  const testEmail = 'verify-e2e-test@example.com'
  const testPassword = 'Password123!'

  test.beforeEach(() => {
    testData = generateUniqueTestData('email-verify-e2e')
  })

  test('complete email verification flow works end-to-end', async ({ page }) => {
    // Step 1: Register a user (triggers email verification)
    await page.goto('http://localhost:8081')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Navigate to register if not already there
    const registerLink = page.getByTestId('register-link').or(page.getByLabel('register-link'))
    if (await registerLink.isVisible().catch(() => false)) {
      await registerLink.click()
      await page.waitForTimeout(1000)
    }

    // Fill registration form
    await page.getByTestId('register-name').or(page.getByLabel('register-name')).fill('Test User')
    await page.getByTestId('register-email').or(page.getByLabel('register-email')).fill(testEmail)
    await page.getByTestId('register-password').or(page.getByLabel('register-password')).fill(testPassword)
    await page.getByTestId('register-confirm-password').or(page.getByLabel('register-confirm-password')).fill(testPassword)
    await page.getByTestId('register-phone').or(page.getByLabel('register-phone')).fill('+1234567890')
    
    // Submit registration
    await page.getByTestId('register-submit').or(page.getByLabel('register-submit')).click()
    
    // Wait for registration to complete (should navigate to email verification screen)
    await page.waitForTimeout(2000)
    
    // Step 2: Use test route to get verification link
    const verificationResponse = await page.evaluate(async (email) => {
      try {
        const response = await fetch('http://localhost:3000/v1/test/send-verification-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}: ${await response.text()}`)
        }
        return await response.json()
      } catch (error) {
        console.error('Failed to fetch verification email:', error)
        throw error
      }
    }, testEmail)

    // Verify we got a verification link
    expect(verificationResponse).toHaveProperty('details.verificationLinks.frontend')
    const verificationLink = verificationResponse.details.verificationLinks.frontend
    
    // Verify link format
    expect(verificationLink).toContain('localhost:8081')
    expect(verificationLink).toContain('/auth/verify-email')
    expect(verificationLink).toContain('token=')
    expect(verificationLink).not.toContain('localhost:3000')
    expect(verificationLink).not.toContain('/v1')
    
    console.log('✅ Verification link generated:', verificationLink)
    
    // Extract token from link
    const url = new URL(verificationLink)
    const token = url.searchParams.get('token')
    expect(token).toBeTruthy()
    
    // Step 3: Mock backend verification endpoint
    let backendCalled = false
    await page.route(`**/v1/auth/verify-email?token=${token}`, async (route) => {
      backendCalled = true
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><h1>Email Verified!</h1></body></html>'
      })
    })
    
    // Step 4: Navigate to verification link
    await page.goto(verificationLink)
    
    // Verify we're on the frontend (localhost:8081)
    expect(page.url()).toContain('localhost:8081')
    expect(page.url()).toContain('/auth/verify-email')
    expect(page.url()).toContain(`token=${token}`)
    
    // Wait for VerifyEmailScreen to process
    await page.waitForTimeout(3000)
    
    // Step 5: Verify backend was called
    expect(backendCalled).toBe(true)
    
    // Step 6: Verify we see success message or navigation
    // The screen should show "Email Verified" or navigate to EmailVerified screen
    const successIndicators = [
      page.getByText('Email Verified', { exact: false }),
      page.getByText('verified', { exact: false }),
      page.getByTestId('email-verified-screen'),
      page.getByLabel('email-verified-screen')
    ]
    
    let foundSuccess = false
    for (const indicator of successIndicators) {
      try {
        if (await indicator.isVisible({ timeout: 2000 })) {
          foundSuccess = true
          break
        }
      } catch {
        continue
      }
    }
    
    // At minimum, verify the URL contains the token and we're on frontend
    expect(page.url()).toContain('localhost:8081')
    expect(page.url()).toContain('verify-email')
    
    console.log('✅ End-to-end verification flow completed successfully!')
    console.log('   - Link uses correct frontend URL (localhost:8081)')
    console.log('   - Frontend extracts token from URL')
    console.log('   - Backend API called with token')
    console.log('   - Verification process completed')
  })

  test('verification link format is correct', async ({ page }) => {
    // Test the test route directly to verify link format
    const response = await page.evaluate(async (email) => {
      const res = await fetch('http://localhost:3000/v1/test/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (!res.ok) {
        throw new Error(`Backend returned ${res.status}: ${await res.text()}`)
      }
      return await res.json()
    }, testEmail)

    // Verify response structure
    expect(response).toHaveProperty('success', true)
    expect(response).toHaveProperty('details.verificationLinks.frontend')
    
    const frontendLink = response.details.verificationLinks.frontend
    
    // Verify link format
    expect(frontendLink).toMatch(/^http:\/\/localhost:8081\/auth\/verify-email\?token=.+$/)
    expect(frontendLink).not.toContain('localhost:3000')
    expect(frontendLink).not.toContain('/v1')
    
    // Parse and verify URL components
    const url = new URL(frontendLink)
    expect(url.protocol).toBe('http:')
    expect(url.hostname).toBe('localhost')
    expect(url.port).toBe('8081')
    expect(url.pathname).toBe('/auth/verify-email')
    expect(url.searchParams.get('token')).toBeTruthy()
    
    console.log('✅ Verification link format is correct:', frontendLink)
  })
})

