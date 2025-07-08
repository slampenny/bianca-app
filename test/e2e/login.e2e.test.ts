import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { logoutViaUI } from './helpers/testHelpers'

test('user can fill login form and see error on failure', async ({ page }) => {
  // Assume app starts on login screen
  await page.getByTestId('email-input').fill('fake@example.org')
  await page.getByTestId('password-input').fill('wrongpassword')
  await page.getByTestId('login-button').click()
  const errorText = page.getByText(/Failed to log in. Please check your email and password./i)
  await expect(errorText).toBeVisible()
})

// test.afterEach(async ({ page }) => {
//   await logoutViaUI(page);
// });
