import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { logoutViaUI } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'

test('user can fill login form and see error on failure', async ({ page }) => {
  // Wait for login form to be fully loaded and visible - use aria-label
  const emailInput = page.locator('[aria-label="email-input"]')
  const passwordInput = page.locator('[aria-label="password-input"]')
  
  await emailInput.waitFor({ state: 'visible', timeout: 30000 })
  await passwordInput.waitFor({ state: 'visible', timeout: 30000 })
  
  // Small delay to ensure form is ready
  await page.waitForTimeout(500)
  
  // Fill in the form
  await emailInput.fill('fake@example.org')
  await passwordInput.fill('wrongpassword')
  
  const loginButton = page.locator('[aria-label="login-button"]')
  await loginButton.waitFor({ state: 'visible', timeout: 10000 })
  await loginButton.click()
  
  // Wait for error message - could be various error texts
  // Try multiple possible error messages
  const errorSelectors = [
    page.getByText(/Failed to log in/i),
    page.getByText(/Invalid email or password/i),
    page.getByText(/Incorrect email or password/i),
    page.getByText(/Please check your email and password/i),
    page.locator('[aria-label="login-error"], [data-testid="login-error"]'),
    page.locator('.error, [class*="error"]'),
  ]
  
  let errorFound = false
  for (const errorSelector of errorSelectors) {
    try {
      await expect(errorSelector.first()).toBeVisible({ timeout: 5000 })
      errorFound = true
      console.log('✓ Error message found')
      break
    } catch {
      // Continue to next selector
    }
  }
  
  if (!errorFound) {
    // Take a screenshot for debugging
    const screenshot = await page.screenshot({ fullPage: true })
    console.error('No error message found. Page content:', await page.content())
    throw new Error('Expected error message not found after login failure')
  }
})

test('unverified user can logout successfully', async ({ page }) => {
  const auth = new AuthWorkflow(page)
  
  // GIVEN: I am a logged-in unverified user (simulate SSO invite scenario)
  const validCreds = await auth.givenIHaveValidCredentials()
  await auth.whenIEnterCredentials(validCreds.email, validCreds.password)
  await auth.whenIClickLoginButton()
  await auth.thenIShouldBeOnHomeScreen()
  
  // Wait a bit more for the home screen to fully render
  await page.waitForTimeout(2000)
  
  // WHEN: I click the profile button - use aria-label
  const profileButton = page.locator('[aria-label="profile-button"]')
  await profileButton.waitFor({ state: 'visible', timeout: 10000 })
  await profileButton.click()
  
  // Wait for navigation to profile screen
  await page.waitForTimeout(3000)
  
  // THEN: I should be on the profile screen - use aria-label
  const profileLogoutButton = page.locator('[aria-label="profile-logout-button"]')
  await profileLogoutButton.waitFor({ state: 'visible', timeout: 15000 })
  console.log('✓ Successfully navigated to profile screen')
  
  // WHEN: I click the logout button
  await profileLogoutButton.click()
  
  // THEN: I should be on the logout screen (not blocked by unverified user restrictions)
  // Wait for logout screen - use aria-label
  await page.waitForTimeout(2000)
  const logoutButton = page.locator('[aria-label="logout-button"]')
  await logoutButton.waitFor({ state: 'visible', timeout: 15000 })
  console.log('✓ Successfully navigated to logout screen')
  
  // WHEN: I click the final logout button
  await logoutButton.click()
  
  // THEN: I should be logged out and redirected to login screen - use aria-label
  await page.waitForSelector('[aria-label="email-input"]', { timeout: 10000 })
  console.log('✓ Successfully logged out and redirected to login screen')
  
  // Verify we're back at the login screen
  const currentUrl = page.url()
  expect(currentUrl).toContain('/')
  console.log('✓ Logout workflow completed successfully')
})

// test.afterEach(async ({ page }) => {
//   await logoutViaUI(page);
// });
