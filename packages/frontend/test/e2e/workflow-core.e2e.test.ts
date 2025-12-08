import { test } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'

test.describe('Core Workflows - Essential User Journeys', () => {
  
  test('Workflow: Healthcare Provider Invalid Login Journey', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    
    // GIVEN: I am a healthcare provider who needs to log in
    await auth.givenIAmOnTheLoginScreen()
    
    // AND: I have incorrect credentials (common user error)
    const invalidCreds = await auth.givenIHaveInvalidCredentials()
    
    // WHEN: I attempt to log in with wrong credentials
    await auth.whenIEnterCredentials(invalidCreds.email, invalidCreds.password)
    await auth.whenIClickLoginButton()
    
    // THEN: I should receive clear error feedback
    await auth.thenIShouldSeeLoginError()
    
    // AND: I should remain on login screen to try again
    await auth.thenIShouldRemainOnLoginScreen()
  })

  test('Workflow: User Registration Validation Journey', async ({ page }) => {
    const auth = new AuthWorkflow(page)
    
    // GIVEN: I am a new user who wants to register
    await auth.givenIAmOnTheLoginScreen()
    
    // WHEN: I navigate to registration
    await auth.givenIAmOnTheRegisterScreen()
    
    // THEN: I should see the registration form is loaded - use data-testid
    await page.waitForSelector('input[data-testid="register-name"]', { timeout: 10000 })
    
    // AND: I should be able to interact with form fields - use data-testid
    await page.locator('input[data-testid="register-name"]').fill('Test User')
    await page.locator('input[data-testid="register-email"]').fill('test@example.com')
    
    // This workflow test verifies the form is functional
  })
})
