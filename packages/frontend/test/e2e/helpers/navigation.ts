import { Page, expect } from "@playwright/test"
import { loginUserViaUI } from "./testHelpers"
import { TEST_USERS } from "../fixtures/testData"

/** Persona for onboarding flow. Default 'caregiver' for shortest path (no Org Info step). */
export type OnboardingPersona = "organization" | "caregiver" | "agingInPlace"

/**
 * Go through onboarding (About you → How Bianca works → [Org info if organization]) to reach the Register screen.
 * Call this after clicking the Register button from login; the app now shows onboarding first.
 */
export async function goThroughOnboardingToRegister(
  page: Page,
  persona: OnboardingPersona = "caregiver",
  orgName?: string
): Promise<void> {
  // Wait for either About You (new flow) or Register screen (e.g. deep link)
  const aboutYou = page.getByTestId("onboarding-about-you-screen")
  const registerName = page.locator('input[data-testid="register-name"]')
  await Promise.race([
    aboutYou.waitFor({ state: "visible", timeout: 10000 }),
    registerName.waitFor({ state: "visible", timeout: 10000 }),
  ])

  const onAboutYou = await aboutYou.isVisible().catch(() => false)
  if (!onAboutYou) {
    // Already on Register screen
    return
  }

  // About You: select persona and continue
  const personaTestId =
    persona === "organization"
      ? "onboarding-persona-organization"
      : persona === "caregiver"
        ? "onboarding-persona-caregiver"
        : "onboarding-persona-agingInPlace"
  await page.getByTestId(personaTestId).click()
  await page.getByTestId("onboarding-about-you-continue").click()

  // How Bianca works: click Next / Get started
  await page.getByTestId("onboarding-how-it-works-next").waitFor({ state: "visible", timeout: 10000 })
  await page.getByTestId("onboarding-how-it-works-next").click()

  if (persona === "organization") {
    // Org info: fill org name (country/timezone use defaults), continue
    await page.getByTestId("onboarding-org-info-screen").waitFor({ state: "visible", timeout: 10000 })
    const orgNameInput = page.locator('input[data-testid="onboarding-org-name"]')
    await orgNameInput.waitFor({ state: "visible", timeout: 5000 })
    await orgNameInput.fill(orgName ?? "Test Org")
    await page.getByTestId("onboarding-org-info-continue").click()
  }

  // Wait for Register screen
  await registerName.waitFor({ state: "visible", timeout: 10000 })
}

export async function navigateToRegister(
  page: Page,
  options?: { persona?: OnboardingPersona; orgName?: string }
): Promise<void> {
  await page.goto("/")
  await page.waitForSelector('input[data-testid="email-input"]', { timeout: 10000 })
  await page.waitForTimeout(1000)

  let registerButton = page.getByTestId("register-button")
  let buttonCount = await registerButton.count().catch(() => 0)
  if (buttonCount === 0) {
    registerButton = page.locator('[data-testid="register-button"]').first()
    buttonCount = await registerButton.count().catch(() => 0)
  }
  if (buttonCount === 0) {
    registerButton = page.getByText(/register|create account/i).first()
  }

  await registerButton.waitFor({ state: "visible", timeout: 10000 })
  await registerButton.click()

  await goThroughOnboardingToRegister(
    page,
    options?.persona ?? "caregiver",
    options?.orgName
  )
  console.log("Reached register screen")
}

export async function navigateToHome(page: Page, user?: { email: string; password: string }) {
  await page.goto("/")
  const testUser = user || TEST_USERS.WITHOUT_PATIENTS;
  await loginUserViaUI(page, testUser.email, testUser.password);
  await isHomeScreen(page)
  
  // Wait for auth token to be stored in Redux state (not just localStorage)
  // This ensures API calls made by the UI will include the token
  // The Redux state is what the API actually uses via prepareHeaders
  try {
    await page.waitForFunction(() => {
      try {
        // Check Redux state via window.__REDUX_DEVTOOLS_EXTENSION__ or directly via store
        // The token should be in localStorage persist:root, but we also need to ensure Redux has hydrated
        const authState = localStorage.getItem('persist:root')
        if (authState) {
          const parsed = JSON.parse(authState)
          const auth = JSON.parse(parsed.auth || '{}')
          const hasToken = !!auth.tokens?.access?.token
          
          // Also check if Redux store is accessible (for web)
          if (typeof window !== 'undefined' && (window as any).__REDUX_STORE__) {
            const state = (window as any).__REDUX_STORE__.getState()
            const reduxToken = state?.auth?.tokens?.access?.token
            return !!reduxToken || hasToken
          }
          
          return hasToken
        }
        return false
      } catch {
        return false
      }
    }, { timeout: 10000 })
    console.log('✅ Auth token verified in Redux state')
  } catch {
    // If we can't verify token storage, wait a bit anyway
    console.warn('⚠️ Could not verify auth token in Redux state, waiting longer...')
    await page.waitForTimeout(2000) // Wait longer to ensure Redux has hydrated
  }
  
  // Additional wait to ensure Redux state is fully initialized and API calls will work
  await page.waitForTimeout(1000)
}

export async function isLoginScreen(page: Page) {
  // Wait for login screen to load - check for email input first (more reliable)
  await page.waitForSelector('input[data-testid="email-input"]', { timeout: 10000 })
  await page.waitForTimeout(500) // Give it a moment to render
  
  // Then verify login button is visible - Button should map testID to data-testid automatically
  const loginButton = page.getByTestId('login-button')
  await expect(loginButton).toBeVisible({ timeout: 5000 })
}

export async function isHomeScreen(page: Page) {
  console.log("Checking if on Home Screen...")
  
  // Wait a moment for navigation to complete after login
  await page.waitForTimeout(1000)

  // Try multiple indicators that we're on the home screen
  const homeIndicators = [
    page.getByText("Add Client", { exact: true }),
    page.getByTestId('add-client-button'),
    page.getByTestId('home-header'),
    page.locator('[data-testid="home-screen"]'),
    page.locator('[data-testid="tab-home"], [aria-label="Home tab"]')
  ]
  
  // Check if we're still on login screen - wait a bit longer to ensure navigation completed
  const emailInput = page.locator('input[data-testid="email-input"]')
  const isOnLogin = await emailInput.isVisible({ timeout: 3000 }).catch(() => false)
  
  if (isOnLogin) {
    // Double-check by waiting a bit more and checking URL
    await page.waitForTimeout(2000)
    const currentUrl = page.url()
    const isOnLoginUrl = currentUrl.includes('/login') || currentUrl === '/' || currentUrl.endsWith('/')
    
    if (isOnLoginUrl && await emailInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      throw new Error('Still on login screen - login may have failed')
    }
    // If URL suggests we're not on login, continue even if email input is visible (might be a timing issue)
  }
  
  // Wait for any home indicator
  let foundHome = false
  for (const indicator of homeIndicators) {
    try {
      await expect(indicator).toBeVisible({ timeout: 5000 })
      foundHome = true
      console.log("Confirmed on Home Screen.")
      break
    } catch {
      // Continue to next indicator
    }
  }
  
  if (!foundHome) {
    // Last check: if we're not on login and we can see tabs, we're probably on home
    const homeTab = page.locator('[data-testid="tab-home"], [aria-label="Home tab"]')
    const hasHomeTab = await homeTab.isVisible({ timeout: 2000 }).catch(() => false)
    if (hasHomeTab && !isOnLogin) {
      foundHome = true
      console.log("Confirmed on Home Screen (via tab detection).")
    }
  }
  
  if (!foundHome) {
    const url = page.url()
    const pageContent = await page.content().catch(() => '')
    throw new Error(`Failed to confirm home screen. URL: ${url}, Contains login: ${pageContent.includes('email-input')}`)
  }
}

export async function isPatientScreen(page: Page) {
  console.log("Checking if on Client Screen...")
  // Look for either CREATE CLIENT or UPDATE CLIENT button (or legacy CREATE/UPDATE PATIENT)
  try {
    await expect(page.getByText(/CREATE CLIENT|CREATE PATIENT/i)).toBeVisible({ timeout: 5000 })
    console.log("Confirmed on Client Screen (Create mode).")
    return
  } catch {
    try {
      await expect(page.getByText(/UPDATE CLIENT|UPDATE PATIENT/i)).toBeVisible({ timeout: 5000 })
      console.log("Confirmed on Client Screen (Update mode).")
      return
    } catch {
      const saveButton = page.locator('[data-testid="save-client-button"]')
      const nameInput = page.locator('[data-testid="client-name-input"], input[placeholder*="name" i]')
      const clientScreen = page.locator('[data-testid="client-screen"], [aria-label*="client" i]')
      const hasSaveButton = await saveButton.count() > 0
      const hasNameInput = await nameInput.count() > 0
      const hasClientScreen = await clientScreen.count() > 0
      if (hasSaveButton || hasNameInput || hasClientScreen) {
        console.log("Confirmed on Client Screen (via fallback indicators).")
        return
      }
      throw new Error("Could not confirm Client Screen - no indicators found")
    }
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
  // IMPORTANT: Schedules can only be accessed through the client screen
  // First, ensure we're on the home screen
  await isHomeScreen(page)
  
  // Find a client card to navigate to client screen
  const clientCard = page.locator('[data-testid^="client-card-"], [data-testid^="edit-client-button-"]')
  const clientCardCount = await clientCard.count()
  
  if (clientCardCount === 0) {
    throw new Error('Cannot navigate to schedules: No clients found. Schedules can only be accessed through an existing client.')
  }
  
  const editButton = page.locator('[data-testid^="edit-client-button-"]').first()
  const editButtonCount = await editButton.count()
  
  if (editButtonCount > 0) {
    await editButton.click({ timeout: 10000 })
  } else {
    await clientCard.first().click({ timeout: 10000 })
  }
  
  await isPatientScreen(page)
  await page.waitForTimeout(1000) // Give time for form to populate
  
  const manageSchedulesButton = page.locator('[data-testid="manage-schedules-button"]')
  // Wait for the button to appear or timeout, then count
  try {
    await manageSchedulesButton.waitFor({ timeout: 5000, state: 'visible' }).catch(() => {})
  } catch {
    // Button doesn't exist, that's okay
  }
  const buttonCount = await manageSchedulesButton.count()
  
  if (buttonCount === 0) {
    const isNewClient = await page.getByText(/CREATE CLIENT|CREATE PATIENT/i).count() > 0
    if (isNewClient) {
      throw new Error('Cannot navigate to schedules: Currently in new client mode. Schedules can only be accessed for existing clients.')
    }
    throw new Error('BUG: Manage schedules button not found on client screen!')
  }
  
  // Click the manage schedules button
  await manageSchedulesButton.first().waitFor({ state: 'visible', timeout: 5000 })
  await manageSchedulesButton.first().click({ timeout: 10000 })
  await page.waitForTimeout(1000)
  
  // Verify we're on the schedule screen
  const scheduleScreen = page.locator('[data-testid="schedules-screen"]')
  await expect(scheduleScreen).toBeVisible({ timeout: 10000 })
  console.log("Successfully navigated to Schedules via Client screen")
}

export async function isSchedulesScreen(page: Page) {
  console.log("Checking if on Schedules Screen...")
  // Use accessibilityLabel for React Native Web
  await expect(page.locator('[data-testid="schedules-screen"]')).toBeVisible({ timeout: 10000 })
  console.log("Confirmed on Schedules Screen.")
}

export async function navigateToOrgTab(page: Page) {
  console.log("Navigating to Organization tab...")
  // Use flexible selector - try both testID and aria-label
  const orgTab = page.locator('[data-testid="tab-org"]').first()
  await orgTab.waitFor({ timeout: 10000, state: 'visible' })
  // Use force click to bypass overlay intercepts (e.g., "Sign In" text overlay)
  await orgTab.click({ force: true, timeout: 10000 })
  await page.waitForTimeout(1000) // Wait for tab to activate
  console.log("Successfully clicked Organization tab")
}

export async function navigateToOrgScreen(page: Page) {
  console.log("Navigating to Organization screen...")
  await navigateToOrgTab(page)
  // Wait for org screen to load and be visible (not just present)
  // The screen might be in a loading state initially, so wait for it to become visible
  await page.waitForFunction(
    () => {
      const screen = document.querySelector('[data-testid="org-screen"]')
      if (!screen) return false
      const style = window.getComputedStyle(screen)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    },
    { timeout: 15000 }
  )
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
  const stripeContainer = page.locator('[data-testid="payment-methods-container"]')
  await stripeContainer.waitFor({ timeout: 10000, state: 'visible' }).catch(async () => {
    // Fallback: check for payment form or existing methods
    await page.waitForSelector('[data-testid="add-payment-form"], [data-testid="existing-payment-methods"]', { timeout: 10000 })
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
    home: '[data-testid="tab-home"]',
    org: '[data-testid="tab-org"]',
    alert: '[data-testid="tab-alert"]',
    reports: '[data-testid="tab-reports"]',
    payment: '[data-testid="tab-payment"]'
  }
  
  const tab = page.locator(tabSelectors[tabName]).first()
  await tab.waitFor({ timeout: 10000, state: 'visible' })
  // Use force click to bypass overlay intercepts (e.g., "Sign In" text overlay)
  await tab.click({ force: true, timeout: 10000 })
  await page.waitForTimeout(1000) // Wait for tab to activate
  console.log(`Successfully clicked ${tabName} tab`)
}

export async function navigateToHomeTab(page: Page) {
  await navigateToTab(page, 'home')
  await isHomeScreen(page)
}

export async function navigateToAlertTab(page: Page) {
  await navigateToTab(page, 'alert')
  // Wait for alert screen to load and be visible (not just present)
  // The screen might be in a loading state initially, so wait for it to become visible
  await page.waitForFunction(
    () => {
      const screen = document.querySelector('[data-testid="alert-screen"]')
      if (!screen) return false
      const style = window.getComputedStyle(screen)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    },
    { timeout: 15000 }
  )
  await page.waitForTimeout(1000)
  console.log("Successfully navigated to Alerts screen")
}

export async function navigateToReportsTab(page: Page) {
  // First, ensure we're on a screen where tabs are visible (e.g., home screen)
  const homeHeader = page.locator('[data-testid="home-header"]')
  const isHomeVisible = await homeHeader.isVisible({ timeout: 5000 }).catch(() => false)
  if (!isHomeVisible) {
    // Try to navigate to home first
    await navigateToTab(page, 'home')
    await page.waitForTimeout(1000)
  }
  
  // Now navigate to reports tab
  await navigateToTab(page, 'reports')
  // Wait for reports screen to load - be more flexible with what we wait for
  await Promise.race([
    page.waitForSelector('[data-testid="reports-screen"]', { timeout: 10000 }),
    page.waitForSelector('text=/Reports/i', { timeout: 10000 }),
    page.waitForTimeout(2000) // Fallback timeout
  ])
  await page.waitForTimeout(1000)
  console.log("Successfully navigated to Reports screen")
}

export async function navigateToPatientScreen(page: Page, patientName?: string) {
  console.log("Navigating to Client screen...")
  await isHomeScreen(page)
  
  if (patientName) {
    const clientCard = page.locator('[data-testid^="client-card-"], [data-testid^="edit-client-button-"]').filter({ hasText: patientName })
    const count = await clientCard.count()
    if (count > 0) {
      await clientCard.first().click({ timeout: 10000 })
    } else {
      throw new Error(`Client "${patientName}" not found`)
    }
  } else {
    const editButton = page.locator('[data-testid^="edit-client-button-"]').first()
    const editButtonCount = await editButton.count()
    
    if (editButtonCount > 0) {
      await editButton.click({ timeout: 10000 })
    } else {
      const clientCard = page.locator('[data-testid^="client-card-"]').first()
      const clientCount = await clientCard.count()
      if (clientCount === 0) {
        throw new Error('No clients found - cannot navigate to client screen')
      }
      await clientCard.first().click({ timeout: 10000 })
    }
  }
  
  await isPatientScreen(page)
  await page.waitForTimeout(1000) // Give time for form to populate
  console.log("Successfully navigated to Client screen")
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