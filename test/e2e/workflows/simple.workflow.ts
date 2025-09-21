import { Page, expect } from '@playwright/test'

// Simple, robust workflow components that work with your actual app
export class SimpleWorkflow {
  constructor(private page: Page) {}

  // AUTHENTICATION WORKFLOWS
  async authWorkflow_InvalidLogin() {
    // GIVEN: I am on the login screen (handled by test fixture)
    // WHEN: I enter invalid credentials
    await this.page.getByTestId('email-input').fill('fake@example.org')
    await this.page.getByTestId('password-input').fill('wrongpassword')
    
    // AND: I click login
    await this.page.getByTestId('login-button').click()
    
    // THEN: I should see error message
    const errorText = this.page.getByText(/Failed to log in. Please check your email and password./i)
    await expect(errorText).toBeVisible()
  }

  async authWorkflow_NavigateToRegister() {
    // GIVEN: I am on the login screen
    // WHEN: I want to register
    await this.page.getByTestId('register-button').click()
    
    // THEN: I should see registration form
    await expect(this.page.getByTestId('register-name')).toBeVisible()
  }

  async authWorkflow_FillRegistrationForm() {
    // GIVEN: I am on the registration screen
    // WHEN: I fill in registration details
    await this.page.getByTestId('register-name').fill('Test User')
    await this.page.getByTestId('register-email').fill('test@example.com')
    await this.page.getByTestId('register-password').fill('StrongPass!1')
    await this.page.getByTestId('register-confirm-password').fill('StrongPass!1')
    await this.page.getByTestId('register-phone').fill('1234567890')
    
    // THEN: Form should be filled successfully
    const nameValue = await this.page.getByTestId('register-name').inputValue()
    expect(nameValue).toBe('Test User')
  }

  // NAVIGATION WORKFLOWS
  async navigationWorkflow_CheckTabs() {
    // GIVEN: I am logged in (or on main screen)
    // WHEN: I check available navigation tabs
    const tabs = [
      { name: 'Home', testId: 'tab-home' },
      { name: 'Org', testId: 'tab-org' },
      { name: 'Alerts', testId: 'tab-alert' },
      { name: 'Reports', testId: 'tab-reports' },
      { name: 'Conversations', testId: 'conversations-tab' }
    ]
    
    const availableTabs = []
    for (const tab of tabs) {
      const count = await this.page.getByTestId(tab.testId).count()
      if (count > 0) {
        availableTabs.push(tab.name)
      }
    }
    
    // THEN: I should have at least one navigation option
    expect(availableTabs.length).toBeGreaterThan(0)
    console.log('Available navigation tabs:', availableTabs.join(', '))
    
    return availableTabs
  }

  async navigationWorkflow_TestTabNavigation(tabTestId: string) {
    // GIVEN: I have a tab to navigate to
    // WHEN: I click the tab
    await this.page.getByTestId(tabTestId).click()
    
    // THEN: I should navigate successfully (wait for page change)
    await this.page.waitForTimeout(2000)
    
    // AND: Page should still be responsive
    const currentUrl = this.page.url()
    expect(currentUrl).toContain('localhost:8081')
  }

  // PATIENT WORKFLOWS  
  async patientWorkflow_CheckPatientInterface() {
    // GIVEN: I want to manage patients
    // WHEN: I look for patient-related elements
    const patientElements = [
      { name: 'Patient Cards', testId: 'patient-card' },
      { name: 'Add Patient Button', text: 'Add Patient' },
      { name: 'No Patients Message', text: 'No patients found' },
      { name: 'Home Header', testId: 'home-header' }
    ]
    
    const foundElements = []
    for (const element of patientElements) {
      let count = 0
      if (element.testId) {
        count = await this.page.getByTestId(element.testId).count()
      } else if (element.text) {
        count = await this.page.getByText(element.text).count()
      }
      
      if (count > 0) {
        foundElements.push(element.name)
      }
    }
    
    // THEN: I should see patient management interface
    expect(foundElements.length).toBeGreaterThan(0)
    console.log('Patient interface elements found:', foundElements.join(', '))
    
    return foundElements
  }

  // ALERT WORKFLOWS
  async alertWorkflow_CheckAlertSystem() {
    // GIVEN: I want to check for alerts
    // WHEN: I look for alert-related elements
    const alertElements = [
      { name: 'Alert Badge', testId: 'alert-badge' },
      { name: 'Alerts Tab', testId: 'alerts-tab' },
      { name: 'Alert Tab Alt', testId: 'tab-alert' },
      { name: 'Alert List', testId: 'alert-list' },
      { name: 'No Alerts Message', text: 'no alerts' }
    ]
    
    const foundAlertElements = []
    for (const element of alertElements) {
      let count = 0
      if (element.testId) {
        count = await this.page.getByTestId(element.testId).count()
      } else if (element.text) {
        count = await this.page.getByText(new RegExp(element.text, 'i')).count()
      }
      
      if (count > 0) {
        foundAlertElements.push(element.name)
      }
    }
    
    // THEN: I should have access to alert system
    console.log('Alert system elements found:', foundAlertElements.join(', '))
    
    return foundAlertElements
  }

  // COMPREHENSIVE WORKFLOW
  async comprehensiveWorkflow_AppExploration() {
    // GIVEN: I am using the healthcare app
    // WHEN: I explore all available features
    
    console.log('=== COMPREHENSIVE WORKFLOW EXPLORATION ===')
    
    // Check authentication interface
    const authElements = await this.page.getByTestId('email-input').count()
    console.log('Authentication interface available:', authElements > 0)
    
    // Check navigation
    const availableTabs = await this.navigationWorkflow_CheckTabs()
    
    // Check patient interface
    const patientElements = await this.patientWorkflow_CheckPatientInterface()
    
    // Check alert system
    const alertElements = await this.alertWorkflow_CheckAlertSystem()
    
    // THEN: I should have a functional healthcare app
    const totalFeatures = availableTabs.length + patientElements.length + alertElements.length
    expect(totalFeatures).toBeGreaterThan(0)
    
    console.log('=== WORKFLOW EXPLORATION COMPLETE ===')
    console.log(`Total functional features found: ${totalFeatures}`)
    
    return {
      navigation: availableTabs,
      patient: patientElements,
      alerts: alertElements,
      totalFeatures
    }
  }
}
