import { test, expect } from '@playwright/test'

test('user can fill login form and see error on failure', async ({ page }) => {
  await page.goto('/')

  await page.getByTestId('email-input').fill('fake@example.org')
  await page.getByTestId('password-input').fill('wrongpassword')
  await page.getByTestId('login-button').click()

  const errorText = page.getByText(/Failed to log in/i)
  await expect(errorText).toBeVisible()
})
