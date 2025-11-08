import { test, expect } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'

test.describe('Billing Screen', () => {
  test('should display billing information for authorized users', async ({ page }) => {
    const authWorkflow = new AuthWorkflow(page)
    
    // Login as org admin
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    // Navigate to billing screen through Org tab
    await page.getByTestId('tab-org').or(page.getByLabel('Organization tab')).click()
    // Wait for org screen to load
    await page.waitForSelector('[data-testid="org-screen"], [data-testid="payment-button"]', { timeout: 10000 })
    // Click payment button using flexible selector
    const paymentButton = page.locator('[data-testid="payment-button"]').first()
    await paymentButton.waitFor({ timeout: 5000 })
    await paymentButton.click()
    await page.waitForTimeout(2000) // Wait for payment screen to load
    // Wait for payment screen to be visible with flexible selector
    await page.waitForSelector('[data-testid="payment-info-container"]', { timeout: 10000 })
    await expect(page.getByTestId('payment-info-container')).toBeVisible()
    
    // Check that tabs are visible
    await expect(page.getByTestId('current-charges-tab')).toBeVisible()
    await expect(page.getByTestId('payment-methods-tab')).toBeVisible()
    await expect(page.getByTestId('billing-info-tab')).toBeVisible()
    
    // Check Current Charges tab content
    await page.getByTestId('current-charges-tab').click()
    await expect(page.getByTestId('current-charges-container')).toBeVisible()
    
    // Should show either charges or no charges message
    const hasCharges = await page.getByTestId('charges-loading-indicator').isVisible().catch(() => false)
    const noCharges = await page.getByTestId('no-charges-text').isVisible().catch(() => false)
    const hasSummary = await page.getByTestId('current-charges-container').getByText('Current Charges Summary').isVisible().catch(() => false)
    
    expect(hasCharges || noCharges || hasSummary).toBe(true)
    
    // Check Billing Info tab content
    await page.getByTestId('billing-info-tab').click()
    await expect(page.getByTestId('billing-info-container')).toBeVisible()
    
    // Should show either invoices or no invoices message
    const hasInvoices = await page.getByTestId('billing-loading-indicator').isVisible().catch(() => false)
    const noInvoices = await page.getByTestId('no-invoices-text').isVisible().catch(() => false)
    const hasInvoiceHistory = await page.getByTestId('invoices-history-list').isVisible().catch(() => false)
    
    expect(hasInvoices || noInvoices || hasInvoiceHistory).toBe(true)
  })

  test('should restrict access for unauthorized users', async ({ page }) => {
    const authWorkflow = new AuthWorkflow(page)
    
    // Login as regular caregiver (not org admin)
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    // Try to navigate to billing screen through Org tab
    await page.getByTestId('tab-org').or(page.getByLabel('Organization tab')).click()
    // Wait for org screen to load
    await page.waitForSelector('[data-testid="org-screen"], [data-testid="payment-button"]', { timeout: 10000 })
    // Click payment button using flexible selector
    const paymentButton = page.locator('[data-testid="payment-button"]').first()
    await paymentButton.waitFor({ timeout: 5000 })
    await paymentButton.click()
    await page.waitForTimeout(2000) // Wait for payment screen to load
    
    // Should show access restricted message
    await expect(page.getByTestId('access-restricted-title')).toBeVisible()
    await expect(page.getByTestId('access-restricted-message')).toBeVisible()
  })

  test('should display current charges when available', async ({ page }) => {
    const authWorkflow = new AuthWorkflow(page)
    
    // Login as org admin
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    // Navigate to billing screen through Org tab
    await page.getByTestId('tab-org').or(page.getByLabel('Organization tab')).click()
    // Wait for org screen to load
    await page.waitForSelector('[data-testid="org-screen"], [data-testid="payment-button"]', { timeout: 10000 })
    // Click payment button using flexible selector
    const paymentButton = page.locator('[data-testid="payment-button"]').first()
    await paymentButton.waitFor({ timeout: 5000 })
    await paymentButton.click()
    await page.waitForTimeout(2000) // Wait for payment screen to load
    // Wait for payment screen to be visible
    await page.waitForSelector('[data-testid="payment-info-container"]', { timeout: 10000 })
    await page.getByTestId('current-charges-tab').click()
    
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Check if we have charges or no charges message
    const currentChargesContainer = page.getByTestId('current-charges-container')
    
    // Should show either:
    // 1. Loading indicator
    // 2. No charges message
    // 3. Charges summary
    const hasLoading = await page.getByTestId('charges-loading-indicator').isVisible().catch(() => false)
    const hasNoCharges = await page.getByText('No Pending Charges').isVisible().catch(() => false)
    const hasSummary = await page.getByText('Current Charges Summary').isVisible().catch(() => false)
    
    expect(hasLoading || hasNoCharges || hasSummary).toBe(true)
  })

  test('should display billing info when available', async ({ page }) => {
    const authWorkflow = new AuthWorkflow(page)
    
    // Login as org admin
    await authWorkflow.givenIAmOnTheLoginScreen()
    const credentials = await authWorkflow.givenIHaveValidAdminCredentials()
    await authWorkflow.whenIEnterCredentials(credentials.email, credentials.password)
    await authWorkflow.whenIClickLoginButton()
    await authWorkflow.thenIShouldBeOnHomeScreen()
    
    // Navigate to billing screen through Org tab
    await page.getByTestId('tab-org').or(page.getByLabel('Organization tab')).click()
    // Wait for org screen to load
    await page.waitForSelector('[data-testid="org-screen"], [data-testid="payment-button"]', { timeout: 10000 })
    // Click payment button using flexible selector
    const paymentButton = page.locator('[data-testid="payment-button"]').first()
    await paymentButton.waitFor({ timeout: 5000 })
    await paymentButton.click()
    await page.waitForTimeout(2000) // Wait for payment screen to load
    // Wait for payment screen to be visible
    await page.waitForSelector('[data-testid="payment-info-container"]', { timeout: 10000 })
    await page.getByTestId('billing-info-tab').click()
    
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Check if we have billing info or no invoices message
    const billingInfoContainer = page.getByTestId('billing-info-container')
    
    // Should show either:
    // 1. Loading indicator
    // 2. No invoices message
    // 3. Invoice information
    const hasLoading = await page.getByTestId('billing-loading-indicator').isVisible().catch(() => false)
    const hasNoInvoices = await page.getByText('No Invoices Yet').isVisible().catch(() => false)
    const hasInvoices = await page.getByText('Latest Invoice').isVisible().catch(() => false)
    const hasTotalBilled = await page.getByText('Total Billed Amount').isVisible().catch(() => false)
    
    expect(hasLoading || hasNoInvoices || hasInvoices || hasTotalBilled).toBe(true)
  })
})
