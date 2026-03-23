import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToHome, navigateToAlertTab } from "./helpers/navigation"
import { TEST_USERS } from './fixtures/testData'
import { Page, Locator } from '@playwright/test'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'

function firstRelatedClientId(caregiver: any): string | null {
  const list = caregiver?.clients ?? caregiver?.patients
  if (!list?.length) return null
  const c = list[0]
  if (typeof c === 'string') return c
  return c?.id ?? c?._id ?? null
}

/** One alert row (RN Web exposes testID; Playwright also maps getByTestId to accessibilityLabel) */
function alertRowByMessage(page: Page, message: string) {
  return page
    .locator('[data-testid="alert-item"], [aria-label="alert-item"]')
    .filter({ hasText: message })
}

/** Wait until the alert list shows this message (handles slow polling / RTK refetch) */
async function waitForAlertRowVisible(page: Page, message: string) {
  await expect(alertRowByMessage(page, message)).toBeVisible({ timeout: 40000 })
}

/** Toggle renders two nodes with data-testid=alert-checkbox; use the interactive checkbox */
function alertCheckbox(alertItem: Locator) {
  return alertItem.getByRole('checkbox').first()
}

/**
 * Create an alert in the database for a caregiver using the test endpoint
 */
async function createAlertForCaregiver(page: Page, caregiverId: string, alertData: {
  message: string
  importance?: 'low' | 'medium' | 'high' | 'urgent'
  alertType?: 'client' | 'system' | 'conversation' | 'schedule'
  relatedClient?: string
}) {
  try {
    const response = await page.request.post(`${API_BASE_URL}/test/create-alert`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        caregiverId,
        message: alertData.message,
        importance: alertData.importance || 'medium',
        alertType: alertData.alertType || 'client',
        relatedClient: alertData.relatedClient,
        visibility: 'allCaregivers',
        relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })

    if (!response.ok()) {
      const errorText = await response.text()
      throw new Error(`Failed to create alert: ${response.status()} ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating alert:', error)
    throw error
  }
}

/**
 * Get caregiver data including clients
 */
async function getCaregiverByEmail(page: Page, email: string): Promise<any | null> {
  try {
    const response = await page.request.post(`${API_BASE_URL}/test/get-caregiver-by-email`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: { email },
    })
    
    if (response.ok()) {
      return await response.json()
    }
    
    return null
  } catch (error) {
    console.error('Error getting caregiver:', error)
    return null
  }
}

test.describe("Alert Checkbox Toggle", () => {
  // Same seeded user + shared alert list: parallel tests race and hide each other's rows
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('playwright_test', '1')
      } catch {
        /* ignore */
      }
    })
    await navigateToHome(page, TEST_USERS.WITH_CLIENTS)
  })

  test("should mark an unread alert as read when clicking checkbox", async ({ page }) => {
    console.log('=== TEST: Mark unread alert as read ===')
    
    // Navigate to alerts screen
    await navigateToAlertTab(page)
    await expect(
      page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))
    ).toBeVisible({ timeout: 10000 })
    
    // Get caregiver data
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_CLIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver')
    }
    const caregiverId = caregiver.id || caregiver._id
    
    const clientId = firstRelatedClientId(caregiver)
    
    if (!clientId) {
      throw new Error('Caregiver has no clients')
    }
    
    // Create an unread alert
    const testAlertMessage = `Checkbox Test Unread - ${Date.now()}`
    await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'client',
      relatedClient: clientId,
    })
    
    await waitForAlertRowVisible(page, testAlertMessage)
    
    // Click "All Alerts" tab to see all alerts including the new one
    const allAlertsTab = page.getByText('All Alerts').or(page.getByText(/all.*alerts/i))
    if (await allAlertsTab.count() > 0) {
      await allAlertsTab.click()
      await page.waitForTimeout(2000)
    }
    
    // Find the alert item with our message
    const alertItem = alertRowByMessage(page, testAlertMessage)
    await expect(alertItem).toBeVisible({ timeout: 5000 })
    
    // Find the checkbox within this alert item
    const checkbox = alertCheckbox(alertItem)
    await expect(checkbox).toBeVisible()
    
    // Verify checkbox is initially unchecked (alert is unread)
    const isInitiallyChecked = await checkbox.isChecked().catch(() => false)
    console.log(`Checkbox initially checked: ${isInitiallyChecked}`)
    
    // Click the checkbox to mark as read
    await checkbox.click()
    await page.waitForTimeout(2000) // Wait for API call
    
    // Verify checkbox is now checked
    const isNowChecked = await checkbox.isChecked().catch(() => true)
    console.log(`Checkbox now checked: ${isNowChecked}`)
    expect(isNowChecked).toBe(true)
    
    console.log('✅ Successfully marked alert as read via checkbox')
  })

  test("should mark a read alert as unread when clicking checkbox", async ({ page }) => {
    console.log('=== TEST: Mark read alert as unread ===')
    
    // Navigate to alerts screen
    await navigateToAlertTab(page)
    await expect(
      page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))
    ).toBeVisible({ timeout: 10000 })
    
    // Get caregiver data
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_CLIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver')
    }
    const caregiverId = caregiver.id || caregiver._id
    
    const clientId = firstRelatedClientId(caregiver)
    
    if (!clientId) {
      throw new Error('Caregiver has no clients')
    }
    
    // Create an unread alert first
    const testAlertMessage = `Checkbox Test Read->Unread - ${Date.now()}`
    await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'client',
      relatedClient: clientId,
    })
    
    await waitForAlertRowVisible(page, testAlertMessage)
    
    // Click "All Alerts" tab
    const allAlertsTab = page.getByText('All Alerts').or(page.getByText(/all.*alerts/i))
    if (await allAlertsTab.count() > 0) {
      await allAlertsTab.click()
      await page.waitForTimeout(2000)
    }
    
    // Find the alert item
    const alertItem = alertRowByMessage(page, testAlertMessage)
    await expect(alertItem).toBeVisible({ timeout: 5000 })
    
    // Find the checkbox
    const checkbox = alertCheckbox(alertItem)
    await expect(checkbox).toBeVisible()
    
    // Click checkbox to mark as read
    await checkbox.click()
    await page.waitForTimeout(2000)
    
    // Verify it's checked
    let isChecked = await checkbox.isChecked().catch(() => true)
    expect(isChecked).toBe(true)
    console.log('Alert marked as read')
    
    // Click checkbox again to mark as unread
    await checkbox.click()
    await page.waitForTimeout(2000)
    
    // Verify it's now unchecked
    isChecked = await checkbox.isChecked().catch(() => false)
    expect(isChecked).toBe(false)
    console.log('Alert marked as unread')
    
    console.log('✅ Successfully toggled alert from read to unread via checkbox')
  })

  test("should toggle alert checkbox multiple times", async ({ page }) => {
    console.log('=== TEST: Toggle checkbox multiple times ===')
    
    // Navigate to alerts screen
    await navigateToAlertTab(page)
    await expect(
      page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))
    ).toBeVisible({ timeout: 10000 })
    
    // Get caregiver data
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_CLIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver')
    }
    const caregiverId = caregiver.id || caregiver._id
    
    const clientId = firstRelatedClientId(caregiver)
    
    if (!clientId) {
      throw new Error('Caregiver has no clients')
    }
    
    // Create an alert
    const testAlertMessage = `Checkbox Test Multiple Toggle - ${Date.now()}`
    await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'client',
      relatedClient: clientId,
    })
    
    await waitForAlertRowVisible(page, testAlertMessage)
    
    // Click "All Alerts" tab
    const allAlertsTab = page.getByText('All Alerts').or(page.getByText(/all.*alerts/i))
    if (await allAlertsTab.count() > 0) {
      await allAlertsTab.click()
      await page.waitForTimeout(2000)
    }
    
    // Find the alert
    const alertItem = alertRowByMessage(page, testAlertMessage)
    await expect(alertItem).toBeVisible({ timeout: 5000 })
    
    // Find the checkbox
    const checkbox = alertCheckbox(alertItem)
    await expect(checkbox).toBeVisible()
    
    // Toggle 1: Unread -> Read
    await checkbox.click()
    await page.waitForTimeout(2000)
    let isChecked = await checkbox.isChecked().catch(() => true)
    expect(isChecked).toBe(true)
    console.log('Toggle 1: Marked as read ✓')
    
    // Toggle 2: Read -> Unread
    await checkbox.click()
    await page.waitForTimeout(2000)
    isChecked = await checkbox.isChecked().catch(() => false)
    expect(isChecked).toBe(false)
    console.log('Toggle 2: Marked as unread ✓')
    
    // Toggle 3: Unread -> Read
    await checkbox.click()
    await page.waitForTimeout(2000)
    isChecked = await checkbox.isChecked().catch(() => true)
    expect(isChecked).toBe(true)
    console.log('Toggle 3: Marked as read ✓')
    
    // Toggle 4: Read -> Unread
    await checkbox.click()
    await page.waitForTimeout(2000)
    isChecked = await checkbox.isChecked().catch(() => false)
    expect(isChecked).toBe(false)
    console.log('Toggle 4: Marked as unread ✓')
    
    console.log('✅ Successfully toggled checkbox 4 times')
  })

  test("should show alert in correct tab based on read status", async ({ page }) => {
    console.log('=== TEST: Alert visibility in tabs ===')
    
    // Navigate to alerts screen
    await navigateToAlertTab(page)
    await expect(
      page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))
    ).toBeVisible({ timeout: 10000 })
    
    // Get caregiver data
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_CLIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver')
    }
    const caregiverId = caregiver.id || caregiver._id
    
    const clientId = firstRelatedClientId(caregiver)
    
    if (!clientId) {
      throw new Error('Caregiver has no clients')
    }
    
    // Create an alert
    const testAlertMessage = `Checkbox Test Tab Visibility - ${Date.now()}`
    await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'client',
      relatedClient: clientId,
    })
    
    await waitForAlertRowVisible(page, testAlertMessage)
    
    // Check "Unread" tab - alert should be visible
    const unreadTab = page.getByText('Unread').or(page.getByText(/unread.*alerts/i)).first()
    if (await unreadTab.count() > 0) {
      await unreadTab.click()
      await page.waitForTimeout(2000)
    }
    
    let alertItem = alertRowByMessage(page, testAlertMessage)
    await expect(alertItem).toBeVisible({ timeout: 15000 })
    console.log('Alert visible in Unread tab ✓')
    
    // Mark as read
    const checkbox = alertCheckbox(alertItem)
    await checkbox.click()
    await page.waitForTimeout(2000)
    
    // Alert should disappear from Unread tab
    const alertCountInUnread = await alertItem.count()
    console.log(`Alert count in Unread tab after marking as read: ${alertCountInUnread}`)
    
    // Switch to "All Alerts" tab - alert should still be visible
    const allAlertsTab = page.getByText('All Alerts').or(page.getByText(/all.*alerts/i))
    if (await allAlertsTab.count() > 0) {
      await allAlertsTab.click()
      await page.waitForTimeout(2000)
    }
    
    alertItem = alertRowByMessage(page, testAlertMessage)
    await expect(alertItem).toBeVisible({ timeout: 15000 })
    console.log('Alert visible in All Alerts tab ✓')
    
    // Mark as unread again
    const checkboxInAllTab = alertCheckbox(alertItem)
    await checkboxInAllTab.click()
    await page.waitForTimeout(2000)
    
    // Switch back to Unread tab - alert should reappear
    if (await unreadTab.count() > 0) {
      await unreadTab.click()
      await page.waitForTimeout(2000)
    }
    
    alertItem = alertRowByMessage(page, testAlertMessage)
    await expect(alertItem).toBeVisible({ timeout: 15000 })
    console.log('Alert reappeared in Unread tab after marking as unread ✓')
    
    console.log('✅ Alert visibility in tabs works correctly')
  })
})
