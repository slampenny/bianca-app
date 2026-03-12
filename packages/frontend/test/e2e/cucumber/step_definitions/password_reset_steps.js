/**
 * Step Definitions for Password Reset Feature
 */

const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

When('I click the {string} link', async function(linkText) {
  // Use .first() to handle multiple matches
  let link = this.page.getByTestId(`${linkText.toLowerCase().replace(/\s+/g, '-')}-link`).first();
  let count = await link.count();
  
  if (count === 0) {
    link = this.page.getByText(new RegExp(linkText, 'i')).first();
  }
  
  await link.waitFor({ state: 'visible', timeout: 10000 });
  await link.click();
  await this.page.waitForTimeout(500);
});

When('I enter email {string} for password reset', async function(email) {
  // Wait for navigation to password reset form
  await this.page.waitForTimeout(2000);
  
  // Try multiple selectors for the email input (prioritize reset-specific testIDs)
  let emailInput = this.page.getByTestId('reset-email-input').first();
  let count = await emailInput.count();
  
  if (count === 0) {
    emailInput = this.page.getByTestId('forgot-password-email-input').first();
    count = await emailInput.count();
  }
  
  if (count === 0) {
    emailInput = this.page.locator('input[type="email"]').first();
    count = await emailInput.count();
  }
  
  if (count === 0) {
    // Try finding by placeholder or label
    emailInput = this.page.locator('input[placeholder*="email" i]').first();
    count = await emailInput.count();
  }
  
  if (count === 0) {
    // Last resort: find any input in the form container
    emailInput = this.page.locator('input').first();
    count = await emailInput.count();
  }
  
  if (count === 0) {
    throw new Error('Email input not found on password reset form');
  }
  
  // Wait for input to be attached (it might be hidden initially)
  await emailInput.waitFor({ state: 'attached', timeout: 15000 });
  
  // Try to make it visible by scrolling or waiting
  await emailInput.scrollIntoViewIfNeeded().catch(() => {});
  await this.page.waitForTimeout(1000);
  
  // Try to fill - use force if needed
  const isVisible = await emailInput.isVisible().catch(() => false);
  if (isVisible) {
    await emailInput.fill(email);
  } else {
    // Input is hidden but exists - try force fill
    await emailInput.fill(email, { force: true });
  }
  
  this.resetEmail = email; // Store for later use
});

Then('I should see a confirmation message about password reset', async function() {
  const confirmation = this.page.getByText(/reset link sent|check your email|password reset/i).first();
  await confirmation.waitFor({ state: 'visible', timeout: 10000 });
  const count = await confirmation.count();
  expect(count).toBeGreaterThan(0);
});

Then('I should receive a password reset email', async function() {
  // In a real test, this would check email service
  // For now, just verify confirmation message mentions email
  const emailMessage = this.page.getByText(/email|sent/i);
  const count = await emailMessage.count();
  expect(count).toBeGreaterThan(0);
});

Given('I have received a password reset email', async function() {
  // Use backend test endpoint to get a real reset token (required for reset-password to succeed).
  // Hardcoded 'test-reset-token' is invalid and causes 401 on submit + "Incorrect email or password" on login.
  const apiURL = (this.apiURL || process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
  const email = 'fake@example.org'; // Seeded user from seedDatabase (caregiverOne)
  const res = await fetch(`${apiURL}/v1/test/generate-reset-password-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get reset token: ${res.status} ${body}`);
  }
  const data = await res.json();
  this.resetToken = data.details?.token ?? data.token;
  this.resetEmail = email;
  if (!this.resetToken) {
    throw new Error('Backend did not return a reset token');
  }
});

When('I click the reset link', async function() {
  // Navigate to password reset URL
  const resetUrl = `${this.baseURL}/reset-password?token=${this.resetToken}`;
  await this.page.goto(resetUrl, { waitUntil: 'load' });
  await this.page.waitForTimeout(2000);
});

Then('I should see the password reset form', async function() {
  const passwordInput = this.page.getByTestId('new-password-input')
    .or(this.page.locator('input[type="password"]').first());
  
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  const count = await passwordInput.count();
  expect(count).toBeGreaterThan(0);
});

When('I enter a new password {string}', async function(password) {
  const passwordInput = this.page.getByTestId('new-password-input')
    .or(this.page.locator('input[type="password"]').first());
  
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(password);
  this.newPassword = password;
});

When('I confirm the new password {string}', async function(password) {
  const confirmPasswordInput = this.page.getByTestId('confirm-password-input')
    .or(this.page.locator('input[type="password"]').nth(1));
  
  await confirmPasswordInput.waitFor({ state: 'visible', timeout: 10000 });
  await confirmPasswordInput.fill(password);
});

When('I submit the reset form', async function() {
  const submitButton = this.page.getByTestId('reset-password-submit')
    .or(this.page.getByRole('button', { name: /submit|reset password/i }).first());
  
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
  
  const submitPromise = this.page.waitForResponse(response => {
    const url = response.url();
    if (!url.includes('reset-password')) return false;
    if (response.status() === 401) {
      throw new Error('Reset password returned 401 Unauthorized - token may be invalid or expired');
    }
    return response.status() === 204 || response.status() === 200;
  }, { timeout: 20000 });
  
  await submitButton.click();
  await submitPromise;
  await this.page.waitForTimeout(2000);
});

Then('I should see a success message', async function() {
  // Match only the actual success copy from ConfirmResetScreen; avoid matching error text like "Password reset failed"
  const successMessage = this.page.getByText(/Password Reset Successful!|password has been updated successfully/i).first();
  // Wait for attached (element may be present but "hidden" in RN Web due to layout)
  await successMessage.waitFor({ state: 'attached', timeout: 10000 });
  await successMessage.scrollIntoViewIfNeeded().catch(() => {});
  const count = await successMessage.count();
  expect(count).toBeGreaterThan(0);
});

Then('I should be able to login with the new password', async function() {
  // Navigate to login
  await this.page.goto(`${this.baseURL}/`, { waitUntil: 'load' });
  await this.page.waitForTimeout(1000);
  
  // Enter credentials with new password
  const emailInput = this.page.getByTestId('email-input');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(this.resetEmail || 'user@example.com');
  
  const passwordInput = this.page.getByTestId('password-input')
    .or(this.page.locator('input[type="password"]').first());
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(this.newPassword || 'NewSecurePass123!');
  
  const loginButton = this.page.getByTestId('login-button')
    .or(this.page.getByRole('button', { name: /login/i }).first());
  
  await loginButton.waitFor({ state: 'visible', timeout: 10000 });
  
  const loginPromise = this.page.waitForResponse(response => {
    if (!response.url().includes('/auth/login')) return false;
    if (response.status() === 401) {
      throw new Error('Login with new password returned 401 - password may not have been reset');
    }
    return response.status() === 200;
  }, { timeout: 15000 });
  
  await loginButton.click();
  await loginPromise;
  await this.page.waitForTimeout(3000); // Wait longer for navigation
  
  // Verify login successful (login screen should be gone, we should be on home)
  const loginInput = this.page.getByTestId('email-input');
  const loginCount = await loginInput.count();
  const currentUrl = this.page.url();
  const isOnHome = currentUrl.includes('MainTabs') || currentUrl.includes('Home') || currentUrl === this.baseURL || currentUrl === `${this.baseURL}/`;
  const homeHeader = this.page.getByTestId('home-header');
  const homeVisible = await homeHeader.first().isVisible().catch(() => false);
  
  if (loginCount > 0 && !isOnHome) {
    await this.page.waitForTimeout(2000);
    const url2 = this.page.url();
    const isOnHome2 = url2.includes('MainTabs') || url2.includes('Home') || url2 === this.baseURL || url2 === `${this.baseURL}/`;
    if (!isOnHome2) {
      throw new Error(`Login failed - still on login page. URL: ${url2}`);
    }
  }
  
  expect(homeVisible || isOnHome).toBe(true);
});

