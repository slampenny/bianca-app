import { Page, expect } from '@playwright/test'

// Modular authentication workflow components
export class AuthWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  async givenIAmOnTheLoginScreen() {
    // Navigate to the app and wait for login screen
    await this.page.goto('http://localhost:8081/')
    await this.page.waitForSelector('[aria-label="email-input"]', { timeout: 10000 })
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
    // Use aria-label for React Native Web
    await this.page.locator('[aria-label="register-link"]').click()
    await this.page.waitForSelector('[aria-label="register-name"]', { timeout: 10000 })
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
    await this.page.fill('[aria-label="email-input"]', email)
    await this.page.fill('[aria-label="password-input"]', password)
  }

  async whenIClickLoginButton() {
    await this.page.click('[aria-label="login-button"]')
  }

  async whenIClickRegisterButton() {
    await this.page.locator('[aria-label="register-submit"]').click()
  }

  async whenIFillRegistrationForm(data: any) {
    await this.page.locator('[aria-label="register-name"]').fill(data.name)
    await this.page.locator('[aria-label="register-email"]').fill(data.email)
    await this.page.locator('[aria-label="register-password"]').fill(data.password)
    await this.page.locator('[aria-label="register-confirm-password"]').fill(data.confirmPassword)
    await this.page.locator('[aria-label="register-phone"]').fill(data.phone)
    if (data.organizationName) {
      // Switch to organization account type first
      await this.page.locator('[aria-label="register-organization-toggle"]').click()
      await this.page.locator('[aria-label="register-org-name"]').fill(data.organizationName)
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
      this.page.locator('[aria-label="login-error"], [data-testid="login-error"]'),
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
    const mfaScreen = await this.page.locator('[aria-label="mfa-token-input"], [data-testid="mfa-verification-screen"]').isVisible({ timeout: 2000 }).catch(() => false)
    if (mfaScreen) {
      // User has MFA enabled - we need to complete MFA verification
      // For now, we'll use a backup code if available, or skip this test
      // In a real scenario, we'd need to generate a valid TOTP token
      console.log('User has MFA enabled - attempting to verify with backup code or mock token')
      
      // Try to find backup codes or use a mock token
      // Note: This will likely fail with invalid token, but we'll handle that
      const mfaTokenInput = this.page.locator('[aria-label="mfa-token-input"]')
      const verifyButton = this.page.locator('[aria-label="mfa-verify-button"]')
      
      // Try with a 6-digit code (might work in test mode, or will show error)
      await mfaTokenInput.fill('123456')
      await verifyButton.click()
      
      // Wait for either success (home screen) or error
      await this.page.waitForTimeout(2000)
      
      // Check if we're now on home screen (token was accepted) or still on MFA screen (token rejected)
      const isHomeNow = await this.page.locator('[aria-label="home-header"]').isVisible({ timeout: 3000 }).catch(() => false)
      const isAddPatient = await this.page.getByText("Add Patient", { exact: true }).isVisible({ timeout: 3000 }).catch(() => false)
      
      if (isHomeNow || isAddPatient) {
        // MFA verification succeeded
        return
      }
      
      // MFA verification failed - this is expected with a mock token
      // The test should handle this case - either skip or use a real backup code
      throw new Error('MFA verification required but mock token was rejected. Test needs to use a valid backup code or TOTP token.')
    }
    
    const homeHeader = await this.page.locator('[aria-label="home-header"]').isVisible().catch(() => false)
    const addPatient = await this.page.getByText("Add Patient", { exact: true }).isVisible().catch(() => false)
    expect(homeHeader || addPatient).toBe(true)
  }

  async thenIShouldSeeWelcomeMessage() {
    await expect(this.page.locator('[aria-label="home-header"]')).toContainText('Welcome')
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
    await expect(this.page.locator('[aria-label="login-button"]')).toBeVisible()
  }
}
