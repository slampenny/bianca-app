import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToHome, isHomeScreen } from "./helpers/navigation"
import { TEST_USERS } from './fixtures/testData'

test.describe("Schedule Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
  })

  test("can navigate to schedules screen", async ({ page }) => {
    // Navigate to schedules screen from home
    await page.getByTestId('schedule-nav-button').click()
    
    // Should be on schedules screen
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    await expect(page.getByTestId('schedules-header')).toContainText('Schedule')
  })

  test("can view existing schedules", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Check for schedule list or schedule cards
    const scheduleElements = await page.locator('[data-testid^="schedule-card-"], [data-testid="schedule-list"]').count()
    expect(scheduleElements).toBeGreaterThan(0)
  })

  test("can create a new schedule", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Click create schedule button
    await page.getByTestId('create-schedule-button').click()
    await expect(page.getByTestId('schedule-form')).toBeVisible()
    
    // Fill in schedule details
    await page.getByTestId('schedule-patient-select').click()
    await page.getByTestId('schedule-patient-option-0').click() // Select first patient
    
    await page.getByTestId('schedule-frequency-select').click()
    await page.getByTestId('schedule-frequency-daily').click()
    
    await page.getByTestId('schedule-time-input').fill('09:00')
    
    await page.getByTestId('schedule-intervals-input').fill('4')
    
    // Save the schedule
    await page.getByTestId('schedule-save-button').click()
    
    // Should see success message or return to schedule list
    await expect(page.getByTestId('schedule-success-message')).toBeVisible()
  })

  test("can edit an existing schedule", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Find and click on an existing schedule
    const firstSchedule = page.locator('[data-testid^="schedule-card-"]').first()
    await firstSchedule.click()
    
    // Should open schedule edit form
    await expect(page.getByTestId('schedule-form')).toBeVisible()
    
    // Modify schedule details
    await page.getByTestId('schedule-time-input').fill('10:30')
    
    // Save changes
    await page.getByTestId('schedule-save-button').click()
    
    // Should see success message
    await expect(page.getByTestId('schedule-success-message')).toBeVisible()
  })

  test("can toggle schedule active status", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Find a schedule and toggle its active status
    const scheduleToggle = page.locator('[data-testid^="schedule-toggle-"]').first()
    const initialState = await scheduleToggle.getAttribute('aria-checked')
    
    await scheduleToggle.click()
    
    // Status should have changed
    const newState = await scheduleToggle.getAttribute('aria-checked')
    expect(newState).not.toBe(initialState)
  })

  test("can delete a schedule", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Find and click delete button on a schedule
    const firstSchedule = page.locator('[data-testid^="schedule-card-"]').first()
    await firstSchedule.getByTestId('schedule-delete-button').click()
    
    // Confirm deletion in modal
    await expect(page.getByTestId('delete-confirm-modal')).toBeVisible()
    await page.getByTestId('delete-confirm-button').click()
    
    // Should see success message
    await expect(page.getByTestId('schedule-delete-success')).toBeVisible()
  })

  test("validates schedule form fields", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Click create schedule button
    await page.getByTestId('create-schedule-button').click()
    await expect(page.getByTestId('schedule-form')).toBeVisible()
    
    // Try to save without filling required fields
    await page.getByTestId('schedule-save-button').click()
    
    // Should see validation errors
    await expect(page.getByTestId('schedule-patient-error')).toBeVisible()
    await expect(page.getByTestId('schedule-time-error')).toBeVisible()
  })

  test("can filter schedules by patient", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Use patient filter
    await page.getByTestId('schedule-patient-filter').click()
    await page.getByTestId('schedule-patient-filter-option-0').click()
    
    // Should show filtered results
    const filteredSchedules = await page.locator('[data-testid^="schedule-card-"]').count()
    expect(filteredSchedules).toBeGreaterThan(0)
  })

  test("can filter schedules by status", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Filter by active schedules
    await page.getByTestId('schedule-status-filter').click()
    await page.getByTestId('schedule-status-active').click()
    
    // Should show only active schedules
    const activeSchedules = await page.locator('[data-testid="schedule-status-active"]').count()
    expect(activeSchedules).toBeGreaterThan(0)
  })

  test("can navigate back to home from schedules", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Navigate back to home
    await page.getByTestId('schedule-back-button').click()
    
    // Should be back on home screen
    await isHomeScreen(page)
  })

  test("schedule form shows proper validation for time format", async ({ page }) => {
    // Navigate to schedules and create new schedule
    await page.getByTestId('schedule-nav-button').click()
    await page.getByTestId('create-schedule-button').click()
    await expect(page.getByTestId('schedule-form')).toBeVisible()
    
    // Fill required fields first
    await page.getByTestId('schedule-patient-select').click()
    await page.getByTestId('schedule-patient-option-0').click()
    
    // Try invalid time format
    await page.getByTestId('schedule-time-input').fill('25:99')
    await page.getByTestId('schedule-save-button').click()
    
    // Should show time format error
    await expect(page.getByTestId('schedule-time-error')).toBeVisible()
    
    // Fix time format
    await page.getByTestId('schedule-time-input').fill('14:30')
    await page.getByTestId('schedule-save-button').click()
    
    // Should save successfully
    await expect(page.getByTestId('schedule-success-message')).toBeVisible()
  })

  test("can view schedule details", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Click on a schedule to view details
    const firstSchedule = page.locator('[data-testid^="schedule-card-"]').first()
    await firstSchedule.click()
    
    // Should show schedule details
    await expect(page.getByTestId('schedule-details')).toBeVisible()
    await expect(page.getByTestId('schedule-patient-name')).toBeVisible()
    await expect(page.getByTestId('schedule-frequency-display')).toBeVisible()
    await expect(page.getByTestId('schedule-time-display')).toBeVisible()
  })

  test("schedule creation respects business rules", async ({ page }) => {
    // Navigate to schedules
    await page.getByTestId('schedule-nav-button').click()
    await page.getByTestId('create-schedule-button').click()
    await expect(page.getByTestId('schedule-form')).toBeVisible()
    
    // Fill form with valid data
    await page.getByTestId('schedule-patient-select').click()
    await page.getByTestId('schedule-patient-option-0').click()
    
    await page.getByTestId('schedule-frequency-select').click()
    await page.getByTestId('schedule-frequency-weekly').click()
    
    await page.getByTestId('schedule-time-input').fill('09:00')
    await page.getByTestId('schedule-intervals-input').fill('3')
    
    // Save schedule
    await page.getByTestId('schedule-save-button').click()
    
    // Should create successfully
    await expect(page.getByTestId('schedule-success-message')).toBeVisible()
    
    // Verify schedule appears in list
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    const schedules = await page.locator('[data-testid^="schedule-card-"]').count()
    expect(schedules).toBeGreaterThan(0)
  })

  test("schedule management integrates with patient workflow", async ({ page }) => {
    // Start from patient screen
    await page.getByTestId('patient-nav-button').click()
    await expect(page.getByTestId('patient-screen')).toBeVisible()
    
    // Select a patient
    const firstPatient = page.locator('[data-testid^="patient-card-"]').first()
    await firstPatient.click()
    
    // Should see patient details with schedule option
    await expect(page.getByTestId('patient-schedule-button')).toBeVisible()
    
    // Click schedule button
    await page.getByTestId('patient-schedule-button').click()
    
    // Should navigate to schedules for that patient
    await expect(page.getByTestId('schedules-screen')).toBeVisible()
    
    // Patient should be pre-selected
    await expect(page.getByTestId('schedule-patient-selected')).toBeVisible()
  })
})
