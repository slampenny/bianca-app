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
    // Use the test endpoint to create alert (bypasses auth in test mode)
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
        visibility: 'assignedCaregivers',
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
 * Get caregiver ID from the test user email
 */
async function getCaregiverIdByEmail(page: Page, email: string): Promise<string | null> {
  try {
    // Use test endpoint to get caregiver by email
    const response = await page.request.post(`${API_BASE_URL}/test/get-caregiver-by-email`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: { email },
    })
    
    if (response.ok()) {
      const userData = await response.json()
      return userData.id || userData._id || null
    }
    
    return null
  } catch (error) {
    console.error('Error getting caregiver ID:', error)
    return null
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

test.describe("Alert Polling", () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage flag for test mode to enable faster polling
    await page.addInitScript(() => {
      localStorage.setItem('playwright_test', '1');
    });
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
  })

  test("should automatically poll and display new alerts without refresh", async ({ page }) => {
    console.log('=== ALERT POLLING TEST ===')
    
    // GIVEN: I'm logged in and on the alerts screen
    await navigateToAlertTab(page)
    
    // Wait for alert screen to load
    await expect(
      page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))
    ).toBeVisible({ timeout: 10000 })
    
    // Get initial alert count
    const initialAlertItems = page.locator('[data-testid="alert-item"]')
    const initialAlertCount = await initialAlertItems.count()
    console.log(`Initial alert count: ${initialAlertCount}`)
    
    // Get caregiver data including patients
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_PATIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver - user may not exist in test database')
    }
    const caregiverId = caregiver.id || caregiver._id
    console.log(`Caregiver ID: ${caregiverId}`)
    
    // Get a patient ID for the alert (required for patient-type alerts)
    const patientId = caregiver.patients && caregiver.patients.length > 0 
      ? (caregiver.patients[0].id || caregiver.patients[0]._id || caregiver.patients[0])
      : null
    
    if (!patientId) {
      throw new Error('Caregiver has no patients - cannot create patient alert')
    }
    console.log(`Using patient ID: ${patientId}`)
    
    // WHEN: I create a new alert in the database
    const testAlertMessage = `Test Alert for Polling - ${Date.now()}`
    console.log(`Creating alert with message: "${testAlertMessage}"`)
    
    const newAlert = await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'patient',
      relatedPatient: patientId,
    })
    
    console.log(`✅ Alert created in database: ${newAlert.id || newAlert._id}`)
    console.log(`Created alert details:`, {
      id: newAlert.id || newAlert._id,
      createdBy: newAlert.createdBy,
      relatedPatient: newAlert.relatedPatient,
      visibility: newAlert.visibility,
      message: newAlert.message
    })
    
    // Debug: Verify the alert would match the query
    try {
      const verifyResponse = await page.request.post(`${API_BASE_URL}/test/verify-alert-query`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          caregiverId,
          alertId: newAlert.id || newAlert._id,
        },
      })
      if (verifyResponse.ok()) {
        const verifyData = await verifyResponse.json()
        console.log('Alert query verification:', verifyData)
      }
    } catch (err) {
      console.log('Could not verify alert query:', err)
    }
    
    // THEN: Wait for polling interval (3 seconds in test mode, 30 seconds in production)
    // The polling should automatically fetch the new alert
    console.log('Waiting for polling interval (3 seconds in test mode)...')
    
    // Wait a bit longer than the polling interval to ensure it has time to poll
    // In test mode, polling is 3 seconds, otherwise 30 seconds
    // Wait for at least 2 polling cycles to ensure the alert is picked up
    const pollingInterval = (process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST === '1') ? 3000 : 30000
    const waitTime = (pollingInterval * 2) + 1000 // Wait for 2 polling cycles + 1 second buffer
    
    await page.waitForTimeout(waitTime)
    console.log(`Waited ${waitTime}ms for polling to occur (2 cycles of ${pollingInterval}ms each)`)
    
    // AND: The new alert should appear in the list without manual refresh
    // Try multiple times with small delays in case polling is slightly delayed
    let alertFound = false
    const maxAttempts = 10
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await page.waitForTimeout(1000) // Wait 1 second between attempts
      
      const alertItems = page.locator('[data-testid="alert-item"]')
      const currentAlertCount = await alertItems.count()
      console.log(`Attempt ${attempt}: Found ${currentAlertCount} alerts (initial: ${initialAlertCount})`)
      
      // Check if our alert message appears
      const alertWithMessage = page.locator('[data-testid="alert-item"]').filter({
        hasText: testAlertMessage,
      })
      const alertCount = await alertWithMessage.count()
      
      if (alertCount > 0) {
        alertFound = true
        console.log(`✅ Alert found after ${attempt} attempt(s)!`)
        break
      }
      
      // Also check if alert count increased
      if (currentAlertCount > initialAlertCount) {
        console.log(`Alert count increased from ${initialAlertCount} to ${currentAlertCount}`)
        // The alert might be there but with different text, let's check all alerts
        const allAlertTexts = await alertItems.allTextContents()
        console.log('All alert texts:', allAlertTexts)
        
        // Check if any alert contains part of our message
        const foundInText = allAlertTexts.some(text => 
          text.includes('Test Alert for Polling') || text.includes(testAlertMessage.substring(0, 20))
        )
        
        if (foundInText) {
          alertFound = true
          console.log(`✅ Alert found in text content!`)
          break
        }
      } else if (attempt === maxAttempts) {
        // On last attempt, show all alerts for debugging
        const allAlertTexts = await alertItems.allTextContents()
        console.log(`Final attempt - All ${currentAlertCount} alerts:`, allAlertTexts)
        console.log(`Looking for alert with message: "${testAlertMessage}"`)
      }
    }
    
    // Verify the alert was found
    expect(alertFound).toBe(true)
    
    // Verify the alert is visible and contains our message
    const alertWithMessage = page.locator('[data-testid="alert-item"]').filter({
      hasText: testAlertMessage,
    })
    await expect(alertWithMessage.first()).toBeVisible({ timeout: 5000 })
    
    console.log('✅ Alert polling test passed - new alert appeared automatically!')
  })

  test("should poll alerts even when screen is in background and show them when returning", async ({ page }) => {
    console.log('=== ALERT POLLING BACKGROUND TEST ===')
    
    // GIVEN: I'm on the alerts screen
    await navigateToAlertTab(page)
    await expect(
      page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))
    ).toBeVisible({ timeout: 10000 })
    
    const initialAlertCount = await page.locator('[data-testid="alert-item"]').count()
    console.log(`Initial alert count: ${initialAlertCount}`)
    
    // WHEN: I navigate away to another screen
    const homeTab = page.getByLabel('Home tab').or(page.getByTestId('tab-home'))
    await homeTab.click()
    await page.waitForTimeout(1000)
    
    // Get caregiver data including patients
    const caregiver = await getCaregiverByEmail(page, TEST_USERS.WITH_PATIENTS.email)
    if (!caregiver) {
      throw new Error('Could not get caregiver')
    }
    const caregiverId = caregiver.id || caregiver._id
    
    // Get a patient ID for the alert (required for patient-type alerts)
    const patientId = caregiver.patients && caregiver.patients.length > 0 
      ? (caregiver.patients[0].id || caregiver.patients[0]._id || caregiver.patients[0])
      : null
    
    if (!patientId) {
      throw new Error('Caregiver has no patients - cannot create patient alert')
    }
    
    const testAlertMessage = `Background Alert - ${Date.now()}`
    console.log(`Creating alert while on home screen: "${testAlertMessage}"`)
    
    await createAlertForCaregiver(page, caregiverId, {
      message: testAlertMessage,
      importance: 'high',
      alertType: 'patient',
      relatedPatient: patientId,
    })
    
    // Wait for polling to occur (polling should continue even when screen is not active)
    const pollingInterval = (process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST === '1') ? 3000 : 30000
    await page.waitForTimeout(pollingInterval + 2000)
    
    // THEN: When I return to the alerts screen, the new alert should be visible
    await navigateToAlertTab(page)
    await expect(
      page.getByLabel('alert-screen').or(page.getByTestId('alert-screen'))
    ).toBeVisible({ timeout: 10000 })
    
    // Wait a bit for the screen to fully load and any pending polls to complete
    await page.waitForTimeout(2000)
    
    // Check if alert appears (refetchOnFocus should trigger when returning to screen)
    const alertWithMessage = page.locator('[data-testid="alert-item"]').filter({
      hasText: testAlertMessage,
    })
    
    // Try multiple times as refetchOnFocus might take a moment
    let alertFound = false
    for (let attempt = 1; attempt <= 10; attempt++) {
      await page.waitForTimeout(1000)
      const count = await alertWithMessage.count()
      console.log(`Background test attempt ${attempt}: Found ${count} alerts with message "${testAlertMessage}"`)
      
      // Also check all alerts to see what we have
      const allAlerts = page.locator('[data-testid="alert-item"]')
      const allAlertCount = await allAlerts.count()
      if (allAlertCount > 0) {
        const allAlertTexts = await allAlerts.allTextContents()
        console.log(`All alerts (${allAlertCount}):`, allAlertTexts.slice(0, 5))
      }
      
      if (count > 0) {
        alertFound = true
        break
      }
    }
    
    expect(alertFound).toBe(true)
    await expect(alertWithMessage.first()).toBeVisible()
    
    console.log('✅ Background polling test passed - alert appeared when returning to screen!')
  })
})



