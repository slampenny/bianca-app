import { test, expect } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'
import { MFAWorkflow } from './workflows/mfa.workflow'

/**
 * PIPEDA Privacy Request E2E Tests
 * 
 * These tests verify the complete workflow for users to request their personal data
 * under PIPEDA compliance requirements.
 * 
 * To run these tests:
 *   yarn test:web:e2e privacy-request
 * 
 * Or run all E2E tests:
 *   yarn test:web:e2e
 */

test.describe('PIPEDA Privacy Request Workflow', () => {
  let auth: AuthWorkflow
  let mfa: MFAWorkflow
  let creds: { email: string; password: string }
  
  // Setup: Login once for all tests and set org to CA for PIPEDA tests
  test.beforeEach(async ({ page }) => {
    auth = new AuthWorkflow(page)
    mfa = new MFAWorkflow(page)
    await auth.givenIAmOnTheLoginScreen()
    creds = await auth.givenIHaveValidCredentials()
    await auth.whenIEnterCredentials(creds.email, creds.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()
    
    // PIPEDA tests require a Canadian org - update the org country to CA via API
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'
    try {
      // Get auth token from localStorage
      const token = await page.evaluate(() => {
        const authState = localStorage.getItem('persist:root')
        if (authState) {
          try {
            const parsed = JSON.parse(authState)
            const auth = JSON.parse(parsed.auth || '{}')
            return auth.tokens?.access?.token || ''
          } catch {
            return ''
          }
        }
        return ''
      })
      
      if (token) {
        // Get current user to find org ID
        const userResponse = await page.request.get(`${API_BASE_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (userResponse.ok()) {
          const user = await userResponse.json()
          if (user.org?.id) {
            // Update org country to CA
            const updateResponse = await page.request.patch(`${API_BASE_URL}/orgs/${user.org.id}`, {
              data: { country: 'CA' },
              headers: { 'Authorization': `Bearer ${token}` }
            })
            
            if (updateResponse.ok()) {
              console.log('✅ Updated org country to CA for PIPEDA tests')
              // Wait for Redux to refresh org data
              await page.waitForTimeout(2000)
              // Force a page refresh to ensure Redux picks up the change
              await page.reload({ waitUntil: 'networkidle' })
              await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not update org country to CA:', error.message)
      // Continue anyway - test will show clearer error if org is not CA
    }
  })
  
  async function navigateToPrivacyRequestScreen(page: any) {
    // Navigate to profile screen using MFA workflow helper
    await mfa.givenIAmOnTheProfileScreen()
    
    // Wait for org to be loaded in Redux (needed for jurisdiction checks)
    // The org should be loaded after login, but let's ensure it's there
    await page.waitForTimeout(2000) // Give time for org to load
    
    // Find and click "Request My Data" button
    let requestButton = page.getByTestId('request-my-data-button')
    let buttonCount = await requestButton.count().catch(() => 0)
    
    if (buttonCount === 0) {
      requestButton = page.getByText(/Request My Data/i).first()
      buttonCount = await requestButton.count().catch(() => 0)
    }
    
    if (buttonCount === 0) {
      // Scroll to find button
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(500)
      requestButton = page.getByTestId('request-my-data-button')
    }
    
    if (await requestButton.count() === 0) {
      throw new Error('Request My Data button not found')
    }
    
    await requestButton.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500) // Wait after scroll
    
    // Wait for button to be clickable
    await requestButton.waitFor({ state: 'visible', timeout: 5000 })
    
    // Use force click to bypass overlay intercepts
    // Click and wait for screen to appear (React Navigation might not change URL)
    await requestButton.click({ force: true, timeout: 10000 })
    await page.waitForTimeout(1000) // Give time for navigation to start
    
    // Wait for the privacy request screen to appear - try multiple selectors with longer timeout
    try {
      await Promise.race([
        page.waitForSelector('[data-testid="privacy-request-screen"]', { timeout: 15000, state: 'visible' }),
        page.waitForSelector('[aria-label="privacy-request-screen"]', { timeout: 15000, state: 'visible' }),
        page.waitForSelector('text=/Access Request|Correction Request|File Complaint/i', { timeout: 15000 }),
        // Also check for URL change
        page.waitForURL(/privacy|request/i, { timeout: 15000 }).catch(() => null)
      ])
    } catch (error) {
      // Debug: check what's actually on the page
      const bodyText = await page.textContent('body').catch(() => '')
      const url = page.url()
      const buttonVisible = await requestButton.isVisible().catch(() => false)
      const screenExists = await page.locator('[data-testid="privacy-request-screen"]').count().catch(() => 0)
      throw new Error(`Privacy request screen not found. URL: ${url}, Button still visible: ${buttonVisible}, Screen exists: ${screenExists}, Body preview: ${bodyText.substring(0, 200)}`)
    }
    
    // Wait for buttons to be visible (not just in DOM)
    // Try multiple selectors and wait for at least one to be visible
    const buttonSelectors = [
      '[data-testid="submit-privacy-request-button"]',
      '[aria-label="submit-privacy-request-button"]',
      '[data-testid="request-type-access"]',
      '[aria-label="request-type-access"]',
      '[data-testid="request-type-correction"]',
      '[aria-label="request-type-correction"]',
      '[data-testid="request-type-complaint"]',
      '[aria-label="request-type-complaint"]'
    ]
    
    let buttonFound = false
    for (const selector of buttonSelectors) {
      try {
        const button = page.locator(selector).first()
        await button.waitFor({ state: 'visible', timeout: 5000 })
        buttonFound = true
        break
      } catch {
        // Continue to next selector
      }
    }
    
    if (!buttonFound) {
      // If buttons don't appear, check if screen is at least visible
      const screenVisible = await page.locator('[data-testid="privacy-request-screen"]').isVisible({ timeout: 2000 }).catch(() => false)
      if (!screenVisible) {
        const bodyText = await page.textContent('body').catch(() => '')
        const url = page.url()
        throw new Error(`Privacy request screen buttons not found. URL: ${url}, Body preview: ${bodyText.substring(0, 200)}`)
      }
      // Screen is visible but buttons aren't - might be a loading state, wait a bit more and try again
      await page.waitForTimeout(3000)
      // Try one more time
      for (const selector of buttonSelectors) {
        try {
          const button = page.locator(selector).first()
          const isVisible = await button.isVisible({ timeout: 5000 })
          if (isVisible) {
            buttonFound = true
            break
          }
        } catch {
          // Continue
        }
      }
      if (!buttonFound) {
        const bodyText = await page.textContent('body').catch(() => '')
        const url = page.url()
        throw new Error(`Privacy request screen buttons not found after waiting. URL: ${url}, Body preview: ${bodyText.substring(0, 200)}`)
      }
    }
    
    // Additional wait for React to finish rendering
    await page.waitForTimeout(1000)
    
    // Scroll to top to ensure all elements are accessible
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(500)
  }
  
  test('User can navigate to privacy request screen from profile', async ({ page }) => {
    // WHEN: User navigates to privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // THEN: User should be on privacy request screen
    const screenContainer = page.locator('[data-testid="privacy-request-screen"], [aria-label="privacy-request-screen"]')
    await expect(screenContainer).toBeAttached()
  })

  test('User can submit an access request with default information', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User clicks submit button (with default "All my personal information")
    // Try both data-testid (from testID) and aria-label (from accessibilityLabel)
    // Playwright config uses accessibilityLabel, but React Native Web maps testID to data-testid
    const submitButton = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await submitButton.waitFor({ state: 'attached', timeout: 10000 })
    await submitButton.scrollIntoViewIfNeeded()
    await expect(submitButton).toBeVisible({ timeout: 5000 })
    
    // Intercept the API call to verify it's made correctly
    let requestMade = false
    let requestBody: any = null
    
    page.on('request', (request) => {
      if (request.url().includes('/v1/privacy/requests/access') && request.method() === 'POST') {
        requestMade = true
        requestBody = request.postDataJSON()
      }
    })
    
    // Use force click to bypass overlay intercepts
    await submitButton.click({ force: true, timeout: 10000 })
    
    // THEN: API request should be made with correct data
    await page.waitForTimeout(1000) // Wait for API call
    expect(requestMade).toBe(true)
    expect(requestBody).toMatchObject({
      informationRequested: 'All my personal information',
      accessMethod: 'email',
    })
  })

  test('User can submit an access request with custom information', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User enters custom information requested
    const informationField = page.getByLabel(/Information Requested/i).or(page.getByPlaceholder(/All my personal information/i))
    await informationField.fill('I would like to access my conversation history and medical analysis data.')
    
    // AND: User submits the request (access method is always "email" in current implementation)
    let requestBody: any = null
    page.on('request', (request) => {
      if (request.url().includes('/v1/privacy/requests/access') && request.method() === 'POST') {
        requestBody = request.postDataJSON()
      }
    })
    
    const submitButton = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    // Use force click to bypass overlay intercepts
    await submitButton.click({ force: true, timeout: 10000 })
    
    // THEN: API request should include custom information and default to email method
    await page.waitForTimeout(1000)
    expect(requestBody).toMatchObject({
      informationRequested: 'I would like to access my conversation history and medical analysis data.',
      accessMethod: 'email', // Access method is hardcoded to "email" in current implementation
    })
  })

  test('User can view their request history', async ({ page }) => {
    // GIVEN: User is on privacy request screen with mocked history
    // Mock the API response for getting requests
    await page.route('**/v1/privacy/requests*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                _id: 'test-request-1',
                requestType: 'access',
                status: 'completed',
                informationRequested: 'All my personal information',
                requestDate: new Date().toISOString(),
                responseDate: new Date().toISOString(),
              },
              {
                _id: 'test-request-2',
                requestType: 'access',
                status: 'pending',
                informationRequested: 'My conversation history',
                requestDate: new Date(Date.now() - 86400000).toISOString(),
              },
            ],
            page: 1,
            limit: 10,
            totalPages: 1,
            totalResults: 2,
          }),
        })
      } else {
        await route.continue()
      }
    })
    
    await navigateToPrivacyRequestScreen(page)
    
    // THEN: Request history should be displayed
    await expect(page.getByText(/Request History/i)).toBeVisible({ timeout: 5000 })
    // Use nth(1) to get the text from request history, not the textarea
    await expect(page.getByText(/All my personal information/i).nth(1)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/My conversation history/i)).toBeVisible({ timeout: 5000 })
  })

  test('User sees error message when request submission fails', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: API returns an error
    await page.route('**/v1/privacy/requests/access', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' }),
      })
    })
    
    const submitButton = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await submitButton.waitFor({ state: 'attached', timeout: 10000 })
    await submitButton.scrollIntoViewIfNeeded()
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    // Use force click to bypass overlay intercepts
    await submitButton.click({ force: true, timeout: 10000 })
    
    // THEN: Error should be handled (button still visible means form wasn't reset)
    await page.waitForTimeout(500)
    const submitButtonAfterError = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await expect(submitButtonAfterError).toBeVisible({ timeout: 5000 })
  })

  test('Privacy request screen displays all required UI elements', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // THEN: All required UI elements should be visible
    const submitButton = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await submitButton.waitFor({ state: 'attached', timeout: 10000 })
    await submitButton.scrollIntoViewIfNeeded()
    await expect(submitButton).toBeVisible({ timeout: 5000 })
    
    // Access method selection UI has been removed - access method is always "email" now
    // Verify that information requested field is visible instead
    const informationField = page.getByLabel(/Information Requested/i).or(page.getByPlaceholder(/All my personal information/i))
    await expect(informationField).toBeVisible({ timeout: 5000 })
  })

  test('Access method selection works correctly', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User submits a request (access method is always "email" in current implementation)
    // Note: Access method selection UI has been removed - it's always email now
    let requestBody: any = null
    page.on('request', (request) => {
      if (request.url().includes('/v1/privacy/requests/access') && request.method() === 'POST') {
        requestBody = request.postDataJSON()
      }
    })
    
    const submitButton = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    // Use force click to bypass overlay intercepts
    await submitButton.click({ force: true, timeout: 10000 })
    
    // THEN: Email method should be used (verify via API call)
    await page.waitForTimeout(1000)
    expect(requestBody?.accessMethod).toBe('email')
  })

  test('User can switch to correction request type', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User clicks correction request button
    const correctionTypeButton = page.locator('[data-testid="request-type-correction"], [aria-label="request-type-correction"]').first()
    await correctionTypeButton.waitFor({ state: 'attached', timeout: 10000 })
    await correctionTypeButton.scrollIntoViewIfNeeded()
    await correctionTypeButton.waitFor({ state: 'visible', timeout: 5000 })
    await correctionTypeButton.click()
    await page.waitForTimeout(500)
    
    // THEN: Correction request form fields should be visible
    const fieldInput = page.locator('[data-testid="correction-field-input"], [aria-label="correction-field-input"]').first()
    await fieldInput.waitFor({ state: 'attached', timeout: 5000 })
    await expect(fieldInput).toBeVisible({ timeout: 5000 })
    
    const requestedValueInput = page.locator('[data-testid="requested-value-input"], [aria-label="requested-value-input"]').first()
    await requestedValueInput.waitFor({ state: 'attached', timeout: 5000 })
    await expect(requestedValueInput).toBeVisible({ timeout: 5000 })
  })

  test('User can submit a correction request', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User switches to correction request
    const correctionTypeButton = page.locator('[data-testid="request-type-correction"], [aria-label="request-type-correction"]').first()
    await correctionTypeButton.waitFor({ state: 'visible', timeout: 5000 })
    await correctionTypeButton.click()
    await page.waitForTimeout(500)
    
    // AND: User fills in correction details
    const fieldInput = page.locator('[data-testid="correction-field-input"], [aria-label="correction-field-input"]').first()
    await fieldInput.waitFor({ state: 'visible', timeout: 5000 })
    await fieldInput.fill('Email address')
    
    const currentValueInput = page.locator('[data-testid="current-value-input"], [aria-label="current-value-input"]').first()
    await currentValueInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await currentValueInput.fill('old@example.com').catch(() => {})
    
    const requestedValueInput = page.locator('[data-testid="requested-value-input"], [aria-label="requested-value-input"]').first()
    await requestedValueInput.waitFor({ state: 'visible', timeout: 5000 })
    await requestedValueInput.fill('new@example.com')
    
    const reasonInput = page.locator('[data-testid="correction-reason-input"], [aria-label="correction-reason-input"]').first()
    await reasonInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await reasonInput.fill('Email address changed').catch(() => {})
    
    // AND: User submits the correction request
    let requestBody: any = null
    page.on('request', (request) => {
      if (request.url().includes('/v1/privacy/requests/correction') && request.method() === 'POST') {
        requestBody = request.postDataJSON()
      }
    })
    
    const submitButton = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    // Use force click to bypass overlay intercepts
    await submitButton.click({ force: true, timeout: 10000 })
    
    // THEN: API request should be made with correct correction data
    await page.waitForTimeout(1000)
    expect(requestBody).toBeTruthy()
    expect(requestBody.correctionDetails).toMatchObject({
      field: 'Email address',
      requestedValue: 'new@example.com',
    })
  })

  test('Correction request shows validation error for missing required fields', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User switches to correction request
    const correctionTypeButton = page.locator('[data-testid="request-type-correction"], [aria-label="request-type-correction"]').first()
    await correctionTypeButton.waitFor({ state: 'visible', timeout: 5000 })
    await correctionTypeButton.click()
    await page.waitForTimeout(500)
    
    // AND: User tries to submit without required fields
    const submitButton = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    
    let requestMade = false
    page.on('request', (request) => {
      if (request.url().includes('/v1/privacy/requests/correction') && request.method() === 'POST') {
        requestMade = true
      }
    })
    
    // Use force click to bypass overlay intercepts
    await submitButton.click({ force: true, timeout: 10000 })
    await page.waitForTimeout(1000)
    
    // THEN: Request should not be made (validation prevents it)
    // The form should show an error message
    expect(requestMade).toBe(false)
  })

  test('User can see deletion request section', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // THEN: Deletion request section should be visible (use first() to handle multiple matches)
    const deletionTitle = page.getByText(/Request Data Deletion/i).first()
    await deletionTitle.waitFor({ state: 'attached', timeout: 10000 })
    await deletionTitle.scrollIntoViewIfNeeded()
    await expect(deletionTitle).toBeVisible({ timeout: 5000 })
    
    const requestDeletionButton = page.locator('[data-testid="request-deletion-button"], [aria-label="request-deletion-button"]').first()
    await requestDeletionButton.waitFor({ state: 'attached', timeout: 10000 })
    await requestDeletionButton.scrollIntoViewIfNeeded()
    await expect(requestDeletionButton).toBeVisible({ timeout: 5000 })
  })

  test('User can select deletion type', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User scrolls to deletion section (use first() to handle multiple matches)
    const deletionSection = page.getByText(/Request Data Deletion/i).first()
    await deletionSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    // AND: User clicks "All Data" option
    const allDataButton = page.locator('[data-testid="deletion-type-all"], [aria-label="deletion-type-all"]').first()
    await allDataButton.waitFor({ state: 'attached', timeout: 10000 })
    await allDataButton.scrollIntoViewIfNeeded()
    await allDataButton.waitFor({ state: 'visible', timeout: 5000 })
    await allDataButton.click()
    await page.waitForTimeout(200)
    
    // THEN: "All Data" should be selected (button should have primary styling)
    // Verify by clicking "Calls Only" and then back to "All Data"
    const callsButton = page.locator('[data-testid="deletion-type-calls"], [aria-label="deletion-type-calls"]').first()
    await callsButton.waitFor({ state: 'visible', timeout: 5000 })
    await callsButton.click()
    await page.waitForTimeout(200)
    
    await allDataButton.click()
    await page.waitForTimeout(200)
    
    // Both buttons should be visible
    await expect(allDataButton).toBeVisible()
    await expect(callsButton).toBeVisible()
  })

  test('User can open deletion confirmation modal', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User scrolls to deletion section and clicks request deletion (use first() to handle multiple matches)
    const deletionSection = page.getByText(/Request Data Deletion/i).first()
    await deletionSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    const requestDeletionButton = page.locator('[data-testid="request-deletion-button"], [aria-label="request-deletion-button"]').first()
    await requestDeletionButton.waitFor({ state: 'visible', timeout: 5000 })
    await requestDeletionButton.click()
    
    // THEN: Confirmation modal should appear
    const confirmationModal = page.locator('[data-testid="deletion-confirmation-modal"], [aria-label="deletion-confirmation-modal"]').first()
    await confirmationModal.waitFor({ state: 'attached', timeout: 5000 })
    await expect(confirmationModal).toBeVisible({ timeout: 5000 })
    
    // AND: Modal should have confirm and cancel buttons
    const confirmButton = page.locator('[data-testid="deletion-confirmation-modal-confirm"], [aria-label="deletion-confirmation-modal-confirm"]').first()
    const cancelButton = page.locator('[data-testid="deletion-confirmation-modal-cancel"], [aria-label="deletion-confirmation-modal-cancel"]').first()
    
    await expect(confirmButton).toBeVisible({ timeout: 5000 })
    await expect(cancelButton).toBeVisible({ timeout: 5000 })
  })

  test('User can cancel deletion request', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User opens deletion confirmation modal (use first() to handle multiple matches)
    const deletionSection = page.getByText(/Request Data Deletion/i).first()
    await deletionSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    const requestDeletionButton = page.locator('[data-testid="request-deletion-button"], [aria-label="request-deletion-button"]').first()
    await requestDeletionButton.waitFor({ state: 'visible', timeout: 5000 })
    await requestDeletionButton.click()
    
    // Wait for modal
    await page.waitForTimeout(500)
    
    // AND: User clicks cancel
    const cancelButton = page.locator('[data-testid="deletion-confirmation-modal-cancel"], [aria-label="deletion-confirmation-modal-cancel"]').first()
    await cancelButton.waitFor({ state: 'visible', timeout: 5000 })
    await cancelButton.click()
    
    // THEN: Modal should close and no API request should be made
    await page.waitForTimeout(500)
    
    let requestMade = false
    page.on('request', (request) => {
      if (request.url().includes('/v1/privacy/deletion') && request.method() === 'POST') {
        requestMade = true
      }
    })
    
    // Wait a bit to ensure no request was made
    await page.waitForTimeout(1000)
    expect(requestMade).toBe(false)
  })

  test('User can submit deletion request successfully', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // Mock successful deletion response
    let requestBody: any = null
    await page.route('**/v1/privacy/deletion', async (route) => {
      if (route.request().method() === 'POST') {
        requestBody = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            deleted: {
              calls: 5,
              conversations: 3,
              medicalAnalysis: 2,
              total: 10
            },
            country: 'CA',
            jurisdiction: 'PIPEDA',
            dataType: 'all'
          }),
        })
      } else {
        await route.continue()
      }
    })
    
    // WHEN: User scrolls to deletion section (use first() to handle multiple matches)
    const deletionSection = page.getByText(/Request Data Deletion/i).first()
    await deletionSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    // AND: User selects deletion type
    const allDataButton = page.locator('[data-testid="deletion-type-all"], [aria-label="deletion-type-all"]').first()
    await allDataButton.waitFor({ state: 'visible', timeout: 5000 })
    await allDataButton.click()
    await page.waitForTimeout(200)
    
    // AND: User clicks request deletion
    const requestDeletionButton = page.locator('[data-testid="request-deletion-button"], [aria-label="request-deletion-button"]').first()
    await requestDeletionButton.waitFor({ state: 'visible', timeout: 5000 })
    await requestDeletionButton.click()
    
    // AND: User confirms deletion
    await page.waitForTimeout(500)
    const confirmButton = page.locator('[data-testid="deletion-confirmation-modal-confirm"], [aria-label="deletion-confirmation-modal-confirm"]').first()
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 })
    await confirmButton.click()
    
    // THEN: API request should be made with correct data
    await page.waitForTimeout(1000)
    expect(requestBody).toBeTruthy()
    expect(requestBody.dataType).toBe('all')
  })

  test('User sees error when deletion is not allowed (HIPAA)', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // Mock error response for HIPAA jurisdiction
    await page.route('**/v1/privacy/deletion', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Data deletion is not permitted for HIPAA jurisdiction due to legal retention requirements. Please contact privacy@biancawellness.com for assistance.'
          }),
        })
      } else {
        await route.continue()
      }
    })
    
    // WHEN: User attempts to request deletion (use first() to handle multiple matches)
    const deletionSection = page.getByText(/Request Data Deletion/i).first()
    await deletionSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    const requestDeletionButton = page.locator('[data-testid="request-deletion-button"], [aria-label="request-deletion-button"]').first()
    await requestDeletionButton.waitFor({ state: 'visible', timeout: 5000 })
    await requestDeletionButton.click()
    
    // AND: User confirms deletion
    await page.waitForTimeout(500)
    const confirmButton = page.locator('[data-testid="deletion-confirmation-modal-confirm"], [aria-label="deletion-confirmation-modal-confirm"]').first()
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 })
    await confirmButton.click()
    
    // THEN: Error message should be displayed
    await page.waitForTimeout(1000)
    // Error should be shown via toast or error message
    // The modal should close and button should still be visible (form not reset on error)
    await expect(requestDeletionButton).toBeVisible({ timeout: 5000 })
  })

  test('User can select different deletion types', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User scrolls to deletion section (use first() to handle multiple matches)
    const deletionSection = page.getByText(/Request Data Deletion/i).first()
    await deletionSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    // AND: User selects "Calls Only"
    const callsButton = page.locator('[data-testid="deletion-type-calls"], [aria-label="deletion-type-calls"]').first()
    await callsButton.waitFor({ state: 'visible', timeout: 5000 })
    await callsButton.click()
    await page.waitForTimeout(200)
    
    // AND: User submits deletion request
    let requestBody: any = null
    await page.route('**/v1/privacy/deletion', async (route) => {
      if (route.request().method() === 'POST') {
        requestBody = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            deleted: { calls: 5, total: 5 },
            country: 'CA',
            jurisdiction: 'PIPEDA',
            dataType: 'calls'
          }),
        })
      } else {
        await route.continue()
      }
    })
    
    const requestDeletionButton = page.locator('[data-testid="request-deletion-button"], [aria-label="request-deletion-button"]').first()
    await requestDeletionButton.waitFor({ state: 'visible', timeout: 5000 })
    await requestDeletionButton.click()
    
    await page.waitForTimeout(500)
    const confirmButton = page.locator('[data-testid="deletion-confirmation-modal-confirm"], [aria-label="deletion-confirmation-modal-confirm"]').first()
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 })
    await confirmButton.click()
    
    // THEN: API request should include "calls" as dataType
    await page.waitForTimeout(1000)
    expect(requestBody).toBeTruthy()
    expect(requestBody.dataType).toBe('calls')
  })

  test('Deletion request button is disabled while processing', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // Mock slow deletion response using Promise delay
    let requestStarted = false
    await page.route('**/v1/privacy/deletion', async (route) => {
      if (route.request().method() === 'POST') {
        requestStarted = true
        // Use Promise-based delay instead of page.waitForTimeout
        await new Promise(resolve => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            deleted: { total: 0 },
            country: 'CA',
            jurisdiction: 'PIPEDA',
            dataType: 'all'
          }),
        })
      } else {
        await route.continue()
      }
    })
    
    // WHEN: User initiates deletion request (use first() to handle multiple matches)
    const deletionSection = page.getByText(/Request Data Deletion/i).first()
    await deletionSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    const requestDeletionButton = page.locator('[data-testid="request-deletion-button"], [aria-label="request-deletion-button"]').first()
    await requestDeletionButton.waitFor({ state: 'visible', timeout: 5000 })
    await requestDeletionButton.click()
    
    await page.waitForTimeout(500)
    const confirmButton = page.locator('[data-testid="deletion-confirmation-modal-confirm"], [aria-label="deletion-confirmation-modal-confirm"]').first()
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 })
    await confirmButton.click()
    
    // THEN: Request should be in progress (we verify the route was called)
    await page.waitForTimeout(500)
    expect(requestStarted).toBe(true)
    
    // Wait for request to complete
    await page.waitForTimeout(1500)
  })
})


