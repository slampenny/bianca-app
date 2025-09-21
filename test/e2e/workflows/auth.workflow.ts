import { Page, expect } from '@playwright/test'

// Modular authentication workflow components
export class AuthWorkflow {
  constructor(private page: Page) {}

  // GIVEN steps - Setup conditions
  async givenIAmOnTheLoginScreen() {
    // Uses existing test fixture navigation
    await this.page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 })
  }

  async givenIHaveValidCredentials() {
    return {
      email: 'fake@example.org',  // From backend caregiver fixture
      password: 'Password1'       // From backend caregiver fixture
    }
  }

  async givenIHaveValidAdminCredentials() {
    return {
      email: 'admin@example.org', // From backend admin fixture
      password: 'Password1'       // From backend caregiver fixture
    }
  }

  async givenIHaveInvalidCredentials() {
    return {
      email: 'fake@example.org',
      password: 'wrongpassword'
    }
  }

  async givenIAmOnTheRegisterScreen() {
    await this.page.getByTestId('register-button').click()
    await this.page.waitForSelector('[data-testid="register-name"]', { timeout: 10000 })
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
    await this.page.getByTestId('email-input').fill(email)
    await this.page.getByTestId('password-input').fill(password)
  }

  async whenIClickLoginButton() {
    await this.page.getByTestId('login-button').click()
  }

  async whenIClickRegisterButton() {
    await this.page.getByTestId('register-submit').click()
  }

  async whenIFillRegistrationForm(data: any) {
    await this.page.getByTestId('register-name').fill(data.name)
    await this.page.getByTestId('register-email').fill(data.email)
    await this.page.getByTestId('register-password').fill(data.password)
    await this.page.getByTestId('register-confirm-password').fill(data.confirmPassword)
    await this.page.getByTestId('register-phone').fill(data.phone)
    if (data.organizationName) {
      // Switch to organization account type first
      await this.page.getByTestId('register-organization-toggle').click()
      await this.page.getByTestId('register-org-name').fill(data.organizationName)
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
    const errorText = this.page.getByText(/Failed to log in. Please check your email and password./i)
    await expect(errorText).toBeVisible()
  }

  async thenIShouldBeOnHomeScreen() {
    await expect(this.page.getByText("Add Patient", { exact: true })).toBeVisible({ timeout: 10000 })
  }

  async thenIShouldSeeWelcomeMessage() {
    await expect(this.page.getByTestId('home-header')).toContainText('Welcome')
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
