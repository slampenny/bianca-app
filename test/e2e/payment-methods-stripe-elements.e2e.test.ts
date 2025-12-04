import { test, expect } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'
import { navigateToPaymentMethods } from './helpers/navigation'

/**
 * Tests that verify the payment screen loads without crashing
 * We don't interact with Stripe components (they're in iframes and we don't own Stripe)
 * We only verify the screen navigates and loads correctly
 */
test.describe('Payment Methods - Screen Loading', () => {
  test.beforeEach(async ({ page }) => {
    const authWorkflow = new AuthWorkflow(page)
    
    // Login as org admin to access payment methods
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
  })

  test('should navigate to payment screen and load without crashing', async ({ page }) => {
    // Navigate to payment screen using helper
    await navigateToPaymentMethods(page)
    
    // Verify we're on the payment screen - check for either container
    const hasPaymentContainer = await page.locator('[data-testid="payment-info-container"]').isVisible().catch(() => false)
    const hasMethodsContainer = await page.locator('[data-testid="payment-methods-container"]').isVisible().catch(() => false)
    
    expect(hasPaymentContainer || hasMethodsContainer).toBe(true)
    
    // If payment-info-container is visible, check for tabs navigator
    if (hasPaymentContainer) {
      const tabsNavigator = page.locator('[data-testid="payment-tabs-navigator"]')
      const hasTabs = await tabsNavigator.isVisible().catch(() => false)
      
      if (hasTabs) {
        // Verify payment methods tab exists and is clickable
        const paymentMethodsTab = page.locator('[data-testid="payment-methods-tab"]')
        const tabVisible = await paymentMethodsTab.isVisible().catch(() => false)
        
        if (tabVisible) {
          // Click the payment methods tab to ensure it works
          await paymentMethodsTab.click()
          await page.waitForTimeout(1000) // Wait for tab to activate
        }
      }
    }
    
    // Verify the screen loaded without errors
    // Check for any error messages that would indicate a crash
    const errorMessages = page.locator('text=/error|crash|failed|exception/i')
    const errorCount = await errorMessages.count()
    
    // Should not have any error messages
    expect(errorCount).toBe(0)
    
    console.log('✅ Payment screen loaded successfully without crashing')
  })

  test('should navigate to payment screen tabs without crashing', async ({ page }) => {
    // Navigate to payment screen
    await navigateToPaymentMethods(page)
    
    // Check if tabs navigator exists (may not be visible if user doesn't have access)
    const tabsNavigator = page.locator('[data-testid="payment-tabs-navigator"]')
    const hasTabs = await tabsNavigator.isVisible().catch(() => false)
    
    if (!hasTabs) {
      // If no tabs, just verify the screen loaded without errors
      const errorMessages = page.locator('text=/error|crash|failed|exception/i')
      const errorCount = await errorMessages.count()
      expect(errorCount).toBe(0)
      console.log('✅ Payment screen loaded (no tabs visible, may be access restricted)')
      return
    }
    
    // Try clicking each tab to ensure navigation works
    const tabs = [
      { testId: 'current-charges-tab', name: 'Current Charges' },
      { testId: 'payment-methods-tab', name: 'Payment Methods' },
      { testId: 'billing-info-tab', name: 'Billing Info' }
    ]
    
    for (const tab of tabs) {
      const tabElement = page.locator(`[data-testid="${tab.testId}"]`)
      const isVisible = await tabElement.isVisible().catch(() => false)
      
      if (isVisible) {
        await tabElement.click()
        await page.waitForTimeout(500) // Wait for tab content to load
        
        // Verify no errors appeared
        const errorMessages = page.locator('text=/error|crash|failed|exception/i')
        const errorCount = await errorMessages.count()
        expect(errorCount).toBe(0)
        
        console.log(`✅ ${tab.name} tab loaded without crashing`)
      }
    }
  })
})

