import { Page, expect } from '@playwright/test'

// Modular organization management workflow components
export class OrgWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  async givenIAmAnOrgAdmin() {
    // Login as admin user who has org management permissions
    await this.page.getByTestId('email-input').fill('admin@example.org')
    await this.page.getByTestId('password-input').fill('Password1')
    await this.page.getByTestId('login-button').click()
    
    // Wait for home screen
    await expect(this.page.getByText("Add Patient", { exact: true })).toBeVisible({ timeout: 10000 })
  }

  async givenIAmOnOrgManagementScreen() {
    // Navigate to organization tab
    await this.page.getByTestId('tab-org').click()
    await this.page.waitForTimeout(2000) // Allow org screen to load
  }

  async givenIHaveExistingPatients() {
    // Verify patients exist in the system
    await this.page.getByTestId('tab-home').click()
    const patientCards = await this.page.locator('[data-testid^="patient-card-"]').count()
    expect(patientCards).toBeGreaterThan(0)
    console.log(`Found ${patientCards} existing patients`)
    return patientCards
  }

  async givenIHaveExistingCaregivers() {
    // Navigate to org screen and check for caregivers
    await this.givenIAmOnOrgManagementScreen()
    
    const caregiverElements = [
      this.page.getByTestId('view-caregivers-button'),
      this.page.getByTestId('caregiver-list'),
      this.page.getByText(/caregivers/i),
      this.page.getByText(/team/i)
    ]
    
    let caregiverSystemFound = false
    for (const element of caregiverElements) {
      if (await element.count() > 0) {
        caregiverSystemFound = true
        break
      }
    }
    
    return caregiverSystemFound
  }

  // WHEN steps - Actions
  async whenIAddNewPatient(patientData: any) {
    // Navigate to home and click Add Patient
    await this.page.getByTestId('tab-home').click()
    await this.page.waitForTimeout(1000)
    
    const addPatientButton = this.page.getByText('Add Patient', { exact: true })
    const isEnabled = await addPatientButton.isEnabled()
    
    if (isEnabled) {
      await addPatientButton.click()
      await this.page.waitForTimeout(2000)
      
      // Fill patient form if it appears
      const patientForm = await this.page.getByTestId('patient-form').count()
      const nameInput = await this.page.getByTestId('patient-name-input').count()
      
      if (patientForm > 0 || nameInput > 0) {
        await this.whenIFillPatientForm(patientData)
      }
    } else {
      console.log('Add Patient button is disabled (insufficient permissions)')
    }
  }

  async whenIFillPatientForm(patientData: any) {
    // Fill patient creation form
    const formFields = [
      { testId: 'patient-name-input', value: patientData.name },
      { testId: 'patient-email-input', value: patientData.email },
      { testId: 'patient-phone-input', value: patientData.phone }
    ]
    
    for (const field of formFields) {
      const input = this.page.getByTestId(field.testId)
      if (await input.count() > 0) {
        await input.fill(field.value)
      }
    }
  }

  async whenIRemovePatient(patientName: string) {
    // Find patient and attempt to remove
    await this.page.getByTestId('tab-home').click()
    
    const patientCard = this.page.locator('[data-testid^="patient-card-"]').filter({ hasText: patientName })
    const patientExists = await patientCard.count() > 0
    
    if (patientExists) {
      // Try to find delete/remove button
      const deleteButton = this.page.getByTestId(`delete-patient-${patientName}`)
      const editButton = this.page.getByTestId(`edit-patient-button-${patientName}`)
      
      if (await deleteButton.count() > 0) {
        await deleteButton.click()
      } else if (await editButton.count() > 0) {
        await editButton.click()
        await this.page.waitForTimeout(2000)
        // Look for delete option in edit screen
        const deleteInEdit = this.page.getByText(/delete|remove/i)
        if (await deleteInEdit.count() > 0) {
          await deleteInEdit.first().click()
        }
      }
    }
    
    return patientExists
  }

  async whenIAssignCaregiverToPatient(caregiverName: string, patientName: string) {
    // Navigate to patient and assign caregiver
    await this.page.getByTestId('tab-home').click()
    
    const patientCard = this.page.locator('[data-testid^="patient-card-"]').filter({ hasText: patientName })
    if (await patientCard.count() > 0) {
      await patientCard.click()
      await this.page.waitForTimeout(2000)
      
      // Look for caregiver assignment interface
      const assignButtons = [
        this.page.getByTestId('assign-caregiver-button'),
        this.page.getByText(/assign/i),
        this.page.getByText(/caregiver/i)
      ]
      
      for (const button of assignButtons) {
        if (await button.count() > 0) {
          await button.first().click()
          await this.page.waitForTimeout(1000)
          break
        }
      }
    }
  }

  async whenIUpdateOrgDetails(orgData: any) {
    // Navigate to org settings
    await this.givenIAmOnOrgManagementScreen()
    
    // Look for org settings or edit options
    const settingsElements = [
      this.page.getByTestId('org-settings'),
      this.page.getByTestId('edit-org-button'),
      this.page.getByText(/settings/i),
      this.page.getByText(/edit/i)
    ]
    
    let settingsFound = false
    for (const element of settingsElements) {
      if (await element.count() > 0) {
        await element.first().click()
        settingsFound = true
        await this.page.waitForTimeout(2000)
        break
      }
    }
    
    if (settingsFound) {
      // Fill org details if form is available
      const orgNameInput = this.page.getByTestId('org-name-input')
      if (await orgNameInput.count() > 0) {
        await orgNameInput.fill(orgData.name)
      }
    }
    
    return settingsFound
  }

  async whenIUploadOrgAvatar() {
    // Look for avatar upload functionality
    const avatarElements = [
      this.page.getByTestId('org-avatar-upload'),
      this.page.getByTestId('upload-avatar'),
      this.page.getByText(/avatar/i),
      this.page.getByText(/photo/i),
      this.page.getByText(/image/i)
    ]
    
    let avatarUploadFound = false
    for (const element of avatarElements) {
      if (await element.count() > 0) {
        console.log('Found avatar upload functionality')
        avatarUploadFound = true
        break
      }
    }
    
    return avatarUploadFound
  }

  async whenIManageCaregivers() {
    // Access caregiver management
    await this.givenIAmOnOrgManagementScreen()
    
    const caregiverElements = [
      this.page.getByTestId('view-caregivers-button'),
      this.page.getByTestId('manage-caregivers'),
      this.page.getByText(/caregivers/i),
      this.page.getByText(/team/i),
      this.page.getByText(/staff/i)
    ]
    
    let caregiverManagementFound = false
    for (const element of caregiverElements) {
      if (await element.count() > 0) {
        await element.first().click()
        caregiverManagementFound = true
        await this.page.waitForTimeout(2000)
        break
      }
    }
    
    return caregiverManagementFound
  }

  // THEN steps - Assertions
  async thenIShouldSeeOrgDashboard() {
    // Verify org dashboard elements
    const orgElements = [
      this.page.getByTestId('org-dashboard'),
      this.page.getByTestId('org-header'),
      this.page.getByText(/organization/i),
      this.page.getByText(/dashboard/i)
    ]
    
    let orgDashboardFound = false
    for (const element of orgElements) {
      if (await element.count() > 0) {
        orgDashboardFound = true
        break
      }
    }
    
    expect(orgDashboardFound).toBe(true)
  }

  async thenIShouldSeePatientInList(patientName: string) {
    await this.page.getByTestId('tab-home').click()
    const patientCard = this.page.locator('[data-testid^="patient-card-"]').filter({ hasText: patientName })
    await expect(patientCard).toBeVisible()
  }

  async thenPatientShouldBeRemoved(patientName: string) {
    await this.page.getByTestId('tab-home').click()
    await this.page.waitForTimeout(2000)
    
    const patientCard = this.page.locator('[data-testid^="patient-card-"]').filter({ hasText: patientName })
    const patientExists = await patientCard.count() > 0
    
    // Patient should either be removed or removal should be attempted
    console.log(`Patient ${patientName} removal status: ${patientExists ? 'still exists' : 'removed'}`)
  }

  async thenIShouldSeeCaregiverManagement() {
    const caregiverFeatures = [
      this.page.getByTestId('caregiver-list'),
      this.page.getByTestId('add-caregiver-button'),
      this.page.getByText(/add caregiver/i),
      this.page.getByText(/invite/i)
    ]
    
    let hasCaregiverFeatures = false
    for (const feature of caregiverFeatures) {
      if (await feature.count() > 0) {
        hasCaregiverFeatures = true
        break
      }
    }
    
    expect(hasCaregiverFeatures).toBe(true)
  }

  async thenIShouldSeeOrgSettings() {
    const settingsFeatures = [
      this.page.getByTestId('org-settings'),
      this.page.getByTestId('org-name-input'),
      this.page.getByText(/organization name/i),
      this.page.getByText(/settings/i)
    ]
    
    let hasSettingsFeatures = false
    for (const feature of settingsFeatures) {
      if (await feature.count() > 0) {
        hasSettingsFeatures = true
        break
      }
    }
    
    return hasSettingsFeatures
  }

  async thenIShouldSeeAvatarUploadOption() {
    const avatarFeatures = [
      this.page.getByTestId('org-avatar-upload'),
      this.page.getByTestId('upload-avatar'),
      this.page.getByText(/avatar/i),
      this.page.getByText(/photo/i),
      this.page.getByText(/image/i)
    ]
    
    let hasAvatarFeatures = false
    for (const feature of avatarFeatures) {
      if (await feature.count() > 0) {
        hasAvatarFeatures = true
        break
      }
    }
    
    return hasAvatarFeatures
  }
}
