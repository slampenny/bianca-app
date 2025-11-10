import { test, expect } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'
import { navigateToPaymentMethods } from './helpers/navigation'

/**
 * Tests that check for Stripe Elements visibility and containers
 * These tests verify that Stripe Elements are rendered but do not interact with them
 * (Stripe Elements are in iframes and cannot be directly controlled in tests)
 */
test.describe('Payment Methods - Stripe Elements', () => {
  test.beforeEach(async ({ page }) => {
    const authWorkflow = new AuthWorkflow(page)
    
    // Login as org admin to access payment methods
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    // Navigate to payment methods screen using helper
    await navigateToPaymentMethods(page)
  })

  test('should display Stripe Elements container', async ({ page }) => {
    // Check main container is visible
    await expect(page.getByLabel('stripe-web-payment-container')).toBeVisible()
    
    // Check add payment form is visible
    await expect(page.getByLabel('add-payment-form')).toBeVisible()
    await expect(page.getByLabel('add-card-title')).toHaveText('Add New Card')
    
    // Check Stripe card element container is visible
    // Note: The actual Stripe card input is in an iframe and cannot be directly tested
    await expect(page.getByLabel('card-element-container')).toBeVisible()
    
    // Check add payment method button is visible
    // Note: This button is outside the Stripe iframe, so it should be clickable
    await expect(page.getByTestId('add-payment-method-button')).toBeVisible()
  })

  test('should handle Stripe configuration loading', async ({ page }) => {
    // Use real backend - Stripe config comes from our backend endpoint
    // Reload to trigger Stripe config loading
    await page.reload()
    const authWorkflow = new AuthWorkflow(page)
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    await navigateToPaymentMethods(page)
    
    // Should show payment methods screen with Stripe Elements (if Stripe is configured)
    // If Stripe is not configured, we might see an error message instead
    const stripeContainer = page.getByLabel('stripe-web-payment-container')
    const stripeError = page.getByText(/stripe.*configuration.*error/i)
    
    const hasContainer = await stripeContainer.count() > 0
    const hasError = await stripeError.count() > 0
    
    // Either the container should be visible OR an error should be shown
    if (hasContainer) {
      await expect(stripeContainer).toBeVisible()
      // If container is visible, card element container should also be visible
      const cardElement = page.getByLabel('card-element-container')
      const cardElementCount = await cardElement.count()
      if (cardElementCount > 0) {
        await expect(cardElement).toBeVisible()
      }
    } else if (hasError) {
      // Stripe not configured - that's okay for testing
      await expect(stripeError).toBeVisible()
      console.log('Stripe not configured - error message shown (expected in test environment)')
    } else {
      // Neither container nor error - check if form is visible
      const addForm = page.getByLabel('add-payment-form')
      const formCount = await addForm.count()
      expect(formCount).toBeGreaterThan(0)
    }
  })

  test('should handle Stripe configuration error', async ({ page }) => {
    // Mock Stripe config API error using EXACT backend error format
    // Backend error format: { code: statusCode, message: message, stack?: stack }
    await page.route('**/v1/stripe/publishable-key', async (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 500,
          message: 'Stripe configuration error',
          stack: 'Error: Stripe configuration error\n    at ...'
        })
      })
    })
    
    // Reload to trigger Stripe config error
    await page.reload()
    const authWorkflow = new AuthWorkflow(page)
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    await navigateToPaymentMethods(page)
    
    // Should show error message
    await expect(page.getByText('Stripe configuration error. Please contact support.')).toBeVisible()
  })
})

