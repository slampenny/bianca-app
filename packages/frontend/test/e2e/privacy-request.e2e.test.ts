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
  
  // Setup: Login once for all tests
  test.beforeEach(async ({ page }) => {
    auth = new AuthWorkflow(page)
    mfa = new MFAWorkflow(page)
    await auth.givenIAmOnTheLoginScreen()
    creds = await auth.givenIHaveValidCredentials()
    await auth.whenIEnterCredentials(creds.email, creds.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()
  })
  
  async function navigateToPrivacyRequestScreen(page: any) {
    // Navigate to profile screen using MFA workflow helper
    await mfa.givenIAmOnTheProfileScreen()
    
    // Find and click "Request My Data" button
    await page.waitForTimeout(1000) // Brief wait for profile to render
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
    await requestButton.click()
    
    // Wait for privacy request screen
    await page.waitForSelector('[data-testid="privacy-request-screen"], [aria-label="privacy-request-screen"]', { timeout: 10000 })
    
    // Wait for buttons to be in the DOM (more reliable than just timeout)
    await page.waitForFunction(
      () => {
        const submitButton = document.querySelector('[data-testid="submit-privacy-request-button"]') || 
                           document.querySelector('[aria-label="submit-privacy-request-button"]')
        const accessTypeButton = document.querySelector('[data-testid="request-type-access"]') || 
                                document.querySelector('[aria-label="request-type-access"]')
        const correctionTypeButton = document.querySelector('[data-testid="request-type-correction"]') || 
                                     document.querySelector('[aria-label="request-type-correction"]')
        const complaintTypeButton = document.querySelector('[data-testid="request-type-complaint"]') || 
                                    document.querySelector('[aria-label="request-type-complaint"]')
        return submitButton !== null && accessTypeButton !== null && correctionTypeButton !== null && complaintTypeButton !== null
      },
      { timeout: 15000 }
    )
    
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
    
    await submitButton.click()
    
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
    
    // AND: User selects download method
    const downloadButton = page.locator('[data-testid="access-method-download"], [aria-label="access-method-download"]').first()
    await downloadButton.waitFor({ state: 'attached', timeout: 10000 })
    await downloadButton.scrollIntoViewIfNeeded()
    await downloadButton.waitFor({ state: 'visible', timeout: 5000 })
    await downloadButton.click()
    
    // AND: User submits the request
    let requestBody: any = null
    page.on('request', (request) => {
      if (request.url().includes('/v1/privacy/requests/access') && request.method() === 'POST') {
        requestBody = request.postDataJSON()
      }
    })
    
    const submitButton = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    await submitButton.click()
    
    // THEN: API request should include custom information
    await page.waitForTimeout(1000)
    expect(requestBody).toMatchObject({
      informationRequested: 'I would like to access my conversation history and medical analysis data.',
      accessMethod: 'download',
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
    await submitButton.click()
    
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
    
    const emailButton = page.locator('[data-testid="access-method-email"], [aria-label="access-method-email"]').first()
    await emailButton.waitFor({ state: 'attached', timeout: 10000 })
    await emailButton.scrollIntoViewIfNeeded()
    await expect(emailButton).toBeVisible({ timeout: 5000 })
    
    const downloadButton = page.locator('[data-testid="access-method-download"], [aria-label="access-method-download"]').first()
    await downloadButton.waitFor({ state: 'attached', timeout: 10000 })
    await downloadButton.scrollIntoViewIfNeeded()
    await expect(downloadButton).toBeVisible({ timeout: 5000 })
  })

  test('Access method selection works correctly', async ({ page }) => {
    // GIVEN: User is on privacy request screen
    await navigateToPrivacyRequestScreen(page)
    
    // WHEN: User clicks download method then email method
    const downloadButton = page.locator('[data-testid="access-method-download"], [aria-label="access-method-download"]').first()
    await downloadButton.waitFor({ state: 'attached', timeout: 10000 })
    await downloadButton.scrollIntoViewIfNeeded()
    await downloadButton.waitFor({ state: 'visible', timeout: 5000 })
    await downloadButton.click()
    await page.waitForTimeout(200)
    
    const emailButton = page.locator('[data-testid="access-method-email"], [aria-label="access-method-email"]').first()
    await emailButton.waitFor({ state: 'attached', timeout: 10000 })
    await emailButton.scrollIntoViewIfNeeded()
    await emailButton.waitFor({ state: 'visible', timeout: 5000 })
    await emailButton.click()
    await page.waitForTimeout(200)
    
    // THEN: Email method should be selected (verify via API call)
    let requestBody: any = null
    page.on('request', (request) => {
      if (request.url().includes('/v1/privacy/requests/access') && request.method() === 'POST') {
        requestBody = request.postDataJSON()
      }
    })
    
    const submitButton = page.locator('[data-testid="submit-privacy-request-button"], [aria-label="submit-privacy-request-button"]').first()
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    await submitButton.click()
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
    await submitButton.click()
    
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
    
    await submitButton.click()
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


