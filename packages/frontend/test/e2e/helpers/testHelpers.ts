import { test as base, expect, Page } from '@playwright/test'

export { expect }
import { asyncStorageMockScript } from './asyncStorageMock'

export async function registerUserViaUI(page: Page, name: string, email: string, password: string, phone: string): Promise<void> {
  // Ensure we're on login screen first
  await page.waitForSelector('input[data-testid="email-input"]', { timeout: 10000 }).catch(async () => {
    // If not on login screen, try to navigate there
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('input[data-testid="email-input"]', { timeout: 10000 })
  })
  
  // Use data-testid for React Native Web
  if (await page.locator('input[data-testid="register-name"]').count() === 0) {
    // Wait for register button to be visible - try multiple selectors
    let registerButton = page.getByTestId('register-button')
    let buttonCount = await registerButton.count().catch(() => 0)
    
    if (buttonCount === 0) {
      // Try alternative selector
      registerButton = page.locator('[data-testid="register-button"]').first()
      buttonCount = await registerButton.count().catch(() => 0)
    }
    
    if (buttonCount === 0) {
      // Last resort: find by text
      registerButton = page.getByText(/register|create account/i).first()
      buttonCount = await registerButton.count().catch(() => 0)
    }
    
    if (buttonCount === 0) {
      // If still not found, reload the page and try again
      console.log('⚠️ Register button not found, reloading page...')
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForSelector('input[data-testid="email-input"]', { timeout: 10000 })
      registerButton = page.getByTestId('register-button')
      buttonCount = await registerButton.count().catch(() => 0)
    }
    
    if (buttonCount === 0) {
      throw new Error('Register button not found on page. Page might not be in login state.')
    }
    
    await registerButton.waitFor({ state: 'visible', timeout: 10000 })
    await registerButton.click()
    await page.waitForSelector('input[data-testid="register-name"]', { timeout: 10000 })
  }
  // Use data-testid for TextField inputs (TextField needs input[data-testid="..."] pattern)
  await page.locator('input[data-testid="register-name"]').fill(name)
  await page.locator('input[data-testid="register-email"]').fill(email)
  await page.locator('input[data-testid="register-password"]').fill(password)
  await page.locator('input[data-testid="register-confirm-password"]').fill(password)
  await page.locator('input[data-testid="register-phone"]').fill(phone)
  
  // Find submit button - try getByTestId first, fallback to locator
  let submitButton = page.getByTestId('register-submit')
  let buttonCount = await submitButton.count().catch(() => 0)
  if (buttonCount === 0) {
    submitButton = page.locator('[data-testid="register-submit"]').first()
  }
  await submitButton.waitFor({ state: 'visible', timeout: 5000 })
  await submitButton.click()
  // Wait for navigation after registration - check for email verification screen or home screen
  await page.waitForTimeout(2000) // Give time for navigation
  
  // Try to find email verification screen indicators
  const emailVerificationButton = page.locator('[data-testid="resend-verification-button"]')
  const backToLoginButton = page.locator('[data-testid="back-to-login-button"]')
  const homeHeader = page.locator('[data-testid="home-header"]')
  
  // Wait for any of these indicators to be visible
  try {
    await Promise.race([
      emailVerificationButton.waitFor({ state: 'visible', timeout: 5000 }),
      backToLoginButton.waitFor({ state: 'visible', timeout: 5000 }),
      homeHeader.waitFor({ state: 'visible', timeout: 5000 }),
    ])
  } catch {
    // If none found, check if we're on login screen (registration may have failed)
    await page.waitForSelector('input[data-testid="email-input"]', { timeout: 5000 }).catch(() => {
      // If we can't find anything, that's okay - the test will handle it
    })
  }
}

/**
 * Reliable click helper that handles intercepted clicks and visibility issues
 */
export async function reliableClick(page: Page, locator: any, options: { timeout?: number; force?: boolean } = {}): Promise<void> {
  const { timeout = 10000, force = false } = options
  
  try {
    // Wait for element to be visible and enabled
    await locator.waitFor({ state: 'visible', timeout: Math.min(timeout, 5000) })
    await locator.click({ timeout, force: false })
  } catch (error) {
    // If click is intercepted or element not clickable, try force click
    if (error.message?.includes('intercept') || error.message?.includes('not clickable') || error.message?.includes('not visible')) {
      // Scroll into view first
      await locator.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      
      // Try force click
      try {
        await locator.click({ timeout, force: true })
      } catch (forceError) {
        // If still fails, wait a bit more and try again
        await page.waitForTimeout(1000)
        await locator.click({ timeout, force: true })
      }
    } else if (force) {
      // If force was requested and first attempt failed, try force
      await locator.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      await locator.click({ timeout, force: true })
    } else {
      throw error
    }
  }
}

export async function loginUserViaUI(page: Page, email: string, password: string): Promise<void> {
  console.log(`Attempting to login with email: ${email}`)
  
  // Wait for login form to be visible - use data-testid for inputs
  await page.waitForSelector('input[data-testid="email-input"]', { timeout: 5000 })
  
  await page.waitForTimeout(500) // Small delay to ensure form is ready
  
  // Fill in login form - use locator for input elements (getByTestId doesn't work for inputs in React Native Web)
  const emailInput = page.locator('input[data-testid="email-input"]')
  const passwordInput = page.locator('input[data-testid="password-input"]')
  
  // Wait for inputs to be visible and enabled
  await expect(emailInput).toBeVisible({ timeout: 5000 })
  await expect(passwordInput).toBeVisible({ timeout: 5000 })
  
  await emailInput.fill(email, { timeout: 5000 })
  await passwordInput.fill(password, { timeout: 5000 })
  
  // Find login button - try getByTestId first, fallback to locator
  let loginButton = page.getByTestId('login-button')
  let buttonCount = await loginButton.count().catch(() => 0)
  if (buttonCount === 0) {
    loginButton = page.locator('[data-testid="login-button"]').first()
    buttonCount = await loginButton.count().catch(() => 0)
  }
  
  if (buttonCount === 0) {
    // Wait a bit more for the page to fully render
    await page.waitForTimeout(1000)
    loginButton = page.getByTestId('login-button')
    buttonCount = await loginButton.count().catch(() => 0)
    if (buttonCount === 0) {
      loginButton = page.locator('[data-testid="login-button"]').first()
    }
  }
  
  await expect(loginButton).toBeVisible({ timeout: 10000 });
  
  // Click login button with retry logic for intercepted clicks
  try {
    await loginButton.click({ timeout: 5000, force: false })
  } catch (error) {
    // If click is intercepted, try force click
    if (error.message?.includes('intercept') || error.message?.includes('not clickable')) {
      await loginButton.click({ timeout: 5000, force: true })
    } else {
      throw error
    }
  }
  
  // Wait for either success or error with longer timeout
  try {
    // Wait for home screen indicators - try multiple possible selectors
    const homeIndicators = [
      '[data-testid="home-header"]',
      '[data-testid="tab-home"]',
      '[data-testid="add-patient-button"]',
      '[aria-label="Home tab"]',
      'text=Add Patient'
    ]
    
    let foundHome = false
    for (const selector of homeIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 })
        foundHome = true
        console.log(`Login successful - found home indicator: ${selector}`)
        break
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!foundHome) {
      // Try waiting a bit more and check again
      await page.waitForTimeout(2000)
      for (const selector of homeIndicators) {
        try {
          if (await page.locator(selector).isVisible({ timeout: 2000 })) {
            foundHome = true
            console.log(`Login successful - found home indicator after wait: ${selector}`)
            break
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    if (!foundHome) {
      throw new Error('Home screen not found')
    }
  } catch (error) {
    console.log('Login failed - checking for error messages')
    
    // Wait a moment for error messages to appear
    await page.waitForTimeout(1000)
    
    // Check for login error messages - including backend errors
    const errorMessages = [
      'Failed to log in',
      'Invalid credentials',
      'User not found',
      'Incorrect password',
      'Invalid caregiver ID format',
      'Please verify your email',
      'Account is locked',
      'Incorrect email or password'
    ]
    
    for (const errorMsg of errorMessages) {
      try {
        // Try multiple ways to find error text
        const errorSelectors = [
          page.getByText(errorMsg, { exact: false }),
          page.locator(`text=${errorMsg}`),
          page.locator(`*:has-text("${errorMsg}")`)
        ]
        
        for (const errorElement of errorSelectors) {
          try {
            if (await errorElement.isVisible({ timeout: 1000 })) {
              console.log(`Login error found: ${errorMsg}`)
              throw new Error(`Login failed: ${errorMsg}`)
            }
          } catch (e) {
            if (e.message.includes('Login failed:')) {
              throw e
            }
            // Continue checking
          }
        }
      } catch (e) {
        if (e.message.includes('Login failed:')) {
          throw e
        }
        // Continue checking other error messages
      }
    }
    
    // Check page content for error messages
    const pageContent = await page.content()
    const pageText = await page.textContent('body').catch(() => '')
    
    for (const errorMsg of errorMessages) {
      if (pageContent.includes(errorMsg) || pageText.includes(errorMsg)) {
        console.log(`Login error found in page content: ${errorMsg}`)
        throw new Error(`Login failed: ${errorMsg}`)
      }
    }
    
    // If no specific error found, check current page content
    const currentUrl = page.url()
    console.log(`Current URL: ${currentUrl}`)
    console.log(`Page contains login form: ${pageContent.includes('email-input')}`)
    
    // Check console logs for errors
    const consoleLogs = await page.evaluate(() => {
      return window.console._logs || []
    }).catch(() => [])
    
    if (consoleLogs.length > 0) {
      console.log('Console logs:', consoleLogs.slice(-5))
    }
    
    throw new Error('Login failed - no home header found and no specific error message detected')
  }
}

export async function createPatientViaUI(page: Page, name: string, email: string, phone: string): Promise<void> {
  console.log(`Creating patient: ${name} (${email})`)
  
  // Wait for add patient button to be enabled (indicating user role is loaded)
  await page.waitForSelector('[data-testid="add-patient-button"]:not([disabled])', { timeout: 10000 })
  
  await page.getByTestId('add-patient-button').click()
  
  // Wait for patient screen to be fully loaded
  await page.waitForSelector('[data-testid="patient-name-input"]', { timeout: 10000 })
  console.log('Patient screen loaded')
  
  await page.getByTestId('patient-name-input').fill(name)
  await page.getByTestId('patient-email-input').fill(email)
  // Use phone number as-is since test data already has proper format
  await page.getByTestId('patient-phone-input').fill(phone)
  
  // Wait a moment for validation to complete
  await page.waitForTimeout(500)
  
  // Debug: Check form field values
  const nameValue = await page.getByTestId('patient-name-input').inputValue()
  const emailValue = await page.getByTestId('patient-email-input').inputValue()
  const phoneValue = await page.getByTestId('patient-phone-input').inputValue()
  console.log(`Form field values - Name: "${nameValue}", Email: "${emailValue}", Phone: "${phoneValue}"`)
  
  // Debug: Check if save button is enabled before clicking
  const saveButton = page.getByTestId('save-patient-button')
  const isEnabled = await saveButton.isEnabled()
  console.log(`Save button enabled: ${isEnabled}`)
  
  if (!isEnabled) {
    // Wait a bit more for user state to load
    console.log('Save button is disabled, waiting for user state to load...')
    await page.waitForTimeout(2000)
    
    // Check again
    const isEnabledAfterWait = await saveButton.isEnabled()
    console.log(`Save button enabled after wait: ${isEnabledAfterWait}`)
    
    if (!isEnabledAfterWait) {
      // Get the button's disabled state and attributes
      const disabledAttr = await saveButton.getAttribute('disabled')
      const ariaDisabled = await saveButton.getAttribute('aria-disabled')
      console.log(`Save button disabled attribute: ${disabledAttr}`)
      console.log(`Save button aria-disabled: ${ariaDisabled}`)
      
      // Check if we're on the right screen
      const currentUrl = page.url()
      console.log(`Current URL: ${currentUrl}`)
      
      // Check if patient name input is visible
      const nameInputVisible = await page.getByTestId('patient-name-input').isVisible()
      console.log(`Patient name input visible: ${nameInputVisible}`)
      
      // Check for validation errors (optional - they might not exist)
      let emailError: string | null = null
      let phoneError: string | null = null
      try {
        const emailErrorElement = page.locator('[data-testid="patient-email-input"] + div')
        if (await emailErrorElement.count() > 0) {
          emailError = await emailErrorElement.textContent()
        }
        const phoneErrorElement = page.locator('[data-testid="patient-phone-input"] + div')
        if (await phoneErrorElement.count() > 0) {
          phoneError = await phoneErrorElement.textContent()
        }
      } catch (e) {
        console.log('No validation error elements found')
      }
      console.log(`Email error: ${emailError}`)
      console.log(`Phone error: ${phoneError}`)
      

      
      throw new Error(`Save button is disabled. URL: ${currentUrl}, Name input visible: ${nameInputVisible}, Email error: ${emailError}, Phone error: ${phoneError}`)
    }
  }
  
  await saveButton.click()
  
  // Wait for either success message or error message
  try {
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 15000 })
    console.log('Successfully navigated back to home screen')
  } catch (error) {
    console.log('Failed to navigate to home screen, checking for errors...')
    
    // Check if there's an error message
    const errorElements = page.locator('[data-testid*="error"], .error, [class*="error"]')
    const errorCount = await errorElements.count()
    
    if (errorCount > 0) {
      const errorText = await errorElements.first().textContent()
      console.log('Error message found:', errorText)
      throw new Error(`Patient creation failed: ${errorText}`)
    }
    
    // If no error message, try waiting a bit longer
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 5000 })
  }
  
  // Small delay to allow Redux state to update
  await page.waitForTimeout(1000)
  
  // Wait for the patient to appear in the list
  try {
    await page.waitForSelector(`[data-testid^="patient-name-"]:has-text("${name}")`, { timeout: 15000 })
    console.log(`Patient "${name}" successfully created and visible in list`)
  } catch (error) {
    console.log(`Patient "${name}" not found in list after creation`)
    
    // Check what patients are actually in the list
    const patientElements = page.locator('[data-testid^="patient-name-"]')
    const patientCount = await patientElements.count()
    console.log(`Found ${patientCount} patients in list`)
    
    for (let i = 0; i < patientCount; i++) {
      const patientText = await patientElements.nth(i).textContent()
      console.log(`Patient ${i + 1}: ${patientText}`)
    }
    
    throw error
  }
}

export async function goToOrgTab(page: Page): Promise<void> {
  const { navigateToOrgTab } = await import('./navigation')
  await navigateToOrgTab(page)
  await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
}

export async function goToHomeTab(page: Page): Promise<void> {
  const { navigateToHomeTab } = await import('./navigation')
  await navigateToHomeTab(page)
  await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
}

export async function goToAlertTab(page: Page): Promise<void> {
  const { navigateToAlertTab } = await import('./navigation')
  await navigateToAlertTab(page)
  await page.waitForSelector('[data-testid="alert-header"]', { timeout: 10000 })
}

export async function goToPaymentTab(page: Page): Promise<void> {
  const { navigateToPaymentScreen } = await import('./navigation')
  await navigateToPaymentScreen(page)
  await page.waitForSelector('[data-testid="payment-info-container"]', { timeout: 10000 })
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
  // Navigate to login page first
  await page.goto('/')
  await page.waitForTimeout(1000)
  
  // Try to login using aria-label (React Native Web compatibility)
  await page.fill('input[data-testid="email-input"]', email)
  await page.fill('input[data-testid="password-input"]', password)
  await page.click('[data-testid="login-button"]')
  
  // Wait for either home screen or login error
  try {
      await page.waitForSelector('[data-testid="home-header"]', { timeout: 5000 })
    // Login successful
    return
  } catch {
    // Login failed, check for error and register
    if (await page.getByText(/Failed to log in/i).isVisible()) {
      // Go to register screen
      if (await page.locator('input[data-testid="register-name"]').count() === 0) {
        await page.getByTestId('register-button').click()
      }
      // Use data-testid for TextField inputs (TextField needs input[data-testid="..."] pattern)
      await page.fill('input[data-testid="register-name"]', name)
      await page.fill('input[data-testid="register-email"]', email)
      await page.fill('input[data-testid="register-password"]', password)
      await page.fill('input[data-testid="register-confirm-password"]', password)
      await page.fill('input[data-testid="register-phone"]', phone)
      
      // Find submit button - try getByTestId first, fallback to locator
      let submitButton = page.getByTestId('register-submit')
      let buttonCount = await submitButton.count().catch(() => 0)
      if (buttonCount === 0) {
        submitButton = page.locator('[data-testid="register-submit"]').first()
      }
      await submitButton.waitFor({ state: 'visible', timeout: 5000 })
      await submitButton.click()
      await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
    } else {
      throw new Error('Login failed for unknown reason')
    }
  }
}

export async function logoutViaUI(page: Page): Promise<void> {
  console.log('Attempting to logout...')
  
  // Wait a moment for the page to be fully loaded
  await page.waitForTimeout(1000)
  
  try {
    // Navigate directly to profile screen (more reliable than clicking button)
    // Profile is in HomeStack, not OrgStack
    console.log('Navigating to profile screen...')
    await page.goto('/MainTabs/Home/Profile')
    await page.waitForTimeout(1000)
    
    // Wait for profile screen to load
    await page.waitForSelector('[data-testid="profile-logout-button"]', { timeout: 5000 })
    console.log('Found logout button on profile screen')
    
    // On profile screen, click the logout button (which navigates to logout screen)
    await page.click('[data-testid="profile-logout-button"]')
    
    // Wait for logout screen to load
    await page.waitForSelector('[data-testid="logout-button"]', { timeout: 5000 })
    console.log('Found confirm logout button')
    
    // On logout screen, click the logout button (which actually performs logout)
    await page.click('[data-testid="logout-button"]')
    
  } catch (error) {
    console.log('Logout failed, navigating to login screen as fallback:', error.message)
    // Navigate directly to login screen as fallback
    await page.goto('/')
  }
  
  // Wait for login screen to appear
  try {
    await page.waitForSelector('input[data-testid="email-input"]', { timeout: 5000 })
    console.log('Successfully reached login screen')
  } catch (error) {
    console.log('Failed to reach login screen, but continuing...')
  }
}

export async function editPatientViaUI(page: Page, patientName: string, newName: string, newEmail: string, newPhone: string): Promise<void> {
  // Click on the edit button for the specified patient
  await page.getByTestId(`edit-patient-button-${patientName}`).click()
  
  // Wait for patient edit screen to load
  await page.waitForSelector('[data-testid="patient-name-input"]', { timeout: 10000 })
  
  // Update the patient information
  await page.getByTestId('patient-name-input').fill(newName)
  await page.getByTestId('patient-email-input').fill(newEmail)
  await page.getByTestId('patient-phone-input').fill(newPhone)
  
  // Save the changes
  await page.getByTestId('save-patient-button').click()
  
  // Wait for navigation back to home screen
  await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
}

export async function deletePatientViaUI(page: Page, patientName: string): Promise<void> {
  // Click on the edit button for the specified patient
  await page.getByTestId(`edit-patient-button-${patientName}`).click()
  
  // Wait for patient edit screen to load
  await page.waitForSelector('[data-testid="delete-patient-button"]', { timeout: 10000 })
  
  // Click delete button
  await page.getByTestId('delete-patient-button').click()
  
  // Wait for confirm delete button to appear
  await page.waitForSelector('[data-testid="delete-patient-button"]:has-text("CONFIRM DELETE")', { timeout: 5000 })
  
  // Click confirm delete
  await page.getByTestId('delete-patient-button').click()
  
  // Wait for navigation back to home screen
  await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
}

export async function checkPatientExists(page: Page, patientName: string): Promise<boolean> {
  try {
    await page.waitForSelector(`[data-testid="patient-name-${patientName}"]`, { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

export async function getPatientCount(page: Page): Promise<number> {
  const patientCards = page.locator('[data-testid^="patient-card-"]')
  return await patientCards.count()
}

export async function waitForPatientListToLoad(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="patient-list"]', { timeout: 10000 })
}

// Custom test fixture that navigates to the root URL before each test
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    // Capture console logs and errors to file
    const consoleLogs: string[] = []
    const consoleErrors: string[] = []
    
    page.on('console', (msg) => {
      const text = msg.text()
      consoleLogs.push(`[${msg.type()}] ${text}`)
      if (msg.type() === 'error') {
        consoleErrors.push(text)
      }
    })
    
    page.on('pageerror', (error) => {
      const errorText = `Page Error: ${error.message}\n${error.stack}`
      consoleErrors.push(errorText)
      consoleLogs.push(`[pageerror] ${errorText}`)
    })
    
    page.on('requestfailed', (request) => {
      const errorText = `Request Failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`
      consoleErrors.push(errorText)
      consoleLogs.push(`[requestfailed] ${errorText}`)
    })
    
    // Inject AsyncStorage mock before navigating
    await page.addInitScript(asyncStorageMockScript)
    
    try {
      // Clear storage first, then navigate
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.evaluate(() => {
        if ((window as any).AsyncStorage) {
          (window as any).AsyncStorage.clear()
        }
        localStorage.clear()
        sessionStorage.clear()
      })
      
      // Reload to ensure clean state
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      
      // Wait for login screen - use data-testid for React Native Web
      try {
        await page.waitForSelector('input[data-testid="email-input"]', { timeout: 5000 })
        console.log('Successfully loaded login screen')
      } catch (error) {
        // Try alternative selectors
        await page.waitForSelector('input[type="email"], input[data-testid="email-input"], [data-testid="login-form"]', { timeout: 5000 }).catch(() => {
          console.error('Failed to find login screen elements')
          throw error
        })
      }
      
      await use(page)
    } catch (error) {
      // Write console logs to file before throwing
      const fs = require('fs')
      const path = require('path')
      const logFile = path.join(__dirname, '../../test-console-logs.txt')
      const errorFile = path.join(__dirname, '../../test-console-errors.txt')
      
      fs.writeFileSync(logFile, consoleLogs.join('\n'), 'utf8')
      fs.writeFileSync(errorFile, consoleErrors.join('\n'), 'utf8')
      
      console.error(`\n=== Console logs written to ${logFile} ===`)
      console.error(`=== Console errors written to ${errorFile} ===`)
      console.error(`Total logs: ${consoleLogs.length}, Total errors: ${consoleErrors.length}`)
      
      throw error
    }
  },
})
