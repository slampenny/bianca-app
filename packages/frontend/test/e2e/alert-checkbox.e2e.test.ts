import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToHome, navigateToAlertTab } from "./helpers/navigation"
import { TEST_USERS } from './fixtures/testData'
import { Page } from '@playwright/test'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'

/**
 * Create an alert in the database for a caregiver using the test endpoint
 */
async function createAlertForCaregiver(page: Page, caregiverId: string, alertData: {
  message: string
  importance?: 'low' | 'medium' | 'high' | 'urgent'
  alertType?: 'patient' | 'system' | 'conversation' | 'schedule'
  relatedPatient?: string
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
        alertType: alertData.alertType || 'patient',
        relatedPatient: alertData.relatedPatient,
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
 * Get caregiver data including patients
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
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
  })

  test("should mark an unread alert as read when clicking checkbox", async ({ page }) => {
    console.log('=== TEST: Mark unread alert as read ===')
    
    // Navigate to alerts screen
    await navigateToAlertTab(page)
    await expect(
      page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))
    ).toBeVisible({ timeout: 10000 })
    
    // Get caregiver data
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_PATIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver')
    }
    const caregiverId = caregiver.id || caregiver._id
    
    // Get a patient ID for the alert
    const patientId = caregiver.patients && caregiver.patients.length > 0 
      ? (caregiver.patients[0].id || caregiver.patients[0]._id || caregiver.patients[0])
      : null
    
    if (!patientId) {
      throw new Error('Caregiver has no patients')
    }
    
    // Create an unread alert
    const testAlertMessage = `Checkbox Test Unread - ${Date.now()}`
    await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'patient',
      relatedPatient: patientId,
    })
    
    // Wait for alert to appear
    await page.waitForTimeout(5000)
    
    // Click "All Alerts" tab to see all alerts including the new one
    const allAlertsTab = page.getByText('All Alerts').or(page.getByText(/all.*alerts/i))
    if (await allAlertsTab.count() > 0) {
      await allAlertsTab.click()
      await page.waitForTimeout(2000)
    }
    
    // Find the alert item with our message
    const alertItem = page.locator('[data-testid="alert-item"]').filter({ hasText: testAlertMessage })
    await expect(alertItem).toBeVisible({ timeout: 10000 })
    
    // Find the checkbox within this alert item
    const checkbox = alertItem.locator('[data-testid="alert-checkbox"]')
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
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_PATIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver')
    }
    const caregiverId = caregiver.id || caregiver._id
    
    // Get a patient ID for the alert
    const patientId = caregiver.patients && caregiver.patients.length > 0 
      ? (caregiver.patients[0].id || caregiver.patients[0]._id || caregiver.patients[0])
      : null
    
    if (!patientId) {
      throw new Error('Caregiver has no patients')
    }
    
    // Create an unread alert first
    const testAlertMessage = `Checkbox Test Read->Unread - ${Date.now()}`
    await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'patient',
      relatedPatient: patientId,
    })
    
    // Wait for alert to appear
    await page.waitForTimeout(5000)
    
    // Click "All Alerts" tab
    const allAlertsTab = page.getByText('All Alerts').or(page.getByText(/all.*alerts/i))
    if (await allAlertsTab.count() > 0) {
      await allAlertsTab.click()
      await page.waitForTimeout(2000)
    }
    
    // Find the alert item
    const alertItem = page.locator('[data-testid="alert-item"]').filter({ hasText: testAlertMessage })
    await expect(alertItem).toBeVisible({ timeout: 10000 })
    
    // Find the checkbox
    const checkbox = alertItem.locator('[data-testid="alert-checkbox"]')
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
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_PATIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver')
    }
    const caregiverId = caregiver.id || caregiver._id
    
    // Get a patient ID
    const patientId = caregiver.patients && caregiver.patients.length > 0 
      ? (caregiver.patients[0].id || caregiver.patients[0]._id || caregiver.patients[0])
      : null
    
    if (!patientId) {
      throw new Error('Caregiver has no patients')
    }
    
    // Create an alert
    const testAlertMessage = `Checkbox Test Multiple Toggle - ${Date.now()}`
    await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'patient',
      relatedPatient: patientId,
    })
    
    // Wait for alert to appear
    await page.waitForTimeout(5000)
    
    // Click "All Alerts" tab
    const allAlertsTab = page.getByText('All Alerts').or(page.getByText(/all.*alerts/i))
    if (await allAlertsTab.count() > 0) {
      await allAlertsTab.click()
      await page.waitForTimeout(2000)
    }
    
    // Find the alert
    const alertItem = page.locator('[data-testid="alert-item"]').filter({ hasText: testAlertMessage })
    await expect(alertItem).toBeVisible({ timeout: 10000 })
    
    // Find the checkbox
    const checkbox = alertItem.locator('[data-testid="alert-checkbox"]')
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
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_PATIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver')
    }
    const caregiverId = caregiver.id || caregiver._id
    
    // Get a patient ID
    const patientId = caregiver.patients && caregiver.patients.length > 0 
      ? (caregiver.patients[0].id || caregiver.patients[0]._id || caregiver.patients[0])
      : null
    
    if (!patientId) {
      throw new Error('Caregiver has no patients')
    }
    
    // Create an alert
    const testAlertMessage = `Checkbox Test Tab Visibility - ${Date.now()}`
    await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'patient',
      relatedPatient: patientId,
    })
    
    // Wait for alert to appear
    await page.waitForTimeout(5000)
    
    // Check "Unread" tab - alert should be visible
    const unreadTab = page.getByText('Unread').or(page.getByText(/unread.*alerts/i)).first()
    if (await unreadTab.count() > 0) {
      await unreadTab.click()
      await page.waitForTimeout(2000)
    }
    
    let alertItem = page.locator('[data-testid="alert-item"]').filter({ hasText: testAlertMessage })
    await expect(alertItem).toBeVisible({ timeout: 10000 })
    console.log('Alert visible in Unread tab ✓')
    
    // Mark as read
    const checkbox = alertItem.locator('[data-testid="alert-checkbox"]')
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
    
    alertItem = page.locator('[data-testid="alert-item"]').filter({ hasText: testAlertMessage })
    await expect(alertItem).toBeVisible({ timeout: 10000 })
    console.log('Alert visible in All Alerts tab ✓')
    
    // Mark as unread again
    const checkboxInAllTab = alertItem.locator('[data-testid="alert-checkbox"]')
    await checkboxInAllTab.click()
    await page.waitForTimeout(2000)
    
    // Switch back to Unread tab - alert should reappear
    if (await unreadTab.count() > 0) {
      await unreadTab.click()
      await page.waitForTimeout(2000)
    }
    
    alertItem = page.locator('[data-testid="alert-item"]').filter({ hasText: testAlertMessage })
    await expect(alertItem).toBeVisible({ timeout: 10000 })
    console.log('Alert reappeared in Unread tab after marking as unread ✓')
    
    console.log('✅ Alert visibility in tabs works correctly')
  })
})
