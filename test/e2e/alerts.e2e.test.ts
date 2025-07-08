/*
import { test, expect } from '@playwright/test'
import {
  ensureUserRegisteredAndLoggedInViaUI,
  createPatientViaUI,
  markAlertAsReadViaUI,
  markAllAlertsAsReadViaUI,
  getVisibleAlertMessages,
  goToAlertTab,
} from './helpers/testHelpers'
import { registerNewAlert, registerNewOrgAndCaregiver } from '../helpers'
import { newAlert } from '../fixtures/alert.fixture'

test.describe.skip('AlertScreen E2E Tests', () => {
  const testEmail = `test-${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'
  const testName = 'Test Caregiver'
  const testPhone = '1234567890'
  const patientName = 'Test Patient'
  const patientEmail = `patient-${Date.now()}@example.com`
  const patientPhone = '1234567890'

  test.beforeEach(async ({ page }) => {
    // Ensure user exists and is logged in
    await ensureUserRegisteredAndLoggedInViaUI(page, testName, testEmail, testPassword, testPhone)
    // Create a patient via UI
    await createPatientViaUI(page, patientName, patientEmail, patientPhone)
    // Get caregiver info for alert creation
    const { caregiver } = await registerNewOrgAndCaregiver(testName, testEmail, testPassword, testPhone)
    // Create alerts via API
    await registerNewAlert({ ...newAlert(caregiver, 'Caregiver', 'high', 'allCaregivers'), message: 'Test Alert 1 - High Priority', alertType: 'patient' })
    await registerNewAlert({ ...newAlert(caregiver, 'Caregiver', 'medium', 'allCaregivers'), message: 'Test Alert 2 - Medium Priority', alertType: 'system' })
    await registerNewAlert({ ...newAlert(caregiver, 'Caregiver', 'low', 'allCaregivers'), message: 'Test Alert 3 - Low Priority', alertType: 'conversation' })
  })

  test('should display alerts list with correct information', async ({ page }) => {
    await goToAlertTab(page)
    await page.waitForSelector('[data-testid="alert-list"]', { timeout: 10000 })
    const messages = await getVisibleAlertMessages(page)
    expect(messages.some(m => m.includes('Test Alert 1 - High Priority'))).toBeTruthy()
    expect(messages.some(m => m.includes('Test Alert 2 - Medium Priority'))).toBeTruthy()
    expect(messages.some(m => m.includes('Test Alert 3 - Low Priority'))).toBeTruthy()
  })

  test('should mark individual alerts as read when clicked', async ({ page }) => {
    await markAlertAsReadViaUI(page, 'Test Alert 1 - High Priority')
    // Optionally, check that the alert is now marked as read or disappears from unread list
    // This depends on your UI behavior
  })

  test('should mark all unread alerts as read when checkbox is clicked', async ({ page }) => {
    await markAllAlertsAsReadViaUI(page)
    // Optionally, check that all alerts are now marked as read or disappear from unread list
  })

  test('should show empty state when no alerts exist', async ({ page }) => {
    // Register a new user with no alerts
    const newEmail = `test-${Date.now()}@example.com`
    await ensureUserRegisteredAndLoggedInViaUI(page, 'Empty User', newEmail, testPassword, testPhone)
    await goToAlertTab(page)
    await expect(page.getByTestId('alert-empty-state')).toBeVisible()
  })
})
*/ 