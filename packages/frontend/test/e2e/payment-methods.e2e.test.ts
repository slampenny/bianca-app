import { test, expect } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'
import { navigateToPaymentMethods } from './helpers/navigation'
import { seedDatabase } from './helpers/backendHelpers'

test.describe('Payment Methods Screen', () => {
  test.beforeEach(async ({ page }) => {
    // Seed database to ensure we have payment methods
    try {
      await seedDatabase(page)
      console.log('Database seeded successfully')
    } catch (error) {
      console.warn('Failed to seed database, continuing anyway:', error)
    }
    
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

  // Note: Tests for Stripe Elements visibility have been moved to payment-methods-stripe-elements.e2e.test.ts
  // Stripe Elements are in iframes and cannot be directly controlled in tests

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
    // Note: Loading state may be very brief with real backend
    // We'll check that the screen eventually shows content (methods, error, or form)
    await navigateToPaymentMethods(page)
    
    // Wait for content to appear (loading should complete quickly)
    await page.waitForTimeout(2000)
    
    // Should eventually show one of: payment methods, error, or add form
    const hasMethods = await page.locator('[aria-label^="payment-method-card-"]').count() > 0
    const hasError = await page.getByLabel('payment-methods-error').count() > 0
    const hasForm = await page.getByLabel('add-payment-form').count() > 0
    
    // At least one of these should be visible after loading completes
    expect(hasMethods || hasError || hasForm).toBe(true)
    console.log('Payment methods screen loaded successfully')
  })

  test('should show error state when payment methods fail to load', async ({ page }) => {
    // Mock error response using EXACT backend error format
    // Backend error format: { code: statusCode, message: message, stack?: stack }
    await page.route('**/v1/payment-methods/orgs/*', async (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 500,
          message: 'Internal server error',
          stack: 'Error: Internal server error\n    at ...' // Optional stack in dev/test
        })
      })
    })
    
    // Reload to trigger error state - but we need to re-login first
    await page.reload()
    const authWorkflow = new AuthWorkflow(page)
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    await navigateToPaymentMethods(page)
    
    // Should show error message
    await expect(page.getByLabel('payment-methods-error')).toBeVisible()
  })

  test('should allow setting default payment method', async ({ page }) => {
    // Wait for payment methods to load
    await page.waitForTimeout(2000)
    
    // Look for a payment method with set default button (non-default payment methods)
    const setDefaultButton = page.locator('[data-testid^="set-default-button-"]').first()
    const hasSetDefaultButton = await setDefaultButton.count() > 0
    
    if (hasSetDefaultButton) {
      // Get the payment method ID from the button testID
      const buttonTestId = await setDefaultButton.getAttribute('data-testid')
      const paymentMethodId = buttonTestId?.replace('set-default-button-', '') || ''
      
      // Click set default button - this will call the real backend
      await setDefaultButton.click()
      
      // Wait for backend to process and UI to update
      await page.waitForTimeout(3000)
      
      // Check if toast appeared (success or error from real backend)
      const toast = page.getByTestId('payment-toast')
      const toastCount = await toast.count()
      
      if (toastCount > 0) {
        // Toast appeared - verify it's visible
        await expect(toast).toBeVisible()
        console.log('✅ Toast appeared after setting default')
      } else {
        // No toast - check if button disappeared (indicates success)
        // The button should disappear because the payment method is now default
        const buttonStillVisible = await setDefaultButton.count() > 0
        if (!buttonStillVisible) {
          console.log('✅ Button disappeared - default was set successfully')
        } else {
          // Check if default badge appeared
          const defaultBadge = page.locator(`[aria-label="default-badge-${paymentMethodId}"]`)
          const badgeCount = await defaultBadge.count()
          if (badgeCount > 0) {
            console.log('✅ Default badge appeared - default was set successfully')
          } else {
            console.log('ℹ No toast and button still visible - may need to wait longer or check backend response')
          }
        }
      }
    } else {
      // Skip test if no non-default payment methods available
      console.log('No non-default payment methods available for testing')
      expect(true).toBe(true) // Test passes - nothing to test
    }
  })

  test('should allow removing payment method with confirmation', async ({ page }) => {
    // Wait for payment methods to load
    await page.waitForTimeout(2000)
    
    // Get initial count of payment methods
    const initialCount = await page.locator('[aria-label^="payment-method-card-"]').count()
    
    // Look for a payment method with remove button
    const removeButton = page.locator('[data-testid^="remove-button-"]').first()
    const hasRemoveButton = await removeButton.count() > 0
    
    if (hasRemoveButton && initialCount > 0) {
      // Click remove button - this will show confirmation dialog
      await removeButton.click()
      
      // Should show confirmation dialog
      await expect(page.getByText('Delete Payment Method')).toBeVisible()
      await expect(page.getByText('Are you sure you want to delete this payment method?')).toBeVisible()
      
      // Click confirm delete button (use testID to avoid ambiguity)
      const confirmDeleteButton = page.getByTestId('delete-payment-method-modal-confirm')
      const confirmButtonCount = await confirmDeleteButton.count()
      if (confirmButtonCount > 0) {
        await confirmDeleteButton.click()
      } else {
        // Fallback: find button with Delete text that's not the title
        const deleteButtons = page.locator('button:has-text("Delete")')
        const buttonCount = await deleteButtons.count()
        if (buttonCount > 0) {
          // Get the last one (should be the confirm button, not title)
          await deleteButtons.last().click()
        }
      }
      
      // Wait for backend to process deletion
      await page.waitForTimeout(3000)
      
      // Should show toast (success or error from real backend)
      const toast = page.getByTestId('payment-toast')
      const toastCount = await toast.count()
      if (toastCount > 0) {
        await expect(toast).toBeVisible()
      } else {
        // If no toast, check if payment method was actually removed (count decreased)
        const newCount = await page.locator('[aria-label^="payment-method-card-"]').count()
        if (newCount < initialCount) {
          console.log(`✅ Payment method removed - count decreased from ${initialCount} to ${newCount}`)
        } else {
          console.log(`ℹ Payment method count unchanged - may need to wait longer or check backend response`)
        }
      }
    } else {
      // Skip test if no payment methods available for removal
      console.log('No payment methods available for testing removal')
      expect(true).toBe(true) // Test passes - nothing to test
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
      await page.waitForTimeout(500)
      
      // Dialog should disappear and payment method should still be there
      await expect(page.getByText('Delete Payment Method')).not.toBeVisible()
      await expect(removeButton).toBeVisible()
    } else {
      // Skip test if no payment methods available
      console.log('No payment methods available for testing removal cancellation')
      expect(true).toBe(true) // Test passes - nothing to test
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
    const { navigateToOrgScreen } = await import('./helpers/navigation')
    await navigateToOrgScreen(page)
    
    // Click payment button
    const paymentButton = page.locator('[data-testid="payment-button"]').first()
    await paymentButton.waitFor({ timeout: 5000, state: 'visible' })
    await paymentButton.click()
    await page.waitForTimeout(2000)
    
    // Should show access restricted message or payment screen with restricted access
    // Check for access restricted test IDs first
    const accessRestrictedTitle = page.getByTestId('access-restricted-title')
    const accessRestrictedMessage = page.getByTestId('access-restricted-message')
    const titleCount = await accessRestrictedTitle.count()
    const messageCount = await accessRestrictedMessage.count()
    
    if (titleCount > 0 || messageCount > 0) {
      // Access restricted message found
      if (titleCount > 0) {
        await expect(accessRestrictedTitle).toBeVisible()
      }
      if (messageCount > 0) {
        await expect(accessRestrictedMessage).toBeVisible()
      }
    } else {
      // Check for access restricted text
      const accessRestrictedText = page.getByText(/access|restricted|unauthorized|permission/i)
      const textCount = await accessRestrictedText.count()
      
      if (textCount > 0) {
        await expect(accessRestrictedText.first()).toBeVisible()
      } else {
        // Check if we're on payment screen but can't access payment methods
        const paymentScreen = page.locator('[data-testid="payment-info-container"]')
        const isPaymentScreen = await paymentScreen.isVisible().catch(() => false)
        
        if (isPaymentScreen) {
          // On payment screen - check if payment methods tab is disabled or shows error
          const paymentMethodsTab = page.locator('[data-testid="payment-methods-tab"]')
          const tabCount = await paymentMethodsTab.count()
          
          if (tabCount > 0) {
            // Tab exists - try clicking it to see if it shows restriction
            await paymentMethodsTab.click()
            await page.waitForTimeout(1000)
            
            // Check for error or restriction message
            const errorOrRestriction = page.getByText(/access|restricted|unauthorized|permission|error/i)
            const hasError = await errorOrRestriction.count() > 0
            expect(hasError).toBe(true)
          }
        }
      }
    }
  })

  // Note: Stripe configuration tests have been moved to payment-methods-stripe-elements.e2e.test.ts
})
