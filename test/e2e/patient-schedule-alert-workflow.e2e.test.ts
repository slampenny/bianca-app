import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { AuthWorkflow } from './workflows/auth.workflow'
import { generatePatientData } from './fixtures/testData'

test.describe('Patient Creation with Schedule Alert Workflow', () => {
  
  test('Workflow: Create new patient, navigate to schedule, exit without schedule, verify alert created', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    
    // GIVEN: I am a logged-in healthcare provider with admin permissions
    const validCreds = await auth.givenIHaveValidAdminCredentials()
    await auth.whenIEnterCredentials(validCreds.email, validCreds.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()
    
    // Wait for home screen to fully load
    await page.waitForTimeout(3000)
    
    // WHEN: I create a new patient
    const patientData = generatePatientData()
    const patientName = patientData.name
    const patientEmail = patientData.email
    const patientPhone = patientData.phone
    
    console.log(`Creating patient: ${patientName} (${patientEmail})`)
    
    // Find add patient button with multiple selectors
    const addButtonSelectors = [
      '[data-testid="add-patient-button"]',
      'text=Add Patient',
      'button:has-text("Add Patient")',
    ]
    
    let addButton = null
    for (const selector of addButtonSelectors) {
      try {
        const button = page.locator(selector).first()
        const count = await button.count({ timeout: 3000 })
        if (count > 0) {
          const isVisible = await button.isVisible()
          if (isVisible) {
            addButton = button
            console.log(`Found add button with selector: ${selector}`)
            break
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!addButton) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/add-button-not-found.png', fullPage: true })
      const pageText = await page.textContent('body')
      console.log(`Page content (first 1000 chars): ${pageText?.substring(0, 1000)}`)
      throw new Error('Add patient button not found. User may not have permission or screen not loaded.')
    }
    
    // Wait for button to be enabled
    let attempts = 0
    while (attempts < 40) {
      const isEnabled = await addButton.isEnabled()
      if (isEnabled) break
      await page.waitForTimeout(500)
      attempts++
    }
    
    const isEnabled = await addButton.isEnabled()
    if (!isEnabled) {
      throw new Error('Add patient button is disabled - user may not have permission to create patients')
    }
    
    await addButton.click()
    console.log('Clicked add patient button')
    
    // Wait for patient screen - wait for the screen container first
    console.log('Waiting for patient screen to load...')
    await page.waitForSelector('[data-testid="patient-screen"]', { timeout: 20000 }).catch(() => {
      console.log('Patient screen test ID not found, continuing...')
    })
    
    // Wait for inputs to be attached to DOM and fillable
    await page.waitForFunction(
      () => {
        const nameInput = document.querySelector('[data-testid="patient-name-input"]') as HTMLInputElement
        const emailInput = document.querySelector('[data-testid="patient-email-input"]') as HTMLInputElement
        const phoneInput = document.querySelector('[data-testid="patient-phone-input"]') as HTMLInputElement
        return nameInput !== null && emailInput !== null && phoneInput !== null
      },
      { timeout: 20000 }
    )
    console.log('Patient screen inputs are in DOM')
    
    // Additional wait for React to finish rendering
    await page.waitForTimeout(2000)
    
    // Fill form using normal Playwright methods with proper React event handling
    // First, try to use the normal fill method
    try {
      const nameInput = page.getByTestId('patient-name-input')
      await nameInput.waitFor({ timeout: 5000, state: 'visible' })
      await nameInput.fill(patientName, { timeout: 5000 })
      console.log(`✓ Filled name using fill method`)
    } catch (e) {
      // Fallback to evaluate if fill doesn't work
      await page.evaluate((name) => {
        const input = document.querySelector('[data-testid="patient-name-input"]') as HTMLInputElement
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, name)
          } else {
            input.value = name
          }
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, patientName)
      console.log(`✓ Filled name using evaluate`)
    }
    
    try {
      const emailInput = page.getByTestId('patient-email-input')
      await emailInput.waitFor({ timeout: 5000, state: 'visible' })
      await emailInput.fill(patientEmail, { timeout: 5000 })
      console.log(`✓ Filled email using fill method`)
    } catch (e) {
      await page.evaluate((email) => {
        const input = document.querySelector('[data-testid="patient-email-input"]') as HTMLInputElement
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, email)
          } else {
            input.value = email
          }
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, patientEmail)
      console.log(`✓ Filled email using evaluate`)
    }
    
    try {
      const phoneInput = page.getByTestId('patient-phone-input')
      await phoneInput.waitFor({ timeout: 5000, state: 'visible' })
      await phoneInput.fill(patientPhone, { timeout: 5000 })
      console.log(`✓ Filled phone using fill method`)
    } catch (e) {
      await page.evaluate((phone) => {
        const input = document.querySelector('[data-testid="patient-phone-input"]') as HTMLInputElement
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, phone)
          } else {
            input.value = phone
          }
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, patientPhone)
      console.log(`✓ Filled phone using evaluate`)
    }
    
    // Wait for React to process the changes and enable the button
    await page.waitForTimeout(3000)
    
    // Find and click save button - wait for it to be enabled
    let saveButtonClicked = false
    for (let i = 0; i < 20; i++) {
      const clicked = await page.evaluate(() => {
        const button = document.querySelector('[data-testid="save-patient-button"]') as HTMLButtonElement
        if (button && !button.disabled) {
          button.click()
          return true
        }
        return false
      })
      if (clicked) {
        saveButtonClicked = true
        console.log('✓ Clicked save button')
        break
      }
      await page.waitForTimeout(500)
    }
    
    if (!saveButtonClicked) {
      // Try using locator as fallback
      const saveButton = page.getByTestId('save-patient-button')
      await saveButton.waitFor({ timeout: 10000, state: 'visible' })
      await saveButton.click()
      console.log('✓ Clicked save button using locator')
    }
    
    // THEN: I should be automatically navigated to the schedule screen
    console.log('Waiting for navigation to schedule screen...')
    await page.waitForTimeout(4000) // Give time for patient creation and navigation
    
    // Verify we're on the schedule screen
    const scheduleIndicators = [
      page.getByText(/schedule/i),
      page.getByText(/frequency/i),
      page.getByText(/weekly|daily|monthly/i),
      page.locator('[data-testid*="schedule"]'),
    ]
    
    let onScheduleScreen = false
    for (const indicator of scheduleIndicators) {
      const count = await indicator.count()
      if (count > 0) {
        onScheduleScreen = true
        console.log('✓ Confirmed on schedule screen')
        break
      }
    }
    
    // If not found, wait a bit more
    if (!onScheduleScreen) {
      console.log('Schedule screen not immediately found, waiting longer...')
      await page.waitForTimeout(3000)
      for (const indicator of scheduleIndicators) {
        const count = await indicator.count()
        if (count > 0) {
          onScheduleScreen = true
          console.log('✓ Confirmed on schedule screen (after wait)')
          break
        }
      }
    }
    
    expect(onScheduleScreen).toBe(true)
    
    // AND: When I navigate away without creating a schedule
    console.log('Navigating away from schedule screen...')
    
    // Monitor network requests to see if alert is created
    const alertCreationPromise = page.waitForResponse(
      (response) => response.url().includes('/alerts') && response.request().method() === 'POST',
      { timeout: 15000 }
    ).catch(() => null)
    
    const alertTabButton = page.locator('[data-testid="tab-alert"], [aria-label*="Alert"]').first()
    await alertTabButton.click()
    
    // Wait for alert screen to load
    await page.waitForTimeout(2000)
    
    // Check if alert creation request was made
    const alertResponse = await alertCreationPromise
    if (alertResponse) {
      console.log('✓ Alert creation request detected!')
      const responseBody = await alertResponse.json().catch(() => null)
      if (responseBody) {
        console.log(`Alert creation response: ${JSON.stringify(responseBody).substring(0, 200)}`)
      }
    } else {
      console.log('⚠ No alert creation request detected - alert might not have been created')
    }
    
    // THEN: An alert should be created for the patient with no schedule
    console.log('Checking for alert creation...')
    
    // Wait for the alert to be created (it happens asynchronously in a setTimeout)
    await page.waitForTimeout(5000)
    
    // Trigger a refresh of alerts by clicking the refresh button if it exists
    const refreshButton = page.getByText(/refresh/i).first()
    const refreshCount = await refreshButton.count()
    if (refreshCount > 0) {
      await refreshButton.click()
      console.log('✓ Clicked refresh button')
      await page.waitForTimeout(3000)
    } else {
      // Reload the page to ensure we get the latest alerts from the backend
      await page.reload()
      await page.waitForTimeout(5000) // Wait for alerts to load after reload
    }
    
    // Look for the alert about missing schedule with multiple strategies
    const alertMessage = `Patient ${patientName} has no schedule configured`
    let alertFound = false
    
    // Strategy 1: Look for exact message
    const exactMessage = page.getByText(alertMessage, { exact: false })
    const exactCount = await exactMessage.count()
    if (exactCount > 0) {
      alertFound = true
      console.log('✓ Alert found with exact message!')
      const alertText = await exactMessage.first().textContent()
      console.log(`Alert text: ${alertText}`)
    }
    
    // Strategy 2: Look for partial message
    if (!alertFound) {
      const partialMessage = page.getByText(/no schedule configured/i)
      const partialCount = await partialMessage.count()
      if (partialCount > 0) {
        alertFound = true
        console.log('✓ Alert found with partial message!')
        const alertText = await partialMessage.first().textContent()
        console.log(`Alert text: ${alertText}`)
      }
    }
    
    // Strategy 3: Look for patient name in alerts
    if (!alertFound) {
      const patientNameAlert = page.getByText(new RegExp(patientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
      const nameCount = await patientNameAlert.count()
      if (nameCount > 0) {
        // Check if it's related to schedule
        const alertText = await patientNameAlert.first().textContent()
        if (alertText && /schedule/i.test(alertText)) {
          alertFound = true
          console.log('✓ Alert found with patient name!')
          console.log(`Alert text: ${alertText}`)
        }
      }
    }
    
    // Strategy 4: Check all alert elements
    if (!alertFound) {
      const allAlerts = page.locator('[data-testid^="alert-"], [class*="alert"], [class*="Alert"]')
      const alertCount = await allAlerts.count()
      console.log(`Total alert elements found: ${alertCount}`)
      
      for (let i = 0; i < Math.min(alertCount, 20); i++) {
        try {
          const alertText = await allAlerts.nth(i).textContent()
          if (alertText && (/schedule/i.test(alertText) || alertText.includes(patientName))) {
            alertFound = true
            console.log(`✓ Alert found at index ${i}!`)
            console.log(`Alert text: ${alertText}`)
            break
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    // If still not found, wait even longer and reload again
    if (!alertFound) {
      console.log('Alert not found, waiting longer and reloading...')
      await page.waitForTimeout(10000)
      await page.reload()
      await page.waitForTimeout(5000)
      
      // Final check
      const finalCheck = page.getByText(/no schedule configured/i)
      const finalCount = await finalCheck.count()
      if (finalCount > 0) {
        alertFound = true
        console.log('✓ Alert found after final reload!')
      } else {
        // Debug: List all visible text on the page
        const pageText = await page.textContent('body')
        console.log(`Page text contains "schedule": ${pageText?.includes('schedule') || pageText?.includes('Schedule')}`)
        console.log(`Page text contains patient name: ${pageText?.includes(patientName)}`)
      }
    }
    
    expect(alertFound).toBe(true)
    
    console.log('✓ Test completed successfully')
  })
})
