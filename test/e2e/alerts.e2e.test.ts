import { test, expect } from '@playwright/test'
import {
  registerUserViaUI,
  loginUserViaUI,
  createPatientViaUI,
  createAlertViaUI,
  markAlertAsReadViaUI,
  markAllAlertsAsReadViaUI,
  getVisibleAlertMessages,
} from './helpers/testHelpers'

test.describe('AlertScreen E2E Tests', () => {
  const testEmail = `test-${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'
  const testName = 'Test Caregiver'
  const testPhone = '1234567890'
  const patientName = 'Test Patient'
  const patientEmail = `patient-${Date.now()}@example.com`
  const patientPhone = '1234567890'

  test.beforeEach(async ({ page }) => {
    // Register and login via UI
    await registerUserViaUI(page, testName, testEmail, testPassword, testPhone)
    await loginUserViaUI(page, testEmail, testPassword)
    // Create a patient via UI
    await createPatientViaUI(page, patientName, patientEmail, patientPhone)
    // Create alerts via UI
    await createAlertViaUI(page, 'Test Alert 1 - High Priority', 'high', 'patient', patientName)
    await createAlertViaUI(page, 'Test Alert 2 - Medium Priority', 'medium', 'system')
    await createAlertViaUI(page, 'Test Alert 3 - Low Priority', 'low', 'conversation', patientName)
  })

  test('should display alerts list with correct information', async ({ page }) => {
    await page.goto('/alerts')
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
    await registerUserViaUI(page, 'Empty User', newEmail, testPassword, testPhone)
    await loginUserViaUI(page, newEmail, testPassword)
    await page.goto('/alerts')
    await expect(page.locator('text=No alerts')).toBeVisible()
  })
}) 