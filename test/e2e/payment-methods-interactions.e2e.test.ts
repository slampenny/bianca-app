import { test, expect } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'
import { PaymentHelpers } from './helpers/paymentHelpers'

test.describe('Payment Methods Interactions', () => {
  let authWorkflow: AuthWorkflow
  let paymentHelpers: PaymentHelpers

  test.beforeEach(async ({ page }) => {
    authWorkflow = new AuthWorkflow(page)
    paymentHelpers = new PaymentHelpers(page)
    
    // Login as org admin
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    // Navigate to payment methods
    await paymentHelpers.navigateToPaymentMethods()
  })

  test('should handle payment method actions with mocked APIs', async ({ page }) => {
    // Mock payment methods data
    const mockPaymentMethods = [
      {
        id: 'pm_1',
        stripePaymentMethodId: 'pm_test_1',
        org: 'org_1',
        isDefault: false,
        type: 'card',
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2025,
        billingDetails: {
          name: 'Test User',
          email: 'test@example.com'
        },
        metadata: {}
      },
      {
        id: 'pm_2',
        stripePaymentMethodId: 'pm_test_2',
        org: 'org_1',
        isDefault: true,
        type: 'card',
        brand: 'mastercard',
        last4: '5555',
        expMonth: 6,
        expYear: 2026,
        billingDetails: {
          name: 'Test User',
          email: 'test@example.com'
        },
        metadata: {}
      }
    ]

    await paymentHelpers.mockPaymentMethodsResponse(mockPaymentMethods)
    await paymentHelpers.mockStripeConfig()
    await paymentHelpers.mockSetDefaultPaymentMethod()
    await paymentHelpers.mockRemovePaymentMethod()

    // Reload to get mocked data
    await page.reload()
    await paymentHelpers.navigateToPaymentMethods()
    await paymentHelpers.waitForPaymentMethodsToLoad()

    // Verify payment methods are displayed
    const count = await paymentHelpers.getPaymentMethodCount()
    expect(count).toBe(2)

    // Test setting default payment method
    const firstPaymentMethod = await paymentHelpers.getPaymentMethodById('pm_1')
    await expect(firstPaymentMethod).toBeVisible()

    // Check that first payment method is not default
    const isDefault = await paymentHelpers.isPaymentMethodDefault('pm_1')
    expect(isDefault).toBe(false)

    // Set as default
    await paymentHelpers.setPaymentMethodAsDefault('pm_1')

    // Verify success message
    const message = await paymentHelpers.getPaymentMessage()
    expect(message).toContain('Default payment method updated')

    // Test removing payment method
    await paymentHelpers.removePaymentMethod('pm_1')

    // Verify success message
    const removeMessage = await paymentHelpers.getPaymentMessage()
    expect(removeMessage).toContain('Payment method deleted')
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API errors
    await paymentHelpers.mockPaymentMethodsError(500, 'Internal server error')
    await paymentHelpers.mockStripeConfigError(500, 'Stripe configuration error')

    // Reload to trigger errors
    await page.reload()
    await paymentHelpers.navigateToPaymentMethods()

    // Should show error state
    const hasError = await paymentHelpers.hasError()
    expect(hasError).toBe(true)

    const errorMessage = await paymentHelpers.getErrorMessage()
    expect(errorMessage).toContain('Error loading payment methods')
  })

  test('should handle slow API responses', async ({ page }) => {
    // Mock slow API response
    await page.route('**/v1/payment-methods/orgs/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      route.continue()
    })

    await paymentHelpers.mockStripeConfig()

    // Reload to trigger slow response
    await page.reload()
    await paymentHelpers.navigateToPaymentMethods()

    // Should show loading state
    const isLoading = await paymentHelpers.isLoading()
    expect(isLoading).toBe(true)

    // Wait for loading to complete
    await paymentHelpers.waitForPaymentMethodsToLoad()

    // Should eventually show content
    const hasError = await paymentHelpers.hasError()
    const hasExistingMethods = await page.getByTestId('existing-payment-methods').isVisible().catch(() => false)
    
    expect(hasError || hasExistingMethods).toBe(true)
  })

  test('should validate payment method display format', async ({ page }) => {
    // Mock payment methods with various formats
    const mockPaymentMethods = [
      {
        id: 'pm_1',
        stripePaymentMethodId: 'pm_test_1',
        org: 'org_1',
        isDefault: false,
        type: 'card',
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2025,
        billingDetails: {
          name: 'Test User',
          email: 'test@example.com'
        },
        metadata: {}
      },
      {
        id: 'pm_2',
        stripePaymentMethodId: 'pm_test_2',
        org: 'org_1',
        isDefault: true,
        type: 'card',
        brand: 'mastercard',
        last4: '5555',
        expMonth: 6,
        expYear: 2026,
        billingDetails: {
          name: 'Test User',
          email: 'test@example.com'
        },
        metadata: {}
      }
    ]

    await paymentHelpers.mockPaymentMethodsResponse(mockPaymentMethods)
    await paymentHelpers.mockStripeConfig()

    // Reload to get mocked data
    await page.reload()
    await paymentHelpers.navigateToPaymentMethods()
    await paymentHelpers.waitForPaymentMethodsToLoad()

    // Verify payment method display format
    const firstPaymentText = await paymentHelpers.getPaymentMethodText('pm_1')
    expect(firstPaymentText).toContain('VISA')
    expect(firstPaymentText).toContain('4242')

    const firstPaymentSubtext = await paymentHelpers.getPaymentMethodSubtext('pm_1')
    expect(firstPaymentSubtext).toContain('Expires 12/2025')

    const secondPaymentText = await paymentHelpers.getPaymentMethodText('pm_2')
    expect(secondPaymentText).toContain('MASTERCARD')
    expect(secondPaymentText).toContain('5555')

    // Verify default badge
    const isSecondDefault = await paymentHelpers.isPaymentMethodDefault('pm_2')
    expect(isSecondDefault).toBe(true)
  })

  test('should handle empty payment methods list', async ({ page }) => {
    // Mock empty payment methods response
    await paymentHelpers.mockPaymentMethodsResponse([])
    await paymentHelpers.mockStripeConfig()

    // Reload to get mocked data
    await page.reload()
    await paymentHelpers.navigateToPaymentMethods()
    await paymentHelpers.waitForPaymentMethodsToLoad()

    // Should not show existing methods section
    const existingMethods = page.getByTestId('existing-payment-methods')
    const isVisible = await existingMethods.isVisible().catch(() => false)
    expect(isVisible).toBe(false)

    // Should show add payment form
    const isFormVisible = await paymentHelpers.isAddPaymentFormVisible()
    expect(isFormVisible).toBe(true)
  })

  test('should handle payment method action failures', async ({ page }) => {
    // Mock payment methods data
    const mockPaymentMethods = [
      {
        id: 'pm_1',
        stripePaymentMethodId: 'pm_test_1',
        org: 'org_1',
        isDefault: false,
        type: 'card',
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2025,
        billingDetails: {
          name: 'Test User',
          email: 'test@example.com'
        },
        metadata: {}
      }
    ]

    await paymentHelpers.mockPaymentMethodsResponse(mockPaymentMethods)
    await paymentHelpers.mockStripeConfig()
    
    // Mock API failures
    await paymentHelpers.mockSetDefaultPaymentMethod(false)
    await paymentHelpers.mockRemovePaymentMethod(false)

    // Reload to get mocked data
    await page.reload()
    await paymentHelpers.navigateToPaymentMethods()
    await paymentHelpers.waitForPaymentMethodsToLoad()

    // Test set default failure
    await paymentHelpers.setPaymentMethodAsDefault('pm_1')
    const setDefaultMessage = await paymentHelpers.getPaymentMessage()
    expect(setDefaultMessage).toContain('Failed to set default payment method')

    // Test remove failure
    await paymentHelpers.removePaymentMethod('pm_1')
    const removeMessage = await paymentHelpers.getPaymentMessage()
    expect(removeMessage).toContain('Failed to remove payment method')
  })
})
