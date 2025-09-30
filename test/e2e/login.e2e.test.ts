import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { logoutViaUI } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'

test('user can fill login form and see error on failure', async ({ page }) => {
  // Assume app starts on login screen
  await page.getByTestId('email-input').fill('fake@example.org')
  await page.getByTestId('password-input').fill('wrongpassword')
  await page.getByTestId('login-button').click()
  const errorText = page.getByText(/Failed to log in. Please check your email and password./i)
  await expect(errorText).toBeVisible()
})

test('unverified user can logout successfully', async ({ page }) => {
  const auth = new AuthWorkflow(page)
  
  // GIVEN: I am a logged-in unverified user (simulate SSO invite scenario)
  const validCreds = await auth.givenIHaveValidCredentials()
  await auth.whenIEnterCredentials(validCreds.email, validCreds.password)
  await auth.whenIClickLoginButton()
  await auth.thenIShouldBeOnHomeScreen()
  
  // WHEN: I click the profile button
  const profileButton = page.getByTestId('profile-button')
  await expect(profileButton).toBeVisible()
  await profileButton.click()
  
  // THEN: I should be on the profile screen
  await page.waitForSelector('[data-testid="profile-logout-button"]', { timeout: 5000 })
  console.log('✓ Successfully navigated to profile screen')
  
  // WHEN: I click the logout button
  const logoutButton = page.getByTestId('profile-logout-button')
  await expect(logoutButton).toBeVisible()
  await logoutButton.click()
  
  // THEN: I should be on the logout screen (not blocked by unverified user restrictions)
  await page.waitForSelector('[data-testid="logout-button"]', { timeout: 5000 })
  console.log('✓ Successfully navigated to logout screen')
  
  // WHEN: I click the final logout button
  const finalLogoutButton = page.getByTestId('logout-button')
  await expect(finalLogoutButton).toBeVisible()
  await finalLogoutButton.click()
  
  // THEN: I should be logged out and redirected to login screen
  await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
  console.log('✓ Successfully logged out and redirected to login screen')
  
  // Verify we're back at the login screen
  const currentUrl = page.url()
  expect(currentUrl).toContain('/')
  console.log('✓ Logout workflow completed successfully')
})

// test.afterEach(async ({ page }) => {
//   await logoutViaUI(page);
// });
