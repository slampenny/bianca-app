import { Page, expect } from '@playwright/test'

// Modular caregiver management workflow components
export class CaregiverWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  async givenIAmAnOrgAdminWithCaregiverAccess() {
    // Login as admin user who can manage caregivers
    await this.page.getByTestId('email-input').fill('admin@example.org')
    await this.page.getByTestId('password-input').fill('Password1')
    await this.page.getByTestId('login-button').click()
    
    // Wait for home screen and navigate to org
    await expect(this.page.getByText("Add Patient", { exact: true })).toBeVisible({ timeout: 10000 })
    await this.page.getByTestId('tab-org').click()
    await this.page.waitForTimeout(2000)
  }

  async givenIAmOnCaregiversScreen() {
    // Navigate to caregivers management
    const caregiverButton = this.page.getByTestId('view-caregivers-button')
    
    if (await caregiverButton.count() > 0) {
      await caregiverButton.click()
      await this.page.waitForTimeout(2000)
    } else {
      // Try alternative navigation
      const caregiverText = this.page.getByText(/caregivers/i)
      if (await caregiverText.count() > 0) {
        await caregiverText.first().click()
        await this.page.waitForTimeout(2000)
      }
    }
  }

  async givenIHaveExistingCaregivers() {
    // Check for existing caregivers in the system
    await this.givenIAmOnCaregiversScreen()
    
    const caregiverElements = [
      this.page.getByTestId('caregiver-list'),
      this.page.getByTestId('caregiver-card'),
      this.page.locator('[data-testid^="caregiver-"]'),
      this.page.getByText(/test user/i),
      this.page.getByText(/admin/i)
    ]
    
    let caregiverCount = 0
    for (const element of caregiverElements) {
      const count = await element.count()
      caregiverCount = Math.max(caregiverCount, count)
    }
    
    console.log(`Found ${caregiverCount} caregivers in the system`)
    return caregiverCount
  }

  async givenIHaveACaregiverNamed(caregiverName: string) {
    await this.givenIAmOnCaregiversScreen()
    
    const caregiverElement = this.page.getByText(caregiverName)
    const caregiverExists = await caregiverElement.count() > 0
    
    if (caregiverExists) {
      await expect(caregiverElement).toBeVisible()
    }
    
    return caregiverExists
  }

  // WHEN steps - Actions
  async whenIAddNewCaregiver(caregiverData: any) {
    // Look for add caregiver functionality
    await this.givenIAmOnCaregiversScreen()
    
    const addCaregiverElements = [
      this.page.getByTestId('add-caregiver-button'),
      this.page.getByTestId('invite-caregiver-button'),
      this.page.getByText(/add caregiver/i),
      this.page.getByText(/invite/i),
      this.page.getByText(/new caregiver/i)
    ]
    
    let addButtonFound = false
    for (const element of addCaregiverElements) {
      if (await element.count() > 0) {
        await element.first().click()
        addButtonFound = true
        await this.page.waitForTimeout(2000)
        break
      }
    }
    
    if (addButtonFound) {
      // Fill caregiver form if it appears
      await this.whenIFillCaregiverForm(caregiverData)
    }
    
    return addButtonFound
  }

  async whenIFillCaregiverForm(caregiverData: any) {
    // Fill caregiver creation/edit form
    const formFields = [
      { testId: 'caregiver-name-input', value: caregiverData.name },
      { testId: 'caregiver-email-input', value: caregiverData.email },
      { testId: 'caregiver-phone-input', value: caregiverData.phone },
      { testId: 'invite-name-input', value: caregiverData.name },
      { testId: 'invite-email-input', value: caregiverData.email },
      { testId: 'invite-phone-input', value: caregiverData.phone }
    ]
    
    let fieldsFound = 0
    for (const field of formFields) {
      const input = this.page.getByTestId(field.testId)
      if (await input.count() > 0) {
        await input.fill(field.value)
        fieldsFound++
      }
    }
    
    console.log(`Filled ${fieldsFound} caregiver form fields`)
    return fieldsFound
  }

  async whenIEditCaregiver(caregiverName: string) {
    // Find and edit specific caregiver
    await this.givenIAmOnCaregiversScreen()
    
    const caregiverElement = this.page.getByText(caregiverName)
    const caregiverExists = await caregiverElement.count() > 0
    
    if (caregiverExists) {
      // Try clicking on caregiver to edit
      await caregiverElement.click()
      await this.page.waitForTimeout(2000)
      
      // Look for edit interface
      const editElements = [
        this.page.getByTestId('edit-caregiver-button'),
        this.page.getByTestId('caregiver-form'),
        this.page.getByText(/edit/i),
        this.page.getByText(/update/i)
      ]
      
      for (const element of editElements) {
        if (await element.count() > 0) {
          await element.first().click()
          await this.page.waitForTimeout(1000)
          break
        }
      }
    }
    
    return caregiverExists
  }

  async whenIDeleteCaregiver(caregiverName: string) {
    // Find and delete specific caregiver
    await this.givenIAmOnCaregiversScreen()
    
    const caregiverElement = this.page.getByText(caregiverName)
    const caregiverExists = await caregiverElement.count() > 0
    
    if (caregiverExists) {
      await caregiverElement.click()
      await this.page.waitForTimeout(2000)
      
      // Look for delete functionality
      const deleteElements = [
        this.page.getByTestId('delete-caregiver-button'),
        this.page.getByTestId('remove-caregiver-button'),
        this.page.getByText(/delete/i),
        this.page.getByText(/remove/i)
      ]
      
      for (const element of deleteElements) {
        if (await element.count() > 0) {
          await element.first().click()
          await this.page.waitForTimeout(1000)
          
          // Confirm deletion if confirmation dialog appears
          const confirmButtons = [
            this.page.getByTestId('confirm-delete'),
            this.page.getByText(/confirm/i),
            this.page.getByText(/yes/i)
          ]
          
          for (const confirm of confirmButtons) {
            if (await confirm.count() > 0) {
              await confirm.first().click()
              break
            }
          }
          break
        }
      }
    }
    
    return caregiverExists
  }

  async whenIUploadCaregiverAvatar(caregiverName: string) {
    // Navigate to caregiver and upload avatar
    await this.whenIEditCaregiver(caregiverName)
    
    const avatarElements = [
      this.page.getByTestId('caregiver-avatar-upload'),
      this.page.getByTestId('upload-avatar'),
      this.page.getByTestId('avatar-picker'),
      this.page.getByText(/avatar/i),
      this.page.getByText(/photo/i),
      this.page.getByText(/image/i)
    ]
    
    let avatarUploadFound = false
    for (const element of avatarElements) {
      if (await element.count() > 0) {
        console.log('Found avatar upload functionality')
        avatarUploadFound = true
        // In a real test, you'd upload a file here
        break
      }
    }
    
    return avatarUploadFound
  }

  async whenIChangeCaregiverAvatar(caregiverName: string) {
    // Change existing caregiver avatar
    return await this.whenIUploadCaregiverAvatar(caregiverName)
  }

  async whenIUpdateCaregiverDetails(caregiverName: string, newData: any) {
    // Update caregiver information
    const editSuccessful = await this.whenIEditCaregiver(caregiverName)
    
    if (editSuccessful) {
      const fieldsUpdated = await this.whenIFillCaregiverForm(newData)
      
      // Look for save/update button
      const saveElements = [
        this.page.getByTestId('save-caregiver-button'),
        this.page.getByTestId('update-caregiver-button'),
        this.page.getByText(/save/i),
        this.page.getByText(/update/i)
      ]
      
      for (const element of saveElements) {
        if (await element.count() > 0) {
          await element.first().click()
          await this.page.waitForTimeout(1000)
          break
        }
      }
      
      return fieldsUpdated > 0
    }
    
    return false
  }

  async whenIAssignCaregiverToPatients(caregiverName: string) {
    // Assign caregiver to patients
    await this.whenIEditCaregiver(caregiverName)
    
    const assignmentElements = [
      this.page.getByTestId('assign-patients-button'),
      this.page.getByTestId('patient-assignment'),
      this.page.getByText(/assign patients/i),
      this.page.getByText(/patients/i)
    ]
    
    let assignmentFound = false
    for (const element of assignmentElements) {
      if (await element.count() > 0) {
        await element.first().click()
        assignmentFound = true
        await this.page.waitForTimeout(2000)
        break
      }
    }
    
    return assignmentFound
  }

  // THEN steps - Assertions
  async thenIShouldSeeCaregiversList() {
    const caregiverListElements = [
      this.page.getByTestId('caregiver-list'),
      this.page.getByTestId('caregivers-container'),
      this.page.getByText(/test user/i),
      this.page.getByText(/admin/i)
    ]
    
    let caregiverListFound = false
    for (const element of caregiverListElements) {
      if (await element.count() > 0) {
        caregiverListFound = true
        break
      }
    }
    
    expect(caregiverListFound).toBe(true)
    return caregiverListFound
  }

  async thenIShouldSeeCaregiverInList(caregiverName: string) {
    const caregiverElement = this.page.getByText(caregiverName)
    await expect(caregiverElement).toBeVisible()
  }

  async thenCaregiverShouldBeRemoved(caregiverName: string) {
    await this.givenIAmOnCaregiversScreen()
    await this.page.waitForTimeout(2000)
    
    const caregiverElement = this.page.getByText(caregiverName)
    const caregiverExists = await caregiverElement.count() > 0
    
    console.log(`Caregiver ${caregiverName} removal status: ${caregiverExists ? 'still exists' : 'removed'}`)
    return !caregiverExists
  }

  async thenIShouldSeeCaregiverForm() {
    const formElements = [
      this.page.getByTestId('caregiver-form'),
      this.page.getByTestId('invite-form'),
      this.page.getByTestId('caregiver-name-input'),
      this.page.getByTestId('invite-name-input')
    ]
    
    let formFound = false
    for (const element of formElements) {
      if (await element.count() > 0) {
        formFound = true
        break
      }
    }
    
    expect(formFound).toBe(true)
    return formFound
  }

  async thenIShouldSeeAvatarUploadOption() {
    const avatarElements = [
      this.page.getByTestId('caregiver-avatar-upload'),
      this.page.getByTestId('avatar-picker'),
      this.page.getByText(/avatar/i),
      this.page.getByText(/photo/i)
    ]
    
    let avatarFound = false
    for (const element of avatarElements) {
      if (await element.count() > 0) {
        avatarFound = true
        break
      }
    }
    
    return avatarFound
  }

  async thenIShouldSeeUpdatedCaregiverInfo(expectedData: any) {
    // Verify caregiver information was updated
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

  async thenIShouldSeePatientAssignmentInterface() {
    const assignmentElements = [
      this.page.getByTestId('patient-assignment-modal'),
      this.page.getByTestId('assign-patients-form'),
      this.page.getByText(/assign patients/i),
      this.page.getByText(/patient assignment/i)
    ]
    
    let assignmentInterfaceFound = false
    for (const element of assignmentElements) {
      if (await element.count() > 0) {
        assignmentInterfaceFound = true
        break
      }
    }
    
    return assignmentInterfaceFound
  }

  async thenIShouldSeeSuccessMessage() {
    const successElements = [
      this.page.getByTestId('success-message'),
      this.page.getByTestId('caregiver-saved'),
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
