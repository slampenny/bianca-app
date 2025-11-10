import { Page, expect } from '@playwright/test'

export class PaymentHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to payment methods screen
   */
  async navigateToPaymentMethods(): Promise<void> {
    // Import navigation helper using require for compatibility
    const navigation = require('./navigation')
    await navigation.navigateToPaymentMethods(this.page)
  }

  /**
   * Wait for payment methods to load
   */
  async waitForPaymentMethodsToLoad(): Promise<void> {
    // Wait for either existing methods or loading/error state
    await this.page.waitForSelector(
      '[aria-label="existing-payment-methods"], [aria-label="payment-methods-loading"], [aria-label="payment-methods-error"]',
      { timeout: 10000 }
    )
  }

  /**
   * Get count of existing payment methods
   */
  async getPaymentMethodCount(): Promise<number> {
    const cards = this.page.locator('[aria-label^="payment-method-card-"]')
    return await cards.count()
  }

  /**
   * Get payment method by index
   */
  async getPaymentMethodByIndex(index: number) {
    const cards = this.page.locator('[aria-label^="payment-method-card-"]')
    return cards.nth(index)
  }

  /**
   * Get payment method by ID
   */
  async getPaymentMethodById(id: string) {
    return this.page.getByLabel(`payment-method-card-${id}`)
  }

  /**
   * Check if payment method is default
   */
  async isPaymentMethodDefault(paymentMethodId: string): Promise<boolean> {
    const defaultBadge = this.page.getByLabel(`default-badge-${paymentMethodId}`)
    return await defaultBadge.count() > 0
  }

  /**
   * Set payment method as default
   */
  async setPaymentMethodAsDefault(paymentMethodId: string): Promise<void> {
    const setDefaultButton = this.page.getByTestId(`set-default-button-${paymentMethodId}`)
    await expect(setDefaultButton).toBeVisible()
    await setDefaultButton.click()
    
    // Wait for success toast
    await expect(this.page.getByTestId('payment-toast')).toBeVisible()
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    const removeButton = this.page.getByTestId(`remove-button-${paymentMethodId}`)
    await expect(removeButton).toBeVisible()
    await removeButton.click()
    
    // Confirm deletion
    await expect(this.page.getByText('Delete Payment Method')).toBeVisible()
    await this.page.getByText('Delete').click()
    
    // Wait for success toast
    await expect(this.page.getByTestId('payment-toast')).toBeVisible()
  }

  /**
   * Cancel payment method removal
   */
  async cancelPaymentMethodRemoval(paymentMethodId: string): Promise<void> {
    const removeButton = this.page.getByTestId(`remove-button-${paymentMethodId}`)
    await expect(removeButton).toBeVisible()
    await removeButton.click()
    
    // Cancel deletion
    await expect(this.page.getByText('Delete Payment Method')).toBeVisible()
    await this.page.getByText('Cancel').click()
    
    // Dialog should disappear
    await expect(this.page.getByText('Delete Payment Method')).not.toBeVisible()
  }

  /**
   * Get payment method text content
   */
  async getPaymentMethodText(paymentMethodId: string): Promise<string> {
    const textElement = this.page.getByLabel(`payment-method-text-${paymentMethodId}`)
    return await textElement.textContent() || ''
  }

  /**
   * Get payment method subtext content
   */
  async getPaymentMethodSubtext(paymentMethodId: string): Promise<string> {
    const subtextElement = this.page.getByLabel(`payment-method-subtext-${paymentMethodId}`)
    const count = await subtextElement.count()
    if (count > 0) {
      return await subtextElement.textContent() || ''
    }
    return ''
  }

  /**
   * Check if add payment form is visible
   */
  async isAddPaymentFormVisible(): Promise<boolean> {
    return await this.page.getByLabel('add-payment-form').isVisible()
  }

  /**
   * Check if payment methods are loading
   */
  async isLoading(): Promise<boolean> {
    return await this.page.getByLabel('payment-methods-loading').isVisible().catch(() => false)
  }

  /**
   * Check if there's a payment methods error
   */
  async hasError(): Promise<boolean> {
    return await this.page.getByLabel('payment-methods-error').isVisible().catch(() => false)
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    const errorElement = this.page.getByLabel('payment-methods-error')
    return await errorElement.textContent() || ''
  }

  /**
   * Get success/error message from payment actions
   */
  async getPaymentMessage(): Promise<string> {
    const messageElement = this.page.getByLabel('payment-message')
    const count = await messageElement.count()
    if (count > 0) {
      return await messageElement.textContent() || ''
    }
    return ''
  }

  /**
   * @deprecated Do not mock services we own. Use real backend with seeded data instead.
   * Use seedDatabase() from backendHelpers.ts to seed test data.
   * These methods are kept for backwards compatibility but should not be used in new tests.
   */
  async mockPaymentMethodsResponse(paymentMethods: any[]): Promise<void> {
    console.warn('⚠️ mockPaymentMethodsResponse is deprecated. Use real backend with seeded data instead.')
    await this.page.route('**/v1/payment-methods/orgs/*', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paymentMethods)
      })
    })
  }

  /**
   * @deprecated Do not mock services we own. Use real backend with seeded data instead.
   */
  async mockPaymentMethodsError(status: number = 500, message: string = 'Internal server error'): Promise<void> {
    console.warn('⚠️ mockPaymentMethodsError is deprecated. Use real backend with seeded data instead.')
    await this.page.route('**/v1/payment-methods/orgs/*', async (route) => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ message })
      })
    })
  }

  /**
   * @deprecated Do not mock services we own. Use real backend with seeded data instead.
   */
  async mockStripeConfig(publishableKey: string = 'pk_test_1234567890', mode: string = 'test'): Promise<void> {
    console.warn('⚠️ mockStripeConfig is deprecated. Use real backend with seeded data instead.')
    await this.page.route('**/v1/stripe/publishable-key', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ publishableKey, mode })
      })
    })
  }

  /**
   * @deprecated Do not mock services we own. Use real backend with seeded data instead.
   */
  async mockStripeConfigError(status: number = 500, message: string = 'Stripe configuration error'): Promise<void> {
    console.warn('⚠️ mockStripeConfigError is deprecated. Use real backend with seeded data instead.')
    await this.page.route('**/v1/stripe/publishable-key', async (route) => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ message })
      })
    })
  }

  /**
   * @deprecated Do not mock services we own. Use real backend with seeded data instead.
   */
  async mockSetDefaultPaymentMethod(success: boolean = true): Promise<void> {
    console.warn('⚠️ mockSetDefaultPaymentMethod is deprecated. Use real backend with seeded data instead.')
    await this.page.route('**/v1/payment-methods/orgs/*/set-default', async (route) => {
      if (success) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      } else {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Failed to set default payment method' })
        })
      }
    })
  }

  /**
   * @deprecated Do not mock services we own. Use real backend with seeded data instead.
   */
  async mockRemovePaymentMethod(success: boolean = true): Promise<void> {
    console.warn('⚠️ mockRemovePaymentMethod is deprecated. Use real backend with seeded data instead.')
    await this.page.route('**/v1/payment-methods/orgs/*/detach', async (route) => {
      if (success) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      } else {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Failed to remove payment method' })
        })
      }
    })
  }
}
