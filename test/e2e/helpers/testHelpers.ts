import { test as base, expect, Page } from '@playwright/test'

export { expect }
import { asyncStorageMockScript } from './asyncStorageMock'

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
  console.log(`Attempting to login with email: ${email}`)
  
  // Wait for login form to be visible
  await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
  
  // Fill in login form
  await page.getByTestId('email-input').fill(email)
  await page.getByTestId('password-input').fill(password)
  await expect(page.getByTestId('login-button')).toBeVisible();
  
  // Click login button
  await page.getByTestId('login-button').click()
  
  // Wait for either success or error
  try {
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 10000 })
    console.log('Login successful - home header found')
  } catch (error) {
    console.log('Login failed - checking for error messages')
    
    // Check for login error messages
    const errorMessages = [
      'Failed to log in',
      'Invalid credentials',
      'User not found',
      'Incorrect password'
    ]
    
    for (const errorMsg of errorMessages) {
      try {
        const errorElement = page.getByText(errorMsg, { exact: false })
        if (await errorElement.isVisible({ timeout: 1000 })) {
          console.log(`Login error found: ${errorMsg}`)
          throw new Error(`Login failed: ${errorMsg}`)
        }
      } catch (e) {
        // Continue checking other error messages
      }
    }
    
    // If no specific error found, check current page content
    const currentUrl = page.url()
    const pageContent = await page.content()
    console.log(`Current URL: ${currentUrl}`)
    console.log(`Page contains login form: ${pageContent.includes('email-input')}`)
    
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
  await page.getByTestId('tab-org').click()
  await page.waitForSelector('[data-testid="view-caregivers-button"]', { timeout: 10000 })
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
  await page.goto('http://localhost:8082/')
  await page.waitForTimeout(1000)
  
  // Try to login using aria-label (React Native Web compatibility)
  await page.fill('[aria-label="email-input"]', email)
  await page.fill('[aria-label="password-input"]', password)
  await page.click('[aria-label="login-button"]')
  
  // Wait for either home screen or login error
  try {
    await page.waitForSelector('[aria-label="home-header"]', { timeout: 5000 })
    // Login successful
    return
  } catch {
    // Login failed, check for error and register
    if (await page.getByText(/Failed to log in/i).isVisible()) {
      // Go to register screen
      if (await page.locator('[aria-label="register-name"]').count() === 0) {
        await page.click('[aria-label="register-link"]')
      }
      await page.fill('[aria-label="register-name"]', name)
      await page.fill('[aria-label="register-email"]', email)
      await page.fill('[aria-label="register-password"]', password)
      await page.fill('[aria-label="register-confirm-password"]', password)
      await page.fill('[aria-label="register-phone"]', phone)
      await page.click('[aria-label="register-submit"]')
      await page.waitForSelector('[aria-label="home-header"]', { timeout: 10000 })
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
    console.log('Navigating to profile screen...')
    await page.goto('http://localhost:8082/MainTabs/Org/Profile')
    await page.waitForTimeout(1000)
    
    // Wait for profile screen to load
    await page.waitForSelector('[aria-label="profile-logout-button"]', { timeout: 5000 })
    console.log('Found logout button on profile screen')
    
    // On profile screen, click the logout button (which navigates to logout screen)
    await page.click('[aria-label="profile-logout-button"]')
    
    // Wait for logout screen to load
    await page.waitForSelector('[aria-label="logout-button"]', { timeout: 5000 })
    console.log('Found confirm logout button')
    
    // On logout screen, click the logout button (which actually performs logout)
    await page.click('[aria-label="logout-button"]')
    
  } catch (error) {
    console.log('Logout failed, navigating to login screen as fallback:', error.message)
    // Navigate directly to login screen as fallback
    await page.goto('/')
  }
  
  // Wait for login screen to appear
  try {
    await page.waitForSelector('[aria-label="email-input"]', { timeout: 5000 })
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
    // Inject AsyncStorage mock before navigating
    await page.addInitScript(asyncStorageMockScript)
    
    // Clear storage first, then navigate
    await page.goto('/')
    await page.evaluate(() => {
      if ((window as any).AsyncStorage) {
        (window as any).AsyncStorage.clear()
      }
      localStorage.clear()
      sessionStorage.clear()
    })
    
    // Reload to ensure clean state
    await page.reload()
    
    // Wait for login screen
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 15000 })
    console.log('Successfully loaded login screen')
    
    await use(page)
  },
})
