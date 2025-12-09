import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { navigateToHome } from "./helpers/navigation"
import { TEST_USERS } from './fixtures/testData'

// Helper to get the schedule selector picker (the picker that shows existing schedules)
async function getScheduleSelectorPicker(page: any) {
  // The schedule selector picker is the first select on the page when schedules exist
  // It's in the selector card that appears when schedules.length > 0
  const newScheduleButton = page.locator('[data-testid="schedule-new-button"]')
  const buttonExists = await newScheduleButton.count() > 0
  
  if (!buttonExists) {
    return null // No schedules exist yet, so no selector picker
  }
  
  // The picker is in the same container as the "+" button
  // Find the select that's a sibling or in the same parent container
  // The structure is: View (pickerRow) > TouchableOpacity (+ button) + View (pickerWrapper) > Picker > select
  // So we can find it by looking for a select near the button
  const pickerRow = newScheduleButton.locator('..') // Get parent (pickerRow)
  const schedulePicker = pickerRow.locator('select').first()
  const pickerExists = await schedulePicker.count() > 0
  
  if (pickerExists) {
    return schedulePicker
  }
  
  // Fallback: if the structure is different, just get the first select
  // (the schedule selector is always the first select when it exists)
  const firstSelect = page.locator('select').first()
  return firstSelect
}

// Helper to count valid schedules in the picker
async function countSchedulesInPicker(picker: any): Promise<number> {
  if (!picker) {
    return 0
  }
  
  const options = picker.locator('option')
  const optionCount = await options.count()
  let validCount = 0
  
  for (let i = 0; i < optionCount; i++) {
    const option = options.nth(i)
    const value = await option.getAttribute('value').catch(() => null)
    if (value && value !== '' && value !== 'null' && value !== 'undefined') {
      validCount++
    }
  }
  
  return validCount
}

// Helper to navigate to schedules via patient
async function navigateToSchedulesViaPatient(page: any): Promise<void> {
  // Step 1: Click on the edit button for a patient from home screen
  const editButton = page.locator('[data-testid^="edit-patient-button-"]').first()
  const editButtonCount = await editButton.count()
  if (editButtonCount === 0) {
    const patientCard = page.locator('[data-testid^="patient-card-"]').first()
    const patientCount = await patientCard.count()
    if (patientCount === 0) {
      throw new Error('No patients found - cannot access schedules without patients')
    }
    throw new Error('No edit buttons found on patient cards')
  }
  await editButton.waitFor({ timeout: 10000, state: 'visible' })
  await editButton.click()
  
  // Step 2: Wait for patient screen to load
  const patientScreen = page.locator('[data-testid="patient-screen"]')
  await patientScreen.waitFor({ timeout: 10000, state: 'visible' })
  
  // Step 3: Wait for patient data to load
  await page.waitForTimeout(1500)
  
  // Step 4: Wait for the manage-schedules-button to appear
  const manageSchedulesButton = page.locator('[data-testid="manage-schedules-button"]')
  
  let buttonFound = false
  for (let i = 0; i < 8; i++) {
    const buttonCount = await manageSchedulesButton.count()
    if (buttonCount > 0) {
      buttonFound = true
      break
    }
    await page.waitForTimeout(500)
  }
  
  if (!buttonFound) {
    throw new Error('Manage schedules button not found on patient screen')
  }
  
  // Step 5: Click the manage schedules button
  await manageSchedulesButton.first().waitFor({ timeout: 5000, state: 'visible' })
  await manageSchedulesButton.first().click()
  await page.waitForTimeout(1500) // Wait for navigation to schedules screen
}

// Helper to create a schedule with given time
async function createSchedule(page: any, time: string): Promise<void> {
  // Check if there are existing schedules (picker with "+" button exists)
  const newScheduleButton = page.locator('[data-testid="schedule-new-button"]')
  const buttonCount = await newScheduleButton.count()
  
  if (buttonCount > 0) {
    // Schedules exist - click the "+" button to create a new schedule
    await newScheduleButton.waitFor({ timeout: 5000, state: 'visible' })
    await newScheduleButton.click()
    await page.waitForTimeout(1000) // Wait for form to reset
  }
  // If no schedules exist, the form is already in "new schedule" mode
  
  // Find all select elements - the time picker is the first one in the ScheduleComponent
  // (before the schedule selector picker if it exists)
  const allSelects = page.locator('select')
  const selectCount = await allSelects.count()
  
  if (selectCount === 0) {
    throw new Error('Cannot create schedule: no select elements found (schedule form not visible)')
  }
  
  // The time picker is typically the first select in the ScheduleComponent
  // If there's a schedule selector picker, it comes first, so we need the second select
  // Otherwise, the first select is the time picker
  let timePicker
  if (buttonCount > 0) {
    // Schedule selector exists, so time picker is the second select
    timePicker = allSelects.nth(1)
  } else {
    // No schedule selector, time picker is the first select
    timePicker = allSelects.first()
  }
  
  await timePicker.waitFor({ timeout: 5000, state: 'visible' })
  
  // Select the time value
  await timePicker.selectOption(time)
  await page.waitForTimeout(500) // Wait for selection to process
  
  // Frequency should default to "daily" which is fine for this test
  // Daily frequency doesn't require intervals, so we don't need to set anything else
  
  // Click save button
  const saveButton = page.locator('[data-testid="schedule-save-button"]')
  await saveButton.waitFor({ timeout: 5000, state: 'visible' })
  await saveButton.click()
  
  // Wait for save to complete and Redux to update
  await page.waitForTimeout(3000) // Wait for API call and Redux update
}

test.describe("Multiple Schedules for Patient", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page, TEST_USERS.WITH_PATIENTS)
  })

  test("can add more than one schedule to a patient", async ({ page }) => {
    // Navigate to schedules screen via patient
    await navigateToSchedulesViaPatient(page)
    
    // Verify we're on schedules screen
    await expect(page.locator('[data-testid="schedules-screen"]')).toBeVisible({ timeout: 10000 })
    
    // Get initial schedule count (if any)
    const initialSchedulePicker = await getScheduleSelectorPicker(page)
    const initialScheduleCount = initialSchedulePicker ? await countSchedulesInPicker(initialSchedulePicker) : 0
    
    console.log(`Initial schedule count: ${initialScheduleCount}`)
    
    // Create first schedule with time "09:00"
    console.log('Creating first schedule (09:00)...')
    await createSchedule(page, '09:00')
    
    // Wait a bit for the schedule to appear in the picker
    await page.waitForTimeout(2000)
    
    // Verify first schedule was created - the schedule selector should now exist
    const schedulePickerAfterFirst = await getScheduleSelectorPicker(page)
    expect(schedulePickerAfterFirst).not.toBeNull()
    
    // Count schedules after first creation
    const validScheduleCountAfterFirst = await countSchedulesInPicker(schedulePickerAfterFirst)
    expect(validScheduleCountAfterFirst).toBe(initialScheduleCount + 1)
    console.log(`Schedule count after first creation: ${validScheduleCountAfterFirst}`)
    
    // Create second schedule with time "14:00"
    console.log('Creating second schedule (14:00)...')
    await createSchedule(page, '14:00')
    
    // Wait for the second schedule to be created
    await page.waitForTimeout(2000)
    
    // Verify both schedules exist
    const schedulePickerAfterSecond = await getScheduleSelectorPicker(page)
    expect(schedulePickerAfterSecond).not.toBeNull()
    await schedulePickerAfterSecond.waitFor({ timeout: 5000, state: 'visible' })
    
    // Count total schedules and get their values
    const optionsAfterSecond = schedulePickerAfterSecond.locator('option')
    const optionCountAfterSecond = await optionsAfterSecond.count()
    const scheduleValues: string[] = []
    const scheduleLabels: string[] = []
    
    for (let i = 0; i < optionCountAfterSecond; i++) {
      const option = optionsAfterSecond.nth(i)
      const value = await option.getAttribute('value').catch(() => null)
      const text = await option.textContent().catch(() => null)
      if (value && value !== '' && value !== 'null' && value !== 'undefined') {
        scheduleValues.push(value)
        if (text && text.trim() !== '') {
          scheduleLabels.push(text.trim())
        }
      }
    }
    
    const validScheduleCountAfterSecond = scheduleValues.length
    console.log(`Final schedule count: ${validScheduleCountAfterSecond}`)
    console.log(`Schedule values: ${scheduleValues.join(', ')}`)
    console.log(`Schedule labels in picker: ${scheduleLabels.join(', ')}`)
    
    // Verify we have at least 2 schedules (the two we just created)
    // We might have more if there were existing schedules
    expect(validScheduleCountAfterSecond).toBeGreaterThanOrEqual(initialScheduleCount + 2)
    
    // Verify we have multiple schedule options
    expect(scheduleLabels.length).toBeGreaterThanOrEqual(2)
    
    // Verify we can select different schedules from the picker
    if (scheduleValues.length >= 2) {
      // Select the first schedule
      await schedulePickerAfterSecond.selectOption(scheduleValues[0])
      await page.waitForTimeout(1000)
      
      // Select the second schedule
      await schedulePickerAfterSecond.selectOption(scheduleValues[1])
      await page.waitForTimeout(1000)
      
      // Verify we can switch between them
      const selectedValue = await schedulePickerAfterSecond.inputValue().catch(() => null)
      expect(selectedValue).toBe(scheduleValues[1])
      
      console.log('✅ Successfully created and verified multiple schedules for patient')
    } else {
      throw new Error(`Expected at least 2 schedules, but only found ${scheduleValues.length}`)
    }
  })
})

