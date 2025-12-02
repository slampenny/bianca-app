import { Page, expect } from '@playwright/test'

// Modular authentication workflow components
export class AuthWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  async givenIAmOnTheLoginScreen() {
    // Navigate to the app and wait for login screen (baseURL is configured in playwright.config.ts)
    await this.page.goto('/')
    
    // Check if already logged in
    const emailInput = this.page.locator('input[data-testid="email-input"]')
    const isOnLogin = await emailInput.isVisible({ timeout: 2000 }).catch(() => false)
    
    if (!isOnLogin) {
      // Already logged in, try to log out first
      try {
        // Look for profile button or any logout mechanism
        const profileButton = this.page.getByTestId('profile-button')
        if (await profileButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await profileButton.click()
          await this.page.waitForTimeout(1000)
          // Look for logout button
          const logoutButton = this.page.getByText(/log out/i).or(this.page.getByTestId('logout-button'))
          if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await logoutButton.click()
            await this.page.waitForTimeout(2000)
            // Navigate back to home to trigger login screen
            await this.page.goto('/')
          }
        }
      } catch (error) {
        console.log('Could not log out, trying to navigate to login:', error)
        // Force navigation to login by going to root
        await this.page.goto('/')
        await this.page.waitForTimeout(1000)
      }
    }
    
    // Now wait for login screen
    await this.page.waitForSelector('input[data-testid="email-input"]', { timeout: 10000 })
  }

  async givenIHaveValidCredentials() {
    return {
      email: 'fake@example.org',  // From backend caregiver fixture
      password: 'Password1'       // From backend caregiver fixture
    }
  }

  async givenIHaveValidAdminCredentials() {
    return {
      email: 'playwright@example.org', // From backend playwrightTestUser fixture (orgAdmin role, MFA disabled)
      password: 'Password1'            // From backend caregiver fixture
    }
  }

  async givenIHaveInvalidCredentials() {
    return {
      email: 'fake@example.org',
      password: 'wrongpassword'
    }
  }

  async givenIAmOnTheRegisterScreen() {
    // Use data-testid for React Native Web
    await this.page.getByTestId('register-button').click()
    await this.page.waitForSelector('input[data-testid="register-name"]', { timeout: 10000 })
  }

  async givenIHaveRegistrationData() {
    return {
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@clinic.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      phone: '+1-555-0123',
      organizationName: 'Johnson Family Clinic'
    }
  }

  // WHEN steps - Actions
  async whenIEnterCredentials(email: string, password: string) {
    await this.page.fill('input[data-testid="email-input"]', email)
    await this.page.fill('input[data-testid="password-input"]', password)
  }

  async whenIClickLoginButton() {
    // Try multiple selectors for login button
    let loginButton = this.page.getByTestId('login-button')
    let buttonCount = await loginButton.count().catch(() => 0)
    
    if (buttonCount === 0) {
      loginButton = this.page.locator('[data-testid="login-button"]').first()
      buttonCount = await loginButton.count().catch(() => 0)
    }
    
    if (buttonCount === 0) {
      // Last resort: try to find by text
      loginButton = this.page.getByText(/log in/i).first()
      buttonCount = await loginButton.count().catch(() => 0)
    }
    
    if (buttonCount === 0) {
      throw new Error('Login button not found')
    }
    
    await loginButton.waitFor({ state: 'visible', timeout: 10000 })
    await loginButton.click()
  }

  async whenIClickRegisterButton() {
    let submitButton = this.page.getByTestId('register-submit')
    let buttonCount = await submitButton.count().catch(() => 0)
    if (buttonCount === 0) {
      submitButton = this.page.locator('[data-testid="register-submit"]').first()
    }
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    await submitButton.click()
  }

  async whenIFillRegistrationForm(data: any) {
    // Use data-testid for TextField inputs (TextField needs input[data-testid="..."] pattern)
    await this.page.locator('input[data-testid="register-name"]').fill(data.name)
    await this.page.locator('input[data-testid="register-email"]').fill(data.email)
    await this.page.locator('input[data-testid="register-password"]').fill(data.password)
    await this.page.locator('input[data-testid="register-confirm-password"]').fill(data.confirmPassword)
    await this.page.locator('input[data-testid="register-phone"]').fill(data.phone)
    if (data.organizationName) {
      // Switch to organization account type first
      await this.page.getByTestId('register-organization-toggle').click()
      await this.page.locator('input[data-testid="register-org-name"]').fill(data.organizationName)
    }
  }

  async whenIClickForgotPassword() {
    await this.page.getByTestId('forgot-password-link').click()
  }

  async whenIEnterEmailForReset(email: string) {
    await this.page.getByTestId('reset-email-input').fill(email)
  }

  async whenIClickSendResetLink() {
    await this.page.getByTestId('send-reset-button').click()
  }

  // THEN steps - Assertions
  async thenIShouldSeeLoginError() {
    // Try multiple possible error message patterns
    const errorSelectors = [
      this.page.getByText(/Failed to log in/i),
      this.page.getByText(/Invalid email or password/i),
      this.page.getByText(/Please check your email and password/i),
      this.page.locator('[data-testid="login-error"]'),
      this.page.locator('.error, [class*="error"]'),
    ]
    
    let found = false
    for (const errorSelector of errorSelectors) {
      try {
        await expect(errorSelector.first()).toBeVisible({ timeout: 5000 })
        found = true
        break
      } catch {
        // Continue to next selector
      }
    }
    
    if (!found) {
      throw new Error('Expected login error message not found')
    }
  }

  async thenIShouldBeOnHomeScreen() {
    // Wait for home screen to load - look for home header or add patient button
    await this.page.waitForTimeout(3000)
    
    // Check if we're on MFA verification screen (user might have MFA enabled)
    const mfaScreen = await this.page.locator('[data-testid="mfa-verification-screen"]').isVisible({ timeout: 2000 }).catch(() => false)
    if (mfaScreen) {
      // User has MFA enabled - we need to complete MFA verification
      // For now, we'll use a backup code if available, or skip this test
      // In a real scenario, we'd need to generate a valid TOTP token
      console.log('User has MFA enabled - attempting to verify with backup code or mock token')
      
      // Try to find backup codes or use a mock token
      // Note: This will likely fail with invalid token, but we'll handle that
      // Use data-testid for TextField inputs (TextField needs input[data-testid="..."] pattern)
      const mfaTokenInput = this.page.locator('input[data-testid="mfa-token-input"]')
      let verifyButton = this.page.getByTestId('mfa-verify-button')
      let buttonCount = await verifyButton.count().catch(() => 0)
      if (buttonCount === 0) {
        verifyButton = this.page.locator('[data-testid="mfa-verify-button"]').first()
      }
      
      // Try with a 6-digit code (might work in test mode, or will show error)
      await mfaTokenInput.fill('123456')
      await verifyButton.click()
      
      // Wait for either success (home screen) or error
      await this.page.waitForTimeout(2000)
      
      // Check if we're now on home screen (token was accepted) or still on MFA screen (token rejected)
      const isHomeNow = await this.page.locator('[data-testid="home-header"]').isVisible({ timeout: 3000 }).catch(() => false)
      const isAddPatient = await this.page.getByText("Add Patient", { exact: true }).isVisible({ timeout: 3000 }).catch(() => false)
      
      if (isHomeNow || isAddPatient) {
        // MFA verification succeeded
        return
      }
      
      // MFA verification failed - this is expected with a mock token
      // The test should handle this case - either skip or use a real backup code
      throw new Error('MFA verification required but mock token was rejected. Test needs to use a valid backup code or TOTP token.')
    }
    
    // Wait a bit more for the page to fully render
    await this.page.waitForTimeout(2000)
    
    // Check multiple indicators that we're on the home screen
    const homeHeader = await this.page.locator('[data-testid="home-header"]').isVisible({ timeout: 5000 }).catch(() => false)
    const addPatient = await this.page.getByText("Add Patient", { exact: true }).isVisible({ timeout: 5000 }).catch(() => false)
    const addPatientButton = await this.page.getByTestId('add-patient-button').isVisible({ timeout: 5000 }).catch(() => false)
    const homeScreen = await this.page.locator('[data-testid="home-screen"]').isVisible({ timeout: 5000 }).catch(() => false)
    const profileButton = await this.page.getByTestId('profile-button').isVisible({ timeout: 5000 }).catch(() => false)
    const homeTab = await this.page.locator('[data-testid="tab-home"], [aria-label="Home tab"]').isVisible({ timeout: 5000 }).catch(() => false)
    
    // Check if we're still on login screen
    const loginScreen = await this.page.locator('[data-testid="login-screen"]').isVisible({ timeout: 2000 }).catch(() => false)
    const emailInput = await this.page.locator('input[data-testid="email-input"]').isVisible({ timeout: 2000 }).catch(() => false)
    
    // Log what we found for debugging
    console.log('Home screen detection:', {
      homeHeader,
      addPatient,
      addPatientButton,
      homeScreen,
      profileButton,
      homeTab,
      loginScreen,
      emailInput
    })
    
    // If we're not on login screen and we can see any home elements, we're on home
    const isOnHome = homeHeader || addPatient || addPatientButton || homeScreen || (profileButton && !loginScreen && !emailInput) || (homeTab && !loginScreen && !emailInput)
    
    if (!isOnHome) {
      // Take a screenshot for debugging
      const screenshot = await this.page.screenshot().catch(() => null)
      const url = this.page.url()
      const pageContent = await this.page.content().catch(() => '')
      console.error('Failed to detect home screen. URL:', url)
      console.error('Page contains login form:', pageContent.includes('email-input'))
      console.error('Page contains home elements:', pageContent.includes('home-header') || pageContent.includes('add-patient'))
    }
    
    expect(isOnHome).toBe(true)
  }

  async thenIShouldSeeWelcomeMessage() {
    await expect(this.page.locator('[data-testid="home-header"]')).toContainText('Welcome')
  }

  async thenIShouldSeeRegistrationSuccess() {
    await expect(this.page.getByTestId('success-message')).toBeVisible()
  }

  async thenIShouldSeeValidationError(field: string, expectedError: string) {
    const errorElement = this.page.getByText(new RegExp(expectedError, 'i'))
    await expect(errorElement).toBeVisible()
  }

  async thenIShouldReceiveVerificationEmail() {
    // In a real test, this would check email service
    await expect(this.page.getByTestId('email-sent-message')).toBeVisible()
  }

  async thenIShouldSeeResetConfirmation() {
    await expect(this.page.getByTestId('reset-confirmation')).toBeVisible()
  }

  async thenIShouldRemainOnLoginScreen() {
    await expect(this.page.getByTestId('login-button')).toBeVisible()
  }
}
