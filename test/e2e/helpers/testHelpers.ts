import { test as base, expect, Page } from '@playwright/test'

export async function registerUserViaUI(page: Page, name: string, email: string, password: string, phone: string): Promise<void> {
  if (await page.getByTestId('register-name').count() === 0) {
    await page.getByTestId('register-link').click()
  }
  await page.getByTestId('register-name').fill(name)
  await page.getByTestId('register-email').fill(email)
  await page.getByTestId('register-password').fill(password)
  await page.getByTestId('register-confirm-password').fill(password)
  await page.getByTestId('register-phone').fill(phone)
  await page.getByTestId('register-submit').click()
  await page.waitForSelector('[data-testid="home-header"], [data-testid="email-input"]', { timeout: 10000 })
}

export async function loginUserViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId('email-input').fill(email)
  await page.getByTestId('password-input').fill(password)
  await expect(page.getByTestId('login-button')).toBeVisible();
  await page.getByTestId('login-button').click()
  await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
}

export async function createPatientViaUI(page: Page, name: string, email: string, phone: string): Promise<void> {
  await page.getByTestId('add-patient-button').click()
  await page.getByTestId('patient-name-input').fill(name)
  await page.getByTestId('patient-email-input').fill(email)
  await page.getByTestId('patient-phone-input').fill(phone)
  await page.getByTestId('save-patient-button').click()
  await page.waitForSelector(`[data-testid^="patient-name-"]:has-text("${name}")`, { timeout: 10000 })
}

export async function goToOrgTab(page: Page): Promise<void> {
  await page.getByTestId('tab-org').click()
  await page.waitForSelector('[data-testid="org-header"]', { timeout: 10000 })
}

export async function goToHomeTab(page: Page): Promise<void> {
  await page.getByTestId('tab-home').click()
  await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
}

export async function goToAlertTab(page: Page): Promise<void> {
  await page.getByTestId('tab-alert').click()
  await page.waitForSelector('[data-testid="alert-header"]', { timeout: 10000 })
}

export async function goToPaymentTab(page: Page): Promise<void> {
  await page.getByTestId('tab-payment').click()
  await page.waitForSelector('[data-testid="payment-header"]', { timeout: 10000 })
}

export async function createAlertViaUI(page: Page, message: string, importance: string, alertType: string, patientName?: string) {
  await goToAlertTab(page)
  await page.click('[data-testid="create-alert-button"]')
  await page.fill('[data-testid="alert-message-input"]', message)
  await page.selectOption('[data-testid="alert-importance-select"]', importance)
  await page.selectOption('[data-testid="alert-type-select"]', alertType)
  if (patientName) {
    await page.selectOption('[data-testid="alert-patient-select"]', { label: patientName })
  }
  await page.click('[data-testid="save-alert-button"]')
  await page.waitForSelector(`text=${message}`, { timeout: 10000 })
}

export async function markAlertAsReadViaUI(page: Page, alertMessage: string) {
  await goToAlertTab(page)
  const alertItem = page.locator(`[data-testid="alert-item"]:has-text("${alertMessage}")`)
  await alertItem.click()
  await page.waitForTimeout(500)
}

export async function markAllAlertsAsReadViaUI(page: Page) {
  await goToAlertTab(page)
  await page.click('[data-testid="mark-all-checkbox"]')
  await page.waitForTimeout(1000)
}

export async function getVisibleAlertMessages(page: Page): Promise<string[]> {
  await goToAlertTab(page)
  await page.waitForSelector('[data-testid="alert-list"]', { timeout: 10000 })
  const messages = await page.$$eval('[data-testid="alert-item"]', items => items.map(i => i.textContent || ''))
  return messages
}

export async function ensureUserRegisteredAndLoggedInViaUI(page: Page, name: string, email: string, password: string, phone: string): Promise<void> {
  // Try to login
  await page.getByTestId('email-input').fill(email)
  await page.getByTestId('password-input').fill(password)
  await page.getByTestId('login-button').click()
  // Wait for either home screen or login error
  try {
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 5000 })
    // Login successful
    return
  } catch {
    // Login failed, check for error and register
    if (await page.getByText(/Failed to log in/i).isVisible()) {
      // Go to register screen
      if (await page.getByTestId('register-name').count() === 0) {
        await page.getByTestId('register-link').click()
      }
      await page.getByTestId('register-name').fill(name)
      await page.getByTestId('register-email').fill(email)
      await page.getByTestId('register-password').fill(password)
      await page.getByTestId('register-confirm-password').fill(password)
      await page.getByTestId('register-phone').fill(phone)
      await page.getByTestId('register-submit').click()
      await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
    } else {
      throw new Error('Login failed for unknown reason')
    }
  }
}

export async function logoutViaUI(page: Page): Promise<void> {
  // Assumes you are on the home screen
  await page.getByTestId('profile-button').click()
  await page.getByTestId('logout-button').click()
  // Wait for login screen to appear
  await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
}

// Custom test fixture that navigates to the root URL before each test
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.goto('/')
    await use(page)
  },
})
