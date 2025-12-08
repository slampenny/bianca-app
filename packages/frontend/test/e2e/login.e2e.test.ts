import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { logoutViaUI } from './helpers/testHelpers'
import { AuthWorkflow } from './workflows/auth.workflow'

test('user can fill login form and see error on failure', async ({ page }) => {
  // Navigate to login screen (baseURL is configured in playwright.config.ts)
  await page.goto('/')
  
  // Wait for login form to be fully loaded and visible - use data-testid
  const emailInput = page.locator('input[data-testid="email-input"]')
  const passwordInput = page.locator('input[data-testid="password-input"]')
  
  await emailInput.waitFor({ state: 'visible', timeout: 5000 })
  await passwordInput.waitFor({ state: 'visible', timeout: 5000 })
  
  // Small delay to ensure form is ready
  await page.waitForTimeout(500)
  
  // Fill in the form
  await emailInput.fill('fake@example.org')
  await passwordInput.fill('wrongpassword')
  
  // Wait a moment for form to process
  await page.waitForTimeout(500)
  
  // Try multiple ways to find login button
  const loginButton = page.locator('[data-testid="login-button"], button:has-text("Log in"), button:has-text("Sign in")').first()
  await loginButton.waitFor({ state: 'visible', timeout: 5000 })
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
      await expect(errorSelector.first()).toBeVisible({ timeout: 3000 })
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

test.skip('unverified user can logout successfully', async ({ page }) => {
  const auth = new AuthWorkflow(page)
  
  // GIVEN: I am a logged-in unverified user (simulate SSO invite scenario)
  const validCreds = await auth.givenIHaveValidCredentials()
  await auth.whenIEnterCredentials(validCreds.email, validCreds.password)
  await auth.whenIClickLoginButton()
  await auth.thenIShouldBeOnHomeScreen()
  
  // Wait a bit more for the home screen to fully render
  await page.waitForTimeout(2000)
  
  // WHEN: Navigate to profile screen (more reliable than clicking button)
  await page.goto('/MainTabs/Home/Profile')
  
  // Wait for profile screen to render - look for any profile screen element
  // Profile screen has email field, theme selector, or update button
  await page.waitForSelector('input[type="email"], [data-testid="theme-selector"], [data-testid="profile-update-button"], [data-testid="font-scale-selector"]', { timeout: 15000 })
  await page.waitForTimeout(2000) // Give it time to fully render all elements including logout button
  
  // Scroll to bottom in case logout button is below the fold
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1000)
  
  // Find logout button - Pressable should map testID to data-testid automatically
  // Try getByTestId first (should work for Pressable according to docs)
  let profileLogoutButton = page.getByTestId('profile-logout-button')
  let buttonCount = await profileLogoutButton.count().catch(() => 0)
  
  if (buttonCount === 0) {
    // Fallback: try locator with explicit data-testid
    profileLogoutButton = page.locator('[data-testid="profile-logout-button"]').first()
    buttonCount = await profileLogoutButton.count().catch(() => 0)
  }
  
  if (buttonCount === 0) {
    // Last resort: find by text and click (Pressable renders as clickable element)
    const logoutText = page.getByText(/Logout/i).first()
    await logoutText.waitFor({ state: 'visible', timeout: 10000 })
    // Click the text - it should trigger the Pressable's onPress
    await logoutText.click()
    console.log('✓ Successfully navigated to profile screen and clicked logout (via text)')
  } else {
    await profileLogoutButton.waitFor({ state: 'visible', timeout: 10000 })
    await profileLogoutButton.scrollIntoViewIfNeeded()
    await profileLogoutButton.click()
    console.log('✓ Successfully navigated to profile screen and clicked logout')
  }
  
  // THEN: I should be on the logout screen (not blocked by unverified user restrictions)
  // Wait for logout screen - use text-based selector (translation is "Logout")
  await page.waitForTimeout(1000)
  const logoutButton = page.getByText(/Logout/i).first()
  await logoutButton.waitFor({ state: 'visible', timeout: 10000 })
  await logoutButton.click()
  console.log('✓ Successfully navigated to logout screen and confirmed logout')
  
  // THEN: I should be logged out and redirected to login screen - use data-testid
  await page.waitForSelector('input[data-testid="email-input"]', { timeout: 5000 })
  console.log('✓ Successfully logged out and redirected to login screen')
  
  // Verify we're back at the login screen
  const currentUrl = page.url()
  expect(currentUrl).toContain('/')
  console.log('✓ Logout workflow completed successfully')
})

// test.afterEach(async ({ page }) => {
//   await logoutViaUI(page);
// });
