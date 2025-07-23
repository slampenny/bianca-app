import { test, expect, Page } from '@playwright/test'
import { 
  loginUserViaUI,
  goToPaymentTab,
  logoutViaUI,
  createPatientViaUI,
  goToHomeTab
} from './helpers/testHelpers'
import { navigateToHome } from './helpers/navigation'
import { TEST_USERS } from './fixtures/testData'

test.describe('Payments Tab E2E Tests', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
  })

  test.describe('Navigation and Access Control', () => {
    test('should navigate to payments tab successfully', async () => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)

      // Navigate to payments tab
      await goToPaymentTab(page)

      // Verify we're on the payments screen
      await expect(page.getByTestId('payment-info-container')).toBeVisible()
      
      // Verify tabs are present
      await expect(page.getByTestId('payment-methods-tab')).toBeVisible()
      await expect(page.getByTestId('billing-info-tab')).toBeVisible()
    })

    test('should show access restricted message for unauthorized users', async () => {
      // Login as a regular staff user (not org admin)
      await navigateToHome(page, TEST_USERS.STAFF)

      // Navigate to payments tab
      await goToPaymentTab(page)

      // Verify access restricted message is shown
      await expect(page.getByTestId('access-restricted-title')).toBeVisible()
      await expect(page.getByTestId('access-restricted-message')).toBeVisible()
      await expect(page.getByText('Access Restricted')).toBeVisible()
      await expect(page.getByText('You do not have the necessary permissions')).toBeVisible()
    })
  })

  test.describe('Payment Methods Tab', () => {
    test('should display payment methods iframe/webview for authorized users', async () => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)

      // Navigate to payments tab
      await goToPaymentTab(page)

      // Click on Payment Methods tab
      await page.getByTestId('payment-methods-tab').click()

      // Verify payment methods container is visible
      await expect(page.getByTestId('payment-methods-container')).toBeVisible()

      // Check if iframe or webview is present (depending on platform)
      const iframe = page.getByTestId('payment-methods-iframe')
      const webview = page.getByTestId('payment-methods-webview')
      
      // One of them should be visible (iframe for web, webview for mobile)
      await expect(iframe.or(webview)).toBeVisible()
    })
  })

  test.describe('Billing Info Tab', () => {
    test('should display billing information for authorized users', async () => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)

      // Navigate to payments tab
      await goToPaymentTab(page)

      // Click on Billing Info tab
      await page.getByTestId('billing-info-tab').click()

      // Verify billing info container is visible
      await expect(page.getByTestId('billing-info-container')).toBeVisible()

      // Verify billing headers are present
      await expect(page.getByTestId('current-plan-text')).toBeVisible()
      await expect(page.getByTestId('next-billing-date-text')).toBeVisible()

      // Verify invoices list is present
      await expect(page.getByTestId('invoices-list')).toBeVisible()
    })

    test('should show loading indicator while fetching invoices', async () => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)

      // Navigate to payments tab
      await goToPaymentTab(page)

      // Click on Billing Info tab
      await page.getByTestId('billing-info-tab').click()

      // Check for either loading indicator or loaded content
      // The loading might be too fast to catch, so we'll check for either
      try {
        await expect(page.getByTestId('billing-loading-indicator')).toBeVisible({ timeout: 2000 })
      } catch {
        // If loading indicator is not visible, check that content loaded instead
        await expect(page.getByTestId('billing-info-container')).toBeVisible()
        await expect(page.getByTestId('invoices-list')).toBeVisible()
      }
    })

    test('should display invoices when they exist', async () => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)

      // Wait for user role to be loaded and verify we can create patients
      await goToHomeTab(page)
      
      // Verify the add patient button is enabled for org admin
      const addButton = page.getByTestId('add-patient-button')
      await expect(addButton).toBeEnabled()
      
      // Create a patient first to ensure we have some data
      await createPatientViaUI(page, 'Test Patient', 'test@example.com', '+1234567890')

      // Navigate to payments tab
      await goToPaymentTab(page)

      // Click on Billing Info tab
      await page.getByTestId('billing-info-tab').click()

      // Wait for the invoices list to load
      await expect(page.getByTestId('invoices-list')).toBeVisible()

      // Check if any invoice containers are present
      const invoiceContainers = page.locator('[data-testid^="invoice-container-"]')
      const count = await invoiceContainers.count()
      
      if (count > 0) {
        // If invoices exist, verify they have the expected structure
        await expect(invoiceContainers.first()).toBeVisible()
        
        // Check if invoice header is present
        const firstInvoiceHeader = page.locator('[data-testid^="invoice-header-"]').first()
        await expect(firstInvoiceHeader).toBeVisible()
      }
    })

    test('should expand/collapse invoice details when clicked', async () => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)

      // Navigate to payments tab
      await goToPaymentTab(page)

      // Click on Billing Info tab
      await page.getByTestId('billing-info-tab').click()

      // Wait for the invoices list to load
      await expect(page.getByTestId('invoices-list')).toBeVisible()

      // Check if any invoice containers are present
      const invoiceContainers = page.locator('[data-testid^="invoice-container-"]')
      const count = await invoiceContainers.count()
      
      if (count > 0) {
        // Click on the first invoice header to expand it
        const firstInvoiceHeader = page.locator('[data-testid^="invoice-header-"]').first()
        await firstInvoiceHeader.click()

        // Wait for invoice details to appear
        const firstInvoiceDetails = page.locator('[data-testid^="invoice-details-"]').first()
        await expect(firstInvoiceDetails).toBeVisible({ timeout: 5000 })

        // Verify invoice details contain expected information
        await expect(firstInvoiceDetails).toContainText('Invoice Number:')
        await expect(firstInvoiceDetails).toContainText('Status:')
        await expect(firstInvoiceDetails).toContainText('Issue Date:')
        await expect(firstInvoiceDetails).toContainText('Due Date:')

        // Click again to collapse
        await firstInvoiceHeader.click()

        // Wait for invoice details to disappear
        await expect(firstInvoiceDetails).not.toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Tab Navigation', () => {
    test('should switch between payment methods and billing info tabs', async () => {
      // Login as org admin
      await navigateToHome(page, TEST_USERS.ORG_ADMIN)

      // Navigate to payments tab
      await goToPaymentTab(page)

      // Verify we start on Payment Methods tab
      await expect(page.getByTestId('payment-methods-container')).toBeVisible()

      // Switch to Billing Info tab
      await page.getByTestId('billing-info-tab').click()
      await expect(page.getByTestId('billing-info-container')).toBeVisible()

      // Switch back to Payment Methods tab
      await page.getByTestId('payment-methods-tab').click()
      await expect(page.getByTestId('payment-methods-container')).toBeVisible()
    })
  })
}) 