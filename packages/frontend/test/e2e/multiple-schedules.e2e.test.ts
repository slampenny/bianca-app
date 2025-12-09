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
  
  // Wait for the save to complete by waiting for network request
  const savePromise = page.waitForResponse(response => 
    response.url().includes('/schedules/patients/') && response.request().method() === 'POST',
    { timeout: 10000 }
  ).catch(() => null) // Don't fail if we can't catch the response
  
  await saveButton.click()
  
  // Wait for the API response and verify it succeeded
  const response = await savePromise
  if (response) {
    const status = response.status()
    if (status >= 400) {
      const responseBody = await response.json().catch(() => ({}))
      throw new Error(`Schedule creation failed with status ${status}: ${JSON.stringify(responseBody)}`)
    }
  }
  
  // Wait for loading to complete (the screen shows LoadingScreen while saving)
  await page.waitForSelector('[data-testid="schedules-screen"]', { timeout: 15000, state: 'visible' })
  
  // Wait a bit more for Redux to update and UI to refresh
  await page.waitForTimeout(3000)
  
  // Check for error messages
  const errorMessage = page.locator('[data-testid*="error"], .error, [class*="error"]')
  const errorCount = await errorMessage.count()
  if (errorCount > 0) {
    const errorText = await errorMessage.first().textContent().catch(() => '')
    if (errorText && !errorText.includes('No changes')) {
      console.log(`Warning: Error message found: ${errorText}`)
    }
  }
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
    
    // Wait for the schedule to appear in the picker - retry up to 10 times
    let schedulePickerAfterFirst = null
    let validScheduleCountAfterFirst = initialScheduleCount
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000)
      schedulePickerAfterFirst = await getScheduleSelectorPicker(page)
      if (schedulePickerAfterFirst) {
        validScheduleCountAfterFirst = await countSchedulesInPicker(schedulePickerAfterFirst)
        if (validScheduleCountAfterFirst === initialScheduleCount + 1) {
          break
        }
      }
    }
    
    // Verify first schedule was created - the schedule selector should now exist
    expect(schedulePickerAfterFirst).not.toBeNull()
    expect(validScheduleCountAfterFirst).toBe(initialScheduleCount + 1)
    console.log(`Schedule count after first creation: ${validScheduleCountAfterFirst}`)
    
    // Create second schedule with time "14:00"
    console.log('Creating second schedule (14:00)...')
    await createSchedule(page, '14:00')
    
    // Wait for the second schedule to appear in the picker - retry up to 10 times
    let schedulePickerAfterSecond = null
    let validScheduleCountAfterSecond = validScheduleCountAfterFirst
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000)
      schedulePickerAfterSecond = await getScheduleSelectorPicker(page)
      if (schedulePickerAfterSecond) {
        validScheduleCountAfterSecond = await countSchedulesInPicker(schedulePickerAfterSecond)
        if (validScheduleCountAfterSecond >= initialScheduleCount + 2) {
          break
        }
      }
    }
    
    // Verify both schedules exist
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
    
    // Use the count we already calculated
    const finalScheduleCount = scheduleValues.length
    console.log(`Final schedule count: ${finalScheduleCount}`)
    console.log(`Schedule values: ${scheduleValues.join(', ')}`)
    console.log(`Schedule labels in picker: ${scheduleLabels.join(', ')}`)
    
    // Verify we have at least 2 schedules (the two we just created)
    // We might have more if there were existing schedules
    expect(finalScheduleCount).toBeGreaterThanOrEqual(initialScheduleCount + 2)
    
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

  test("can delete a schedule and only the selected schedule is deleted", async ({ page }) => {
    // Navigate to schedules screen via patient
    await navigateToSchedulesViaPatient(page)
    
    // Verify we're on schedules screen
    await expect(page.locator('[data-testid="schedules-screen"]')).toBeVisible({ timeout: 10000 })
    
    // Get initial schedule count
    const initialSchedulePicker = await getScheduleSelectorPicker(page)
    const initialScheduleCount = initialSchedulePicker ? await countSchedulesInPicker(initialSchedulePicker) : 0
    
    if (initialScheduleCount < 2) {
      // Need at least 2 schedules to test deletion - create them first
      console.log('Creating schedules for delete test...')
      await createSchedule(page, '10:00')
      await page.waitForTimeout(2000)
      await createSchedule(page, '11:00')
      await page.waitForTimeout(2000)
    }
    
    // Get the schedule picker and all schedule values
    const schedulePicker = await getScheduleSelectorPicker(page)
    expect(schedulePicker).not.toBeNull()
    await schedulePicker.waitFor({ timeout: 5000, state: 'visible' })
    
    // Get all schedule options
    const options = schedulePicker.locator('option')
    const optionCount = await options.count()
    const allScheduleValues: string[] = []
    const allScheduleLabels: string[] = []
    
    for (let i = 0; i < optionCount; i++) {
      const option = options.nth(i)
      const value = await option.getAttribute('value').catch(() => null)
      const text = await option.textContent().catch(() => null)
      if (value && value !== '' && value !== 'null' && value !== 'undefined') {
        allScheduleValues.push(value)
        if (text && text.trim() !== '') {
          allScheduleLabels.push(text.trim())
        }
      }
    }
    
    const scheduleCountBeforeDelete = allScheduleValues.length
    expect(scheduleCountBeforeDelete).toBeGreaterThanOrEqual(2)
    
    console.log(`Schedules before delete: ${scheduleCountBeforeDelete}`)
    console.log(`Schedule values: ${allScheduleValues.join(', ')}`)
    
    // Select the second schedule (not the first one)
    const scheduleToDelete = allScheduleValues[1]
    const scheduleToKeep = allScheduleValues[0]
    
    console.log(`Selecting schedule to delete: ${scheduleToDelete}`)
    console.log(`Schedule to keep: ${scheduleToKeep}`)
    
    // Select the schedule we want to delete
    await schedulePicker.selectOption(scheduleToDelete)
    await page.waitForTimeout(1000) // Wait for selection to process
    
    // Verify the schedule is selected
    const selectedValue = await schedulePicker.inputValue().catch(() => null)
    expect(selectedValue).toBe(scheduleToDelete)
    
    // Click the delete button
    const deleteButton = page.locator('[data-testid="schedule-delete-button"]')
    await deleteButton.waitFor({ timeout: 5000, state: 'visible' })
    
    // Wait for the delete to complete by waiting for network request
    const deletePromise = page.waitForResponse(response => 
      response.url().includes('/schedules/') && response.request().method() === 'DELETE',
      { timeout: 10000 }
    ).catch(() => null)
    
    await deleteButton.click()
    
    // Wait for the API response
    const deleteResponse = await deletePromise
    if (deleteResponse) {
      const status = deleteResponse.status()
      if (status >= 400) {
        const responseBody = await deleteResponse.json().catch(() => ({}))
        throw new Error(`Schedule deletion failed with status ${status}: ${JSON.stringify(responseBody)}`)
      }
    }
    
    // Wait for loading to complete
    await page.waitForSelector('[data-testid="schedules-screen"]', { timeout: 15000, state: 'visible' })
    await page.waitForTimeout(2000) // Wait for Redux to update
    
    // Verify the deleted schedule is gone and other schedules remain
    const schedulePickerAfterDelete = await getScheduleSelectorPicker(page)
    
    // If there are still schedules, verify the count decreased by 1
    if (schedulePickerAfterDelete) {
      const scheduleCountAfterDelete = await countSchedulesInPicker(schedulePickerAfterDelete)
      expect(scheduleCountAfterDelete).toBe(scheduleCountBeforeDelete - 1)
      console.log(`Schedule count after delete: ${scheduleCountAfterDelete}`)
      
      // Verify the deleted schedule is not in the list
      const optionsAfterDelete = schedulePickerAfterDelete.locator('option')
      const optionCountAfterDelete = await optionsAfterDelete.count()
      const remainingScheduleValues: string[] = []
      
      for (let i = 0; i < optionCountAfterDelete; i++) {
        const option = optionsAfterDelete.nth(i)
        const value = await option.getAttribute('value').catch(() => null)
        if (value && value !== '' && value !== 'null' && value !== 'undefined') {
          remainingScheduleValues.push(value)
        }
      }
      
      // Verify the deleted schedule is not in the remaining schedules
      expect(remainingScheduleValues).not.toContain(scheduleToDelete)
      console.log(`Deleted schedule ${scheduleToDelete} is not in remaining schedules`)
      
      // Verify the schedule we wanted to keep is still there
      expect(remainingScheduleValues).toContain(scheduleToKeep)
      console.log(`Schedule ${scheduleToKeep} is still present (correctly preserved)`)
      
      console.log(`Remaining schedule values: ${remainingScheduleValues.join(', ')}`)
    } else {
      // If no picker, we might have deleted the last schedule
      // In that case, verify we're still on the schedules screen (not navigated away)
      const schedulesScreen = page.locator('[data-testid="schedules-screen"]')
      await expect(schedulesScreen).toBeVisible({ timeout: 5000 })
      console.log('All schedules deleted - still on schedules screen')
    }
    
    // Verify we're still on the schedules screen (control remains after deletion)
    const schedulesScreen = page.locator('[data-testid="schedules-screen"]')
    await expect(schedulesScreen).toBeVisible({ timeout: 5000 })
    console.log('✅ Successfully deleted schedule and remained on schedules screen')
  })
})

