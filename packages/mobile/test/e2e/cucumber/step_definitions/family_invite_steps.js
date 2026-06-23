/**
 * Step definitions for family portal invite onboarding (mobile signup flow).
 */

const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('a pending family portal invite is prepared for {string}', async function (email) {
  await this.ensureBackendSeeded();

  const apiURL = this.apiURL || process.env.API_URL || 'http://localhost:3000';
  const res = await fetch(`${apiURL}/v1/test/seed-family-portal-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`seed-family-portal-invite failed (${res.status}): ${body.error || res.statusText}`);
  }

  this.familyInviteEmail = body.email || email;
  this.familyInviteSignupUrl = body.signupUrl;
  expect(this.familyInviteSignupUrl).toBeTruthy();
});

When('I open the family portal invite signup page', async function () {
  expect(this.familyInviteSignupUrl).toBeTruthy();
  await this.page.goto(this.familyInviteSignupUrl, { waitUntil: 'load', timeout: 30000 });
  await this.page
    .locator('[data-testid="signup-screen"], [aria-label="signup-screen"]')
    .waitFor({ state: 'visible', timeout: 15000 });
});

When('I complete the family invite registration with password {string}', async function (password) {
  await this.page.locator('input[data-testid="register-email"]').waitFor({ state: 'visible', timeout: 15000 });

  const phoneInput = this.page.locator('input[data-testid="register-phone"]');
  if (await phoneInput.isVisible().catch(() => false)) {
    const currentPhone = await phoneInput.inputValue().catch(() => '');
    if (!currentPhone || currentPhone.trim().length < 10) {
      await phoneInput.fill('+16045624299');
    }
  }

  const pw = this.page.locator('input[aria-label="signup-password-input"], input[data-testid="register-password"]').first();
  const confirm = this.page
    .locator('input[aria-label="signup-confirm-password-input"], input[data-testid="register-confirm-password"]')
    .first();
  await pw.waitFor({ state: 'visible', timeout: 10000 });
  await pw.fill(password);
  await confirm.fill(password);

  await this.page.getByTestId('register-submit').click();

  const error = this.page.getByTestId('signup-error');
  if (await error.isVisible({ timeout: 5000 }).catch(() => false)) {
    const msg = await error.textContent();
    throw new Error(`Signup failed: ${msg}`);
  }
});

When('I reach the home screen after family invite signup', async function () {
  const welcome = this.page.getByTestId('family-invite-welcome-screen');
  if (await welcome.isVisible({ timeout: 10000 }).catch(() => false)) {
    await this.page.getByTestId('family-invite-continue-browser').click();
  }
  await this.page.locator('[data-testid="home-header"]').waitFor({ state: 'visible', timeout: 20000 });
});

Then('I should see the family invite welcome screen', async function () {
  await expect(this.page.getByTestId('family-invite-welcome-screen')).toBeVisible({ timeout: 15000 });
});

When('I continue from the family invite welcome screen', async function () {
  const continueBtn = this.page.getByTestId('family-invite-continue-browser');
  await continueBtn.waitFor({ state: 'visible', timeout: 10000 });
  await continueBtn.click();
  await this.page.locator('[data-testid="home-header"]').waitFor({ state: 'visible', timeout: 20000 });
});
