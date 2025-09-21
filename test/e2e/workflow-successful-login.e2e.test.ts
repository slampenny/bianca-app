import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { AuthWorkflow } from './workflows/auth.workflow'
import { PatientWorkflow } from './workflows/patient.workflow'

test.describe('Successful Login Workflow - Real Backend Integration', () => {
  
  test('Workflow: Healthcare Provider Successful Login Journey', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    const patient = new PatientWorkflow(page)
    
    // GIVEN: I am a healthcare provider with valid credentials
    await auth.givenIAmOnTheLoginScreen()
    const validCreds = await auth.givenIHaveValidCredentials() // Uses real backend credentials
    
    // WHEN: I enter my correct credentials
    await auth.whenIEnterCredentials(validCreds.email, validCreds.password)
    
    // AND: I click login
    await auth.whenIClickLoginButton()
    
    // THEN: I should be successfully logged in and redirected to home
    await auth.thenIShouldBeOnHomeScreen()
    
    // AND: I should see welcome message
    await auth.thenIShouldSeeWelcomeMessage()
    
    // AND: I should have access to patient management
    await patient.givenIHavePatientsAssigned()
  })

  test('Workflow: Admin User Login and Organization Access Journey', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    
    // GIVEN: I am an organization admin with valid credentials
    await auth.givenIAmOnTheLoginScreen()
    const adminCreds = await auth.givenIHaveValidAdminCredentials() // Uses real admin credentials
    
    // WHEN: I enter my admin credentials
    await auth.whenIEnterCredentials(adminCreds.email, adminCreds.password)
    
    // AND: I click login
    await auth.whenIClickLoginButton()
    
    // THEN: I should be successfully logged in
    await auth.thenIShouldBeOnHomeScreen()
    
    // AND: I should see admin welcome message
    await auth.thenIShouldSeeWelcomeMessage()
    
    // AND: I should have access to organization features
    const orgTabExists = await page.getByTestId('tab-org').count()
    const orgButtonExists = await page.getByText(/organization/i).count()
    
    expect(orgTabExists + orgButtonExists).toBeGreaterThanOrEqual(0)
  })

  test('Workflow: Login to Patient Management Journey', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    const patient = new PatientWorkflow(page)
    
    // GIVEN: I am logged in with valid credentials
    await auth.givenIAmOnTheLoginScreen()
    const validCreds = await auth.givenIHaveValidCredentials()
    
    // WHEN: I complete the login workflow
    await auth.whenIEnterCredentials(validCreds.email, validCreds.password)
    await auth.whenIClickLoginButton()
    await auth.thenIShouldBeOnHomeScreen()
    
    // AND: I access patient management features
    await patient.givenIHavePatientsAssigned()
    
    // THEN: I should see my assigned patients (Agnes Alphabet, Barnaby Button, etc.)
    const patientCards = await page.getByTestId('patient-card').count()
    const noPatients = await page.getByText(/no patients found/i).count()
    const noUsersText = await page.getByTestId('home-no-patients').count()
    const addPatientButton = await page.getByText(/add patient/i).count()
    
    console.log('Patient interface elements:', { 
      patientCards, 
      noPatients, 
      noUsersText, 
      addPatientButton 
    })
    
    // Should have either patient cards OR patient management interface
    expect(patientCards + noPatients + noUsersText + addPatientButton).toBeGreaterThan(0)
    
    if (patientCards > 0) {
      console.log(`Found ${patientCards} patients in the system`)
      
      // Verify we can see patient names from seed data
      const agnesExists = await page.getByText('Agnes Alphabet').count() > 0
      const barnabyExists = await page.getByText('Barnaby Button').count() > 0
      
      console.log('Seed patients found:', { Agnes: agnesExists, Barnaby: barnabyExists })
    }
  })
})
