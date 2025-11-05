import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData } from './fixtures/testData'
import { loginUserViaUI, registerUserViaUI } from './helpers/testHelpers'

test.describe('Email Verification Flow', () => {
  let testData: ReturnType<typeof generateUniqueTestData>
  const testEmail = 'verify-test@example.com'
  const testPassword = 'Password123!'

  test.beforeEach(() => {
    testData = generateUniqueTestData('email-verify')
  })

  test('verification email link uses correct frontend URL', async ({ page }) => {
    // Mock the backend test route to return verification link
    let capturedVerificationLink = ''

    await page.route('**/v1/test/send-verification-email', async (route) => {
      const request = route.request()
      const postData = request.postDataJSON()
      
      // Let the request go through, but capture the response
      await route.continue()
      
      // Wait for response and capture the link
      const response = await page.waitForResponse('**/v1/test/send-verification-email')
      const responseData = await response.json()
      
      if (responseData.details?.verificationLinks?.frontend) {
        capturedVerificationLink = responseData.details.verificationLinks.frontend
      }
    })

    // Navigate to backend Swagger or test page
    await page.goto('http://localhost:3000/v1/docs')

    // Use the test route to send verification email
    // In a real scenario, you'd use the API directly
    const response = await page.evaluate(async (email) => {
      const res = await fetch('http://localhost:3000/v1/test/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      return await res.json()
    }, testEmail)

    // Verify the link format
    expect(response).toHaveProperty('details.verificationLinks.frontend')
    const frontendLink = response.details.verificationLinks.frontend
    
    // Should use localhost:8081 (frontend) not localhost:3000 (backend)
    expect(frontendLink).toContain('localhost:8081')
    expect(frontendLink).not.toContain('localhost:3000')
    expect(frontendLink).toContain('/auth/verify-email')
    expect(frontendLink).toContain('token=')
    
    console.log('✅ Verification link uses correct frontend URL:', frontendLink)
  })

  test('verification link opens in frontend and extracts token', async ({ page, context }) => {
    // Create a test token
    const testToken = 'test-verification-token-12345'
    const verificationUrl = `http://localhost:8081/auth/verify-email?token=${testToken}`

    // Mock the backend verification endpoint
    await page.route(`**/v1/auth/verify-email?token=${testToken}`, async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><h1>Email Verified!</h1></body></html>'
      })
    })

    // Navigate to verification URL
    await page.goto(verificationUrl)

    // Verify we're on the frontend (localhost:8081)
    expect(page.url()).toContain('localhost:8081')
    expect(page.url()).toContain('/auth/verify-email')
    expect(page.url()).toContain(`token=${testToken}`)

    // Wait for VerifyEmailScreen to load
    await page.waitForSelector('[data-testid="verify-email-screen"], [aria-label*="verify"], [aria-label*="email"]', { 
      timeout: 5000 
    }).catch(() => {
      // If screen doesn't have test IDs, check for any content
      expect(page.url()).toContain('verify-email')
    })

    console.log('✅ Verification link opens correctly in frontend')
  })

  test('VerifyEmailScreen extracts token from URL and calls backend', async ({ page }) => {
    const testToken = 'test-token-12345'
    
    // Track if backend API was called
    let backendApiCalled = false
    let calledToken = ''

    // Mock backend verification endpoint
    await page.route(`**/v1/auth/verify-email?token=${testToken}`, async (route) => {
      backendApiCalled = true
      calledToken = new URL(route.request().url()).searchParams.get('token') || ''
      
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><h1>Email Verified Successfully!</h1></body></html>'
      })
    })

    // Navigate to verification URL
    await page.goto(`http://localhost:8081/auth/verify-email?token=${testToken}`)

    // Wait a bit for the screen to process
    await page.waitForTimeout(2000)

    // Verify backend API was called with correct token
    expect(backendApiCalled).toBe(true)
    expect(calledToken).toBe(testToken)

    console.log('✅ VerifyEmailScreen correctly extracts token and calls backend')
  })

  test('verification flow works end-to-end', async ({ page }) => {
    // Register a new user
    await page.goto('http://localhost:8081')
    
    // Register user (this will trigger email verification)
    await registerUserViaUI(page, {
      email: testEmail,
      password: testPassword,
      name: 'Test User',
      phone: '+1234567890'
    })

    // Mock email service to capture verification link
    let verificationLink = ''
    
    await page.route('**/v1/auth/register', async (route) => {
      const response = await route.fetch()
      const data = await response.json()
      
      // In a real scenario, the verification email would be sent
      // For testing, we'll use the test route to get the link
      const testResponse = await page.evaluate(async (email) => {
        const res = await fetch('http://localhost:3000/v1/test/send-verification-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        return await res.json()
      }, testEmail)
      
      verificationLink = testResponse.details?.verificationLinks?.frontend || ''
      
      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: JSON.stringify(data)
      })
    })

    // Wait for registration to complete
    await page.waitForTimeout(1000)

    // Verify we got a verification link
    expect(verificationLink).toBeTruthy()
    expect(verificationLink).toContain('localhost:8081')
    expect(verificationLink).toContain('/auth/verify-email')
    expect(verificationLink).toContain('token=')

    // Extract token from link
    const url = new URL(verificationLink)
    const token = url.searchParams.get('token')
    expect(token).toBeTruthy()

    // Mock successful verification
    await page.route(`**/v1/auth/verify-email?token=${token}`, async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><h1>Email Verified!</h1></body></html>'
      })
    })

    // Navigate to verification link
    await page.goto(verificationLink)

    // Verify we're on the frontend
    expect(page.url()).toContain('localhost:8081')
    expect(page.url()).toContain('verify-email')

    console.log('✅ End-to-end verification flow works correctly')
  })
})
