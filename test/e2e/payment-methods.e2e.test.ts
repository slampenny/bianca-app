import { test, expect } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'

test.describe('Payment Methods Screen', () => {
  test.beforeEach(async ({ page }) => {
    const authWorkflow = new AuthWorkflow(page)
    
    // Login as org admin to access payment methods
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    // Navigate to payment methods screen
    await page.getByTestId('tab-org').click()
    await page.getByText('Payment').click()
    await page.getByTestId('payment-methods-tab').click()
    await expect(page.getByTestId('payment-methods-container')).toBeVisible()
  })

  test('should display payment methods screen with all required elements', async ({ page }) => {
    // Check main container is visible
    await expect(page.getByLabel('stripe-web-payment-container')).toBeVisible()
    
    // Check title is displayed
    await expect(page.getByLabel('payment-methods-title')).toHaveText('Add Payment Method')
    
    // Check add payment form is visible
    await expect(page.getByLabel('add-payment-form')).toBeVisible()
    await expect(page.getByLabel('add-card-title')).toHaveText('Add New Card')
    await expect(page.getByLabel('card-element-container')).toBeVisible()
    await expect(page.getByTestId('add-payment-method-button')).toBeVisible()
  })

  test('should display existing payment methods when available', async ({ page }) => {
    // Wait for payment methods to load
    await page.waitForTimeout(2000)
    
    // Check if existing payment methods section is visible
    const existingMethods = page.getByLabel('existing-payment-methods')
    const isVisible = await existingMethods.isVisible().catch(() => false)
    
    if (isVisible) {
      // Should show existing methods title
      await expect(page.getByLabel('existing-methods-title')).toBeVisible()
      
      // Should show payment method cards
      const paymentCards = page.locator('[aria-label^="payment-method-card-"]')
      const cardCount = await paymentCards.count()
      expect(cardCount).toBeGreaterThan(0)
      
      // Each card should have required elements
      for (let i = 0; i < cardCount; i++) {
        const card = paymentCards.nth(i)
        await expect(card).toBeVisible()
        
        // Check for payment method text
        const paymentText = card.locator('[aria-label^="payment-method-text-"]')
        await expect(paymentText).toBeVisible()
        
        // Check for action buttons
        const removeButton = card.locator('[data-testid^="remove-button-"]')
        await expect(removeButton).toBeVisible()
        
        // Check for set default button (may or may not be present)
        const setDefaultButton = card.locator('[data-testid^="set-default-button-"]')
        const hasSetDefault = await setDefaultButton.count() > 0
        if (hasSetDefault) {
          await expect(setDefaultButton).toBeVisible()
        }
      }
    } else {
      // If no existing methods, should show loading or empty state
      const loading = page.getByLabel('payment-methods-loading')
      const error = page.getByLabel('payment-methods-error')
      
      const isLoading = await loading.isVisible().catch(() => false)
      const hasError = await error.isVisible().catch(() => false)
      
      expect(isLoading || hasError).toBe(true)
    }
  })

  test('should show loading state while fetching payment methods', async ({ page }) => {
    // Mock slow API response
    await page.route('**/v1/payment-methods/orgs/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      route.continue()
    })
    
    // Reload to trigger loading state
    await page.reload()
    await page.getByTestId('tab-org').click()
    await page.getByText('Payment').click()
    await page.getByTestId('payment-methods-tab').click()
    
    // Should show loading indicator
    await expect(page.getByLabel('payment-methods-loading')).toBeVisible()
  })

  test('should show error state when payment methods fail to load', async ({ page }) => {
    // Mock API error
    await page.route('**/v1/payment-methods/orgs/*', async (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' })
      })
    })
    
    // Reload to trigger error state
    await page.reload()
    await page.getByTestId('tab-org').click()
    await page.getByText('Payment').click()
    await page.getByTestId('payment-methods-tab').click()
    
    // Should show error message
    await expect(page.getByLabel('payment-methods-error')).toBeVisible()
  })

  test('should allow setting default payment method', async ({ page }) => {
    // Wait for payment methods to load
    await page.waitForTimeout(2000)
    
    // Listen for network requests to debug API calls
    page.on('request', request => {
      if (request.url().includes('payment-methods')) {
        console.log('API Request:', request.method(), request.url())
      }
    })
    
    page.on('response', response => {
      if (response.url().includes('payment-methods')) {
        console.log('API Response:', response.status(), response.url())
      }
    })
    
    // Look for a payment method with set default button
    const setDefaultButton = page.locator('[data-testid^="set-default-button-"]').first()
    const hasSetDefaultButton = await setDefaultButton.count() > 0
    
    if (hasSetDefaultButton) {
      console.log('Found set default button, clicking...')
      // Click set default button
      await setDefaultButton.click()
      
      // Wait a bit for the API call to complete
      await page.waitForTimeout(2000)
      
      // Check if toast appeared
      const toastVisible = await page.getByTestId('payment-toast').count() > 0
      console.log('Toast visible:', toastVisible)
      
      // Check if button is still visible
      const buttonStillVisible = await setDefaultButton.count() > 0
      console.log('Button still visible:', buttonStillVisible)
      
      // Check what payment methods are currently displayed
      const paymentMethodCards = await page.locator('[data-testid^="payment-method-card-"]').count()
      console.log('Payment method cards count:', paymentMethodCards)
      
      // Check if any payment method has a default badge
      const defaultBadges = await page.locator('[aria-label^="default-badge-"]').count()
      console.log('Default badges count:', defaultBadges)
      
      // Should show success toast
      await expect(page.getByTestId('payment-toast')).toBeVisible()
      
      // The button should disappear (since it's now default)
      await expect(setDefaultButton).not.toBeVisible()
      
      // Should show default badge
      const defaultBadge = page.locator('[aria-label^="default-badge-"]')
      await expect(defaultBadge).toBeVisible()
    } else {
      // Skip test if no non-default payment methods available
      console.log('No non-default payment methods available for testing')
    }
  })

  test('should allow removing payment method with confirmation', async ({ page }) => {
    // Wait for payment methods to load
    await page.waitForTimeout(2000)
    
    // Look for a payment method with remove button
    const removeButton = page.locator('[data-testid^="remove-button-"]').first()
    const hasRemoveButton = await removeButton.count() > 0
    
    if (hasRemoveButton) {
      // Click remove button
      await removeButton.click()
      
      // Should show confirmation dialog
      await expect(page.getByText('Delete Payment Method')).toBeVisible()
      await expect(page.getByText('Are you sure you want to delete this payment method?')).toBeVisible()
      
      // Click confirm delete
      await page.getByText('Delete').click()
      
      // Should show success toast
      await expect(page.getByTestId('payment-toast')).toBeVisible()
    } else {
      // Skip test if no payment methods available for removal
      console.log('No payment methods available for testing removal')
    }
  })

  test('should cancel payment method removal when cancel is clicked', async ({ page }) => {
    // Wait for payment methods to load
    await page.waitForTimeout(2000)
    
    // Look for a payment method with remove button
    const removeButton = page.locator('[data-testid^="remove-button-"]').first()
    const hasRemoveButton = await removeButton.count() > 0
    
    if (hasRemoveButton) {
      // Click remove button
      await removeButton.click()
      
      // Should show confirmation dialog
      await expect(page.getByText('Delete Payment Method')).toBeVisible()
      
      // Click cancel
      await page.getByText('Cancel').click()
      
      // Dialog should disappear and payment method should still be there
      await expect(page.getByText('Delete Payment Method')).not.toBeVisible()
      await expect(removeButton).toBeVisible()
    } else {
      // Skip test if no payment methods available
      console.log('No payment methods available for testing removal cancellation')
    }
  })

  test('should display payment method details correctly', async ({ page }) => {
    // Wait for payment methods to load
    await page.waitForTimeout(2000)
    
    // Look for payment method cards
    const paymentCards = page.locator('[aria-label^="payment-method-card-"]')
    const cardCount = await paymentCards.count()
    
    if (cardCount > 0) {
      const firstCard = paymentCards.first()
      
      // Check payment method text is displayed
      const paymentText = firstCard.locator('[aria-label^="payment-method-text-"]')
      await expect(paymentText).toBeVisible()
      
      // Check subtext (expiration date) is displayed
      const paymentSubtext = firstCard.locator('[aria-label^="payment-method-subtext-"]')
      const hasSubtext = await paymentSubtext.count() > 0
      if (hasSubtext) {
        await expect(paymentSubtext).toBeVisible()
      }
      
      // Check action buttons are present
      const removeButton = firstCard.locator('[data-testid^="remove-button-"]')
      await expect(removeButton).toBeVisible()
      
      // Check if default badge is present
      const defaultBadge = firstCard.locator('[aria-label^="default-badge-"]')
      const hasDefaultBadge = await defaultBadge.count() > 0
      if (hasDefaultBadge) {
        await expect(defaultBadge).toBeVisible()
        await expect(defaultBadge).toHaveText('Default')
      }
    } else {
      // Skip test if no payment methods available
      console.log('No payment methods available for testing display')
    }
  })

  test('should restrict access for unauthorized users', async ({ page }) => {
    // Logout and login as regular user (not org admin)
    await page.goto('/')
    await page.waitForTimeout(1000)
    
    const authWorkflow = new AuthWorkflow(page)
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    // Try to navigate to payment methods
    await page.getByTestId('tab-org').click()
    await page.getByText('Payment').click()
    
    // Should show access restricted message
    await expect(page.getByTestId('access-restricted-title')).toBeVisible()
    await expect(page.getByTestId('access-restricted-message')).toBeVisible()
  })

  test('should handle Stripe configuration loading', async ({ page }) => {
    // Mock Stripe config API
    await page.route('**/v1/stripe/publishable-key', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          publishableKey: 'pk_test_1234567890',
          mode: 'test'
        })
      })
    })
    
    // Reload to trigger Stripe config loading
    await page.reload()
    await page.getByTestId('tab-org').click()
    await page.getByText('Payment').click()
    await page.getByTestId('payment-methods-tab').click()
    
    // Should show payment methods screen (not loading state)
    await expect(page.getByLabel('stripe-web-payment-container')).toBeVisible()
  })

  test('should handle Stripe configuration error', async ({ page }) => {
    // Mock Stripe config API error
    await page.route('**/v1/stripe/publishable-key', async (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Stripe configuration error' })
      })
    })
    
    // Reload to trigger Stripe config error
    await page.reload()
    await page.getByTestId('tab-org').click()
    await page.getByText('Payment').click()
    await page.getByTestId('payment-methods-tab').click()
    
    // Should show error message
    await expect(page.getByText('Stripe configuration error. Please contact support.')).toBeVisible()
  })
})
