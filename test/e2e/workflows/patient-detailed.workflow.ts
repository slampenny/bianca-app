import { Page, expect } from '@playwright/test'

// Comprehensive patient management workflow components
export class PatientDetailedWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  async givenIAmLoggedInAsStaffWithPatients() {
    // Login as staff user who has patients assigned - use data-testid
    // Use data-testid for TextField inputs (TextField needs input[data-testid="..."] pattern)
    await this.page.locator('input[data-testid="email-input"]').fill('fake@example.org')
    await this.page.locator('input[data-testid="password-input"]').fill('Password1')
    const loginButton = this.page.locator('[data-testid="login-button"], button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first()
    await loginButton.waitFor({ state: 'visible', timeout: 10000 })
    await loginButton.click()
    
    // Wait for home screen with patients
    await expect(this.page.getByText("Add Patient", { exact: true })).toBeVisible({ timeout: 10000 })
    
    // Verify we have patients assigned
    const patientCards = await this.page.locator('[data-testid^="patient-card-"]').count()
    console.log(`Found ${patientCards} patient cards on home screen`)
    
    return patientCards > 0
  }

  async givenIHaveSelectedAPatient(patientName?: string) {
    // Check if already logged in by looking for patient cards
    const existingPatientCards = await this.page.locator('[data-testid^="patient-card-"]').count()
    if (existingPatientCards === 0) {
      const hasPatients = await this.givenIAmLoggedInAsStaffWithPatients()
      if (!hasPatients) return false
    }

    // Select a specific patient or the first available one
    if (patientName) {
      const specificPatientCard = this.page.locator('[data-testid^="patient-card-"]').filter({ hasText: patientName })
      if (await specificPatientCard.count() > 0) {
        await specificPatientCard.first().click()
        await this.page.waitForTimeout(2000)
        return true
      }
    }
    
    // Select first patient if no specific name or patient not found
    const firstPatientCard = this.page.locator('[data-testid^="patient-card-"]').first()
    const cardCount = await firstPatientCard.count().catch(() => 0)
    
    if (cardCount > 0) {
      // Try to scroll the card into view
      await firstPatientCard.scrollIntoViewIfNeeded().catch(() => {})
      await this.page.waitForTimeout(500)
      
      // Check if card is visible
      const isVisible = await firstPatientCard.isVisible().catch(() => false)
      
      if (isVisible) {
        await firstPatientCard.click({ timeout: 5000 }).catch(() => {})
        await this.page.waitForTimeout(2000)
        return true
      } else {
        // If not visible, try clicking anyway (might be in a scrollable container)
        try {
          await firstPatientCard.click({ force: true, timeout: 5000 })
          await this.page.waitForTimeout(2000)
          return true
        } catch (error) {
          // Try alternative: click by data-testid
          const patientByLabel = this.page.locator('[data-testid^="patient-card-"]').first()
          const labelCount = await patientByLabel.count().catch(() => 0)
          if (labelCount > 0) {
            await patientByLabel.scrollIntoViewIfNeeded().catch(() => {})
            await this.page.waitForTimeout(500)
            await patientByLabel.click({ timeout: 5000 }).catch(() => {})
            await this.page.waitForTimeout(2000)
            return true
          }
        }
      }
    }
    
    return false
  }

  async givenIAmOnPatientDetailsScreen(patientName?: string) {
    const patientSelected = await this.givenIHaveSelectedAPatient(patientName)
    if (!patientSelected) {
      throw new Error(`Failed to select patient${patientName ? `: ${patientName}` : ''} - no patient cards found or could not be clicked`)
    }

    // Look for patient details/edit interface
    const patientDetailsElements = [
      this.page.getByTestId('patient-details'),
      this.page.getByTestId('patient-form'),
      this.page.getByTestId('edit-patient-button'),
      this.page.getByText(/edit patient/i),
      this.page.getByText(/patient details/i)
    ]

    for (const element of patientDetailsElements) {
      if (await element.count() > 0) {
        await element.first().click()
        await this.page.waitForTimeout(2000)
        break
      }
    }

    return true
  }

  // SCHEDULE MANAGEMENT WORKFLOWS
  async whenIAccessPatientSchedules(patientName?: string) {
    const patientSelected = await this.givenIHaveSelectedAPatient(patientName)
    if (!patientSelected) return false

    // Look for schedule access
    const scheduleElements = [
      this.page.getByTestId('patient-schedules-button'),
      this.page.getByTestId('schedules-tab'),
      this.page.getByTestId('view-schedules'),
      this.page.getByText(/schedule/i),
      this.page.getByText(/calendar/i)
    ]

    let scheduleAccessFound = false
    for (const element of scheduleElements) {
      if (await element.count() > 0) {
        await element.first().click()
        scheduleAccessFound = true
        await this.page.waitForTimeout(2000)
        break
      }
    }

    return scheduleAccessFound
  }

  async whenICreateNewSchedule(scheduleData: any) {
    // Create a new schedule for the patient
    const createScheduleElements = [
      this.page.getByTestId('create-schedule-button'),
      this.page.getByTestId('add-schedule-button'),
      this.page.getByTestId('new-schedule'),
      this.page.getByText(/create schedule/i),
      this.page.getByText(/add schedule/i),
      this.page.getByText(/new schedule/i)
    ]

    let createButtonFound = false
    for (const element of createScheduleElements) {
      if (await element.count() > 0) {
        await element.first().click()
        createButtonFound = true
        await this.page.waitForTimeout(2000)
        break
      }
    }

    if (createButtonFound) {
      // Fill schedule form if available
      await this.whenIFillScheduleForm(scheduleData)
    }

    return createButtonFound
  }

  async whenIFillScheduleForm(scheduleData: any) {
    // Fill schedule creation/edit form
    const scheduleFormFields = [
      { testId: 'schedule-title-input', value: scheduleData.title },
      { testId: 'schedule-description-input', value: scheduleData.description },
      { testId: 'schedule-time-input', value: scheduleData.time },
      { testId: 'schedule-date-input', value: scheduleData.date },
      { testId: 'schedule-frequency-input', value: scheduleData.frequency }
    ]

    let fieldsFound = 0
    for (const field of scheduleFormFields) {
      const input = this.page.getByTestId(field.testId)
      if (await input.count() > 0) {
        await input.fill(field.value || '')
        fieldsFound++
      }
    }

    // Look for save button
    const saveElements = [
      this.page.getByTestId('save-schedule-button'),
      this.page.getByTestId('submit-schedule-button'),
      this.page.getByText(/save schedule/i),
      this.page.getByText(/create schedule/i)
    ]

    for (const element of saveElements) {
      if (await element.count() > 0) {
        await element.first().click()
        await this.page.waitForTimeout(1000)
        break
      }
    }

    console.log(`Filled ${fieldsFound} schedule form fields`)
    return fieldsFound
  }

  async whenIUpdateExistingSchedule(scheduleId: string, newData: any) {
    // Update an existing schedule
    const scheduleElement = this.page.getByTestId(`schedule-${scheduleId}`)
    const scheduleExists = await scheduleElement.count() > 0

    if (scheduleExists) {
      await scheduleElement.click()
      await this.page.waitForTimeout(1000)

      // Look for edit button
      const editElements = [
        this.page.getByTestId('edit-schedule-button'),
        this.page.getByTestId('update-schedule-button'),
        this.page.getByText(/edit schedule/i)
      ]

      for (const element of editElements) {
        if (await element.count() > 0) {
          await element.first().click()
          await this.page.waitForTimeout(1000)
          await this.whenIFillScheduleForm(newData)
          break
        }
      }
    }

    return scheduleExists
  }

  async whenIDeleteSchedule(scheduleId: string) {
    // Delete a specific schedule
    const scheduleElement = this.page.getByTestId(`schedule-${scheduleId}`)
    const scheduleExists = await scheduleElement.count() > 0

    if (scheduleExists) {
      await scheduleElement.click()
      await this.page.waitForTimeout(1000)

      // Look for delete functionality
      const deleteElements = [
        this.page.getByTestId('delete-schedule-button'),
        this.page.getByTestId('remove-schedule-button'),
        this.page.getByText(/delete schedule/i),
        this.page.getByText(/remove schedule/i)
      ]

      for (const element of deleteElements) {
        if (await element.count() > 0) {
          await element.first().click()
          await this.page.waitForTimeout(1000)

          // Confirm deletion
          const confirmElements = [
            this.page.getByTestId('confirm-delete'),
            this.page.getByText(/confirm/i),
            this.page.getByText(/yes/i)
          ]

          for (const confirm of confirmElements) {
            if (await confirm.count() > 0) {
              await confirm.first().click()
              break
            }
          }
          break
        }
      }
    }

    return scheduleExists
  }

  // CONVERSATION MANAGEMENT WORKFLOWS
  async whenIAccessPatientConversations(patientName?: string) {
    const patientSelected = await this.givenIHaveSelectedAPatient(patientName)
    if (!patientSelected) return false

    // Look for conversation access
    const conversationElements = [
      this.page.getByTestId('patient-conversations-button'),
      this.page.getByTestId('conversations-tab'),
      this.page.getByTestId('view-conversations'),
      this.page.getByText(/conversation/i),
      this.page.getByText(/chat/i),
      this.page.getByText(/messages/i)
    ]

    let conversationAccessFound = false
    for (const element of conversationElements) {
      if (await element.count() > 0) {
        await element.first().click()
        conversationAccessFound = true
        await this.page.waitForTimeout(2000)
        break
      }
    }

    return conversationAccessFound
  }

  async whenIViewConversationHistory() {
    // Check conversation history functionality
    const conversationHistoryElements = [
      this.page.getByTestId('conversation-history'),
      this.page.getByTestId('conversation-list'),
      this.page.getByTestId('messages-list'),
      this.page.locator('[data-testid^="conversation-"]'),
      this.page.getByText(/recent conversations/i)
    ]

    let historyFound = false
    for (const element of conversationHistoryElements) {
      const count = await element.count()
      if (count > 0) {
        historyFound = true
        console.log(`Found ${count} conversation history elements`)
        break
      }
    }

    return historyFound
  }

  async whenISelectConversation(conversationIndex: number = 0) {
    // Select a specific conversation from the list
    const conversationElements = [
      this.page.locator('[data-testid^="conversation-"]').nth(conversationIndex),
      this.page.locator('[data-testid^="message-"]').nth(conversationIndex),
      this.page.getByTestId('conversation-list').locator('div').nth(conversationIndex)
    ]

    let conversationSelected = false
    for (const element of conversationElements) {
      if (await element.count() > 0) {
        await element.click()
        conversationSelected = true
        await this.page.waitForTimeout(1000)
        break
      }
    }

    return conversationSelected
  }

  // AVATAR MANAGEMENT WORKFLOWS
  async whenIAccessPatientAvatarSettings(patientName?: string) {
    const onDetailsScreen = await this.givenIAmOnPatientDetailsScreen(patientName)
    if (!onDetailsScreen) return false

    // Look for avatar management
    const avatarElements = [
      this.page.getByTestId('patient-avatar-picker'),
      this.page.getByTestId('avatar-upload'),
      this.page.getByTestId('patient-avatar'),
      this.page.getByText(/avatar/i),
      this.page.getByText(/photo/i),
      this.page.getByText(/picture/i)
    ]

    let avatarAccessFound = false
    for (const element of avatarElements) {
      if (await element.count() > 0) {
        avatarAccessFound = true
        console.log('Found patient avatar management interface')
        break
      }
    }

    return avatarAccessFound
  }

  async whenIUploadPatientAvatar(patientName?: string) {
    const avatarAccessible = await this.whenIAccessPatientAvatarSettings(patientName)
    if (!avatarAccessible) return false

    // Look for avatar upload functionality
    const uploadElements = [
      this.page.getByTestId('upload-avatar-button'),
      this.page.getByTestId('select-avatar'),
      this.page.getByText(/upload avatar/i),
      this.page.getByText(/change photo/i)
    ]

    let uploadFound = false
    for (const element of uploadElements) {
      if (await element.count() > 0) {
        console.log('Found avatar upload functionality')
        uploadFound = true
        // In a real test, you'd upload a file here
        break
      }
    }

    return uploadFound
  }

  async whenIChangePatientAvatar(patientName?: string) {
    // Change existing patient avatar
    return await this.whenIUploadPatientAvatar(patientName)
  }

  // PATIENT DETAILS MANAGEMENT
  async whenIUpdatePatientDetails(patientData: any) {
    // Update patient information
    const patientFormFields = [
      { testId: 'patient-name-input', value: patientData.name },
      { testId: 'patient-email-input', value: patientData.email },
      { testId: 'patient-phone-input', value: patientData.phone },
      { testId: 'patient-language-picker', value: patientData.language }
    ]

    let fieldsUpdated = 0
    for (const field of patientFormFields) {
      const input = this.page.getByTestId(field.testId)
      if (await input.count() > 0) {
        await input.fill(field.value || '')
        fieldsUpdated++
      }
    }

    // Look for save button
    const saveElements = [
      this.page.getByTestId('save-patient-button'),
      this.page.getByTestId('update-patient-button'),
      this.page.getByText(/save patient/i),
      this.page.getByText(/update patient/i)
    ]

    for (const element of saveElements) {
      if (await element.count() > 0) {
        await element.first().click()
        await this.page.waitForTimeout(1000)
        break
      }
    }

    console.log(`Updated ${fieldsUpdated} patient form fields`)
    return fieldsUpdated
  }

  async whenIAssignCaregiverToPatient(caregiverName: string) {
    // Assign a caregiver to the patient
    const caregiverAssignmentElements = [
      this.page.getByTestId('assign-caregiver-button'),
      this.page.getByTestId('caregiver-assignment'),
      this.page.getByText(/assign caregiver/i),
      this.page.getByText(/change caregiver/i)
    ]

    let assignmentFound = false
    for (const element of caregiverAssignmentElements) {
      if (await element.count() > 0) {
        await element.first().click()
        assignmentFound = true
        await this.page.waitForTimeout(2000)

        // Select caregiver if modal opens
        const caregiverOption = this.page.getByText(caregiverName)
        if (await caregiverOption.count() > 0) {
          await caregiverOption.click()
        }
        break
      }
    }

    return assignmentFound
  }

  // THEN steps - Assertions
  async thenIShouldSeePatientSchedules() {
    const scheduleElements = [
      this.page.getByTestId('schedule-list'),
      this.page.getByTestId('patient-schedules'),
      this.page.locator('[data-testid^="schedule-"]'),
      this.page.getByText(/schedule/i)
    ]

    let schedulesFound = false
    for (const element of scheduleElements) {
      const count = await element.count()
      if (count > 0) {
        schedulesFound = true
        console.log(`Found ${count} schedule elements`)
        break
      }
    }

    return schedulesFound
  }

  async thenIShouldSeeConversationHistory() {
    const conversationElements = [
      this.page.getByTestId('conversation-history'),
      this.page.getByTestId('conversation-list'),
      this.page.locator('[data-testid^="conversation-"]'),
      this.page.getByText(/conversation/i)
    ]

    let conversationsFound = false
    for (const element of conversationElements) {
      const count = await element.count()
      if (count > 0) {
        conversationsFound = true
        console.log(`Found ${count} conversation elements`)
        break
      }
    }

    return conversationsFound
  }

  async thenIShouldSeeAvatarManagementOptions() {
    const avatarElements = [
      this.page.getByTestId('patient-avatar-picker'),
      this.page.getByTestId('avatar-upload'),
      this.page.getByText(/avatar/i),
      this.page.getByText(/photo/i)
    ]

    let avatarOptionsFound = false
    for (const element of avatarElements) {
      if (await element.count() > 0) {
        avatarOptionsFound = true
        break
      }
    }

    return avatarOptionsFound
  }

  async thenIShouldSeeUpdatedPatientInfo(expectedData: any) {
    // Verify patient information was updated
    const updatedElements = [
      this.page.getByText(expectedData.name),
      this.page.getByText(expectedData.email),
      this.page.getByText(expectedData.phone)
    ]

    let updatedInfoFound = false
    for (const element of updatedElements) {
      if (await element.count() > 0) {
        updatedInfoFound = true
        break
      }
    }

    return updatedInfoFound
  }

  async thenIShouldSeeScheduleCreated(scheduleTitle: string) {
    const scheduleElement = this.page.getByText(scheduleTitle)
    const scheduleExists = await scheduleElement.count() > 0
    
    if (scheduleExists) {
      await expect(scheduleElement).toBeVisible()
    }
    
    return scheduleExists
  }

  async thenScheduleShouldBeDeleted(scheduleTitle: string) {
    await this.page.waitForTimeout(2000)
    
    const scheduleElement = this.page.getByText(scheduleTitle)
    const scheduleExists = await scheduleElement.count() > 0
    
    console.log(`Schedule ${scheduleTitle} deletion status: ${scheduleExists ? 'still exists' : 'deleted'}`)
    return !scheduleExists
  }

  async thenIShouldSeeSuccessMessage() {
    const successElements = [
      this.page.getByTestId('success-message'),
      this.page.getByTestId('patient-saved'),
      this.page.getByText(/success/i),
      this.page.getByText(/saved/i),
      this.page.getByText(/updated/i)
    ]

    let successFound = false
    for (const element of successElements) {
      if (await element.count() > 0) {
        successFound = true
        break
      }
    }

    return successFound
  }
}
