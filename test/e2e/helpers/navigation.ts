import { Page, expect } from "@playwright/test"
import { loginUserViaUI } from "./testHelpers"
import { TEST_USERS } from "../fixtures/testData"

export async function navigateToRegister(page: Page) {
  await page.goto("/")
  // Wait for login screen to load - use aria-label for React Native Web
  await page.waitForSelector('[aria-label="email-input"]', { timeout: 30000 })
  await page.waitForTimeout(1000) // Small delay to ensure form is ready
  
  // Click register button - use aria-label
  const registerButton = page.locator('[aria-label="register-link"], [aria-label="register-button"]')
  await registerButton.waitFor({ state: 'visible', timeout: 15000 })
  await registerButton.click()
  
  // Wait for register screen - use aria-label
  await page.waitForSelector('[aria-label="register-name"]', { timeout: 15000 })
}

export async function navigateToHome(page: Page, user?: { email: string; password: string }) {
  await page.goto("/")
  const testUser = user || TEST_USERS.WITHOUT_PATIENTS;
  await loginUserViaUI(page, testUser.email, testUser.password);
  await isHomeScreen(page)
}

export async function isLoginScreen(page: Page) {
  await expect(page.locator('[aria-label="login-button"]')).toBeVisible()
}

export async function isHomeScreen(page: Page) {
  console.log("Checking if on Home Screen...")

  // Wait for the home screen to load by looking for the "Add Patient" button
  await expect(page.getByText("Add Patient", { exact: true })).toBeVisible({ timeout: 10000 })

  console.log("Confirmed on Home Screen.")
}

export async function isPatientScreen(page: Page) {
  console.log("Checking if on Patient Screen...")
  // Look for either CREATE PATIENT or UPDATE PATIENT button which is specific to the patient screen
  try {
    await expect(page.getByText("CREATE PATIENT")).toBeVisible({ timeout: 5000 })
    console.log("Confirmed on Patient Screen (Create mode).")
  } catch {
    await expect(page.getByText("UPDATE PATIENT")).toBeVisible({ timeout: 5000 })
    console.log("Confirmed on Patient Screen (Update mode).")
  }
}

export async function isNotAuthorizedScreen(page: Page) {
  console.log("Checking if on Not Authorized Screen...")
  await expect(page.getByText("Not Authorized", { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText("You don't have permission to view caregivers")).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Not Authorized Screen.")
}

export async function isCaregiversScreen(page: Page) {
  console.log("Checking if on Caregivers Screen...")
  // Look for either the caregivers list or the not authorized message
  try {
    await expect(page.getByText("Add Caregiver", { exact: true })).toBeVisible({ timeout: 5000 })
    console.log("Confirmed on Caregivers Screen (authorized).")
  } catch {
    await isNotAuthorizedScreen(page)
    console.log("Confirmed on Caregivers Screen (not authorized).")
  }
}

export async function navigateToSchedules(page: Page) {
  console.log("Navigating to Schedules...")
  // IMPORTANT: Schedules can only be accessed through the patient screen
  // First, ensure we're on the home screen
  await isHomeScreen(page)
  
  // Find a patient card to navigate to patient screen
  const patientCard = page.locator('[data-testid^="patient-card-"], [aria-label^="patient-card-"], [data-testid^="edit-patient-button-"]')
  const patientCardCount = await patientCard.count()
  
  if (patientCardCount === 0) {
    throw new Error('Cannot navigate to schedules: No patients found. Schedules can only be accessed through an existing patient.')
  }
  
  // Click on a patient to navigate to patient screen
  // Prefer edit button if available (for existing patients)
  const editButton = page.locator('[data-testid^="edit-patient-button-"]').first()
  const editButtonCount = await editButton.count()
  
  if (editButtonCount > 0) {
    await editButton.click({ timeout: 10000 })
  } else {
    // Fallback: click patient card
    await patientCard.first().click({ timeout: 10000 })
  }
  
  // Wait for patient screen to load
  await isPatientScreen(page)
  await page.waitForTimeout(1000) // Give time for form to populate
  
  // Now look for the "Manage Schedules" button on the patient screen
  // This button only appears for existing patients (not new patient mode)
  const manageSchedulesButton = page.locator('[data-testid="manage-schedules-button"], [aria-label*="manage-schedules"]')
  const buttonCount = await manageSchedulesButton.count({ timeout: 5000 })
  
  if (buttonCount === 0) {
    // Check if we're in new patient mode
    const isNewPatient = await page.getByText(/CREATE PATIENT/i).count() > 0
    if (isNewPatient) {
      throw new Error('Cannot navigate to schedules: Currently in new patient mode. Schedules can only be accessed for existing patients.')
    }
    throw new Error('BUG: Manage schedules button not found on patient screen!')
  }
  
  // Click the manage schedules button
  await manageSchedulesButton.first().waitFor({ state: 'visible', timeout: 5000 })
  await manageSchedulesButton.first().click({ timeout: 10000 })
  await page.waitForTimeout(1000)
  
  // Verify we're on the schedule screen
  const scheduleScreen = page.locator('[data-testid="schedules-screen"], [aria-label*="schedules-screen"], [aria-label*="schedule-screen"]')
  await expect(scheduleScreen).toBeVisible({ timeout: 10000 })
  console.log("Successfully navigated to Schedules via Patient screen")
}

export async function isSchedulesScreen(page: Page) {
  console.log("Checking if on Schedules Screen...")
  // Use accessibilityLabel for React Native Web
  await expect(page.locator('[data-testid="schedules-screen"], [aria-label="schedules-screen"]')).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Schedules Screen.")
}

export async function navigateToOrgTab(page: Page) {
  console.log("Navigating to Organization tab...")
  // Use flexible selector - try both testID and aria-label
  const orgTab = page.locator('[data-testid="tab-org"], [aria-label="Organization tab"]').first()
  await orgTab.waitFor({ timeout: 10000, state: 'visible' })
  await orgTab.click()
  await page.waitForTimeout(1000) // Wait for tab to activate
  console.log("Successfully clicked Organization tab")
}

export async function navigateToOrgScreen(page: Page) {
  console.log("Navigating to Organization screen...")
  await navigateToOrgTab(page)
  // Wait for org screen to load
  await page.waitForSelector('[data-testid="org-screen"], [aria-label="org-screen"]', { timeout: 10000 })
  await page.waitForTimeout(1000) // Wait for screen to fully render
  console.log("Successfully navigated to Organization screen")
}

export async function navigateToPaymentScreen(page: Page) {
  console.log("Navigating to Payment screen...")
  await navigateToOrgScreen(page)
  
  // Click payment button
  const paymentButton = page.locator('[data-testid="payment-button"]').first()
  await paymentButton.waitFor({ timeout: 5000, state: 'visible' })
  await paymentButton.click()
  await page.waitForTimeout(2000) // Wait for payment screen to load
  
  // Verify we're on payment screen
  await page.waitForSelector('[data-testid="payment-info-container"]', { timeout: 10000 })
  console.log("Successfully navigated to Payment screen")
}

export async function navigateToPaymentMethods(page: Page) {
  console.log("Navigating to Payment Methods...")
  await navigateToPaymentScreen(page)
  
  // Click payment methods tab
  const paymentMethodsTab = page.locator('[data-testid="payment-methods-tab"]').first()
  await paymentMethodsTab.waitFor({ timeout: 5000, state: 'visible' })
  await paymentMethodsTab.click()
  await page.waitForTimeout(1000) // Wait for tab to activate
  
  // Verify we're on payment methods - check for Stripe container or payment methods elements
  // The container might not have a testID, so check for Stripe elements or payment form
  const stripeContainer = page.locator('[aria-label="stripe-web-payment-container"], [data-testid="payment-methods-container"]')
  await stripeContainer.waitFor({ timeout: 10000, state: 'visible' }).catch(async () => {
    // Fallback: check for payment form or existing methods
    await page.waitForSelector('[aria-label="add-payment-form"], [aria-label="existing-payment-methods"]', { timeout: 10000 })
  })
  console.log("Successfully navigated to Payment Methods")
}

export async function isOrgScreen(page: Page) {
  console.log("Checking if on Organization Screen...")
  await expect(page.locator('[data-testid="org-screen"], [aria-label="org-screen"]')).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Organization Screen.")
}

export async function isPaymentScreen(page: Page) {
  console.log("Checking if on Payment Screen...")
  await expect(page.locator('[data-testid="payment-info-container"]')).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Payment Screen.")
}

export async function navigateToTab(page: Page, tabName: 'home' | 'org' | 'alert' | 'reports' | 'payment') {
  console.log(`Navigating to ${tabName} tab...`)
  const tabSelectors = {
    home: '[data-testid="tab-home"], [aria-label="Home tab"]',
    org: '[data-testid="tab-org"], [aria-label="Organization tab"]',
    alert: '[data-testid="tab-alert"], [aria-label="Alerts tab"]',
    reports: '[data-testid="tab-reports"], [aria-label="Reports tab"]',
    payment: '[data-testid="tab-payment"], [aria-label="Payment tab"]'
  }
  
  const tab = page.locator(tabSelectors[tabName]).first()
  await tab.waitFor({ timeout: 10000, state: 'visible' })
  await tab.click()
  await page.waitForTimeout(1000) // Wait for tab to activate
  console.log(`Successfully clicked ${tabName} tab`)
}

export async function navigateToHomeTab(page: Page) {
  await navigateToTab(page, 'home')
  await isHomeScreen(page)
}

export async function navigateToAlertTab(page: Page) {
  await navigateToTab(page, 'alert')
  // Wait for alert screen to load
  await page.waitForSelector('[data-testid="alert-screen"], [aria-label="alert-screen"]', { timeout: 10000 })
  await page.waitForTimeout(1000)
  console.log("Successfully navigated to Alerts screen")
}

export async function navigateToReportsTab(page: Page) {
  await navigateToTab(page, 'reports')
  // Wait for reports screen to load
  await page.waitForSelector('[data-testid="reports-screen"], [aria-label="reports-screen"]', { timeout: 10000 })
  await page.waitForTimeout(1000)
  console.log("Successfully navigated to Reports screen")
}

export async function navigateToPatientScreen(page: Page, patientName?: string) {
  console.log("Navigating to Patient screen...")
  await isHomeScreen(page)
  
  if (patientName) {
    // Find specific patient by name
    const patientCard = page.locator('[data-testid^="patient-card-"], [data-testid^="edit-patient-button-"]').filter({ hasText: patientName })
    const count = await patientCard.count()
    if (count > 0) {
      await patientCard.first().click({ timeout: 10000 })
    } else {
      throw new Error(`Patient "${patientName}" not found`)
    }
  } else {
    // Click first available patient
    const editButton = page.locator('[data-testid^="edit-patient-button-"]').first()
    const editButtonCount = await editButton.count()
    
    if (editButtonCount > 0) {
      await editButton.click({ timeout: 10000 })
    } else {
      const patientCard = page.locator('[data-testid^="patient-card-"]').first()
      const patientCount = await patientCard.count()
      if (patientCount === 0) {
        throw new Error('No patients found - cannot navigate to patient screen')
      }
      await patientCard.first().click({ timeout: 10000 })
    }
  }
  
  await isPatientScreen(page)
  await page.waitForTimeout(1000) // Give time for form to populate
  console.log("Successfully navigated to Patient screen")
}

export async function navigateToCaregiversScreen(page: Page) {
  console.log("Navigating to Caregivers screen...")
  await navigateToOrgScreen(page)
  
  // Try multiple ways to navigate to caregivers
  const caregiverButton = page.locator('[data-testid="view-caregivers-button"]').first()
  const buttonCount = await caregiverButton.count()
  
  if (buttonCount > 0) {
    await caregiverButton.scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(1000)
    await caregiverButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await caregiverButton.click({ timeout: 5000 }).catch(() => {
      // Try force click if regular click fails
      caregiverButton.click({ force: true, timeout: 3000 })
    })
    await page.waitForTimeout(2000)
  } else {
    // Fallback: try clicking "Caregivers" text
    const caregiversText = page.getByText(/caregivers/i).first()
    const textCount = await caregiversText.count()
    if (textCount > 0) {
      await caregiversText.click({ timeout: 5000 })
      await page.waitForTimeout(2000)
    }
  }
  
  await isCaregiversScreen(page)
  console.log("Successfully navigated to Caregivers screen")
}

export async function isAlertScreen(page: Page) {
  console.log("Checking if on Alert Screen...")
  await expect(page.locator('[data-testid="alert-screen"], [aria-label="alert-screen"]')).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Alert Screen.")
}

export async function isReportsScreen(page: Page) {
  console.log("Checking if on Reports Screen...")
  await expect(page.locator('[data-testid="reports-screen"], [aria-label="reports-screen"]')).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Reports Screen.")
}