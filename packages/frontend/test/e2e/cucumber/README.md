# Cucumber E2E Tests

This directory contains Cucumber BDD (Behavior-Driven Development) tests for the frontend E2E workflows, similar to the setup in `junction` and `taverngate` projects.

## Structure

```
cucumber/
├── features/              # Gherkin feature files (.feature)
│   ├── authentication.feature
│   ├── patient-management.feature
│   ├── patient-complete-management.feature
│   ├── schedule-management.feature
│   ├── alert-management.feature
│   ├── caregiver-management.feature
│   ├── mfa-setup.feature
│   ├── privacy-requests.feature
│   ├── email-verification.feature
│   ├── phone-verification.feature
│   ├── invite-caregiver.feature
│   └── password-reset.feature
├── step_definitions/      # Step definition implementations (.js)
│   ├── auth_steps.js
│   ├── patient_steps.js
│   ├── schedule_steps.js
│   ├── alert_steps.js
│   ├── caregiver_steps.js
│   ├── mfa_steps.js
│   ├── privacy_steps.js
│   ├── verification_steps.js
│   ├── invite_steps.js
│   ├── password_reset_steps.js
│   └── common_steps.js
├── support/              # Support files (world.js, hooks.js)
│   ├── world.js
│   └── hooks.js
├── reports/              # Test reports (generated)
├── screenshots/          # Screenshots (generated)
└── cucumber.config.js   # Cucumber configuration
```

## Running Tests

### Run all Cucumber tests
```bash
yarn test:cucumber
```

### Run with browser visible (headed mode)
```bash
yarn test:cucumber:headed
```

### Run and generate HTML report
```bash
yarn test:cucumber:report
```

### Run specific feature
```bash
NODE_ENV=test node node_modules/@cucumber/cucumber/bin/cucumber.js --config test/e2e/cucumber/cucumber.config.js test/e2e/cucumber/features/authentication.feature
```

### Run with tags
```bash
CUCUMBER_TAGS="@smoke" yarn test:cucumber
```

## Prerequisites

1. **Backend server** must be running on `http://localhost:3000`
2. **Frontend server** must be running on `http://localhost:8082`
   - Or set `FRONTEND_URL` and `API_URL` environment variables

## Features Covered

### Authentication
- Login with valid/invalid credentials
- User registration
- Logout workflow

### Patient Management
- Create, read, update patients
- View patient details
- Manage patient avatars
- Access patient schedules

### Schedule Management
- View schedules
- Create new schedules
- Set schedule times and days

### Alert Management
- View alert badge count
- Navigate to alerts screen
- Filter alerts (unread/all)
- Mark all alerts as read

### Caregiver Management
- View caregivers list
- Add new caregivers
- Manage caregiver roles

### MFA Setup
- Navigate to MFA setup
- Enable MFA
- View QR code and backup codes
- Cancel MFA setup

### Privacy Requests (PIPEDA)
- Submit privacy request
- View request status
- Download personal data

### Email Verification
- Register and receive verification email
- Resend verification email
- Verify email with token

### Phone Verification
- Request verification code
- Verify phone with code
- Resend verification code

### Invite Caregiver
- Send caregiver invite
- Accept invite and complete registration

### Password Reset
- Request password reset
- Reset password with token
- Login with new password

## Writing Features

Feature files use Gherkin syntax:

```gherkin
Feature: User Authentication
  As a caregiver
  I want to log in
  So that I can access the app

  Scenario: Successful login
    Given I am not logged in
    When I navigate to the login page
    And I enter email "user@test.com"
    And I enter password "password123"
    And I click the login button
    Then I should be logged in
    And I should see the home screen
```

## Writing Step Definitions

Step definitions are in `step_definitions/` and use Playwright:

```javascript
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

When('I navigate to the login page', async function() {
  await this.page.goto(`${this.baseURL}/`, { waitUntil: 'load' });
  await this.page.waitForSelector('input[data-testid="email-input"]', { timeout: 10000 });
});
```

## World Object

The `World` object (from `support/world.js`) provides:
- `this.page` - Playwright Page instance
- `this.browser` - Playwright Browser instance
- `this.baseURL` - Frontend URL (default: http://localhost:8082)
- `this.apiURL` - Backend API URL (default: http://localhost:3000)
- `this.getCredentials(username)` - Get test user credentials

## Integration with Existing Tests

This Cucumber setup works alongside the existing Playwright tests:
- **Playwright tests** (`*.e2e.test.ts`) - For specific component/feature tests
- **Cucumber tests** (`features/*.feature`) - For workflow/user journey tests

Both use the same Playwright infrastructure and can share helpers from `test/e2e/helpers/`.

## Environment Variables

- `FRONTEND_URL` - Frontend URL (default: http://localhost:8082)
- `API_URL` - Backend API URL (default: http://localhost:3000)
- `HEADED` - Run browser in headed mode (default: false)
- `SLOW_MO` - Slow down actions by N milliseconds (default: 0)
- `CUCUMBER_TAGS` - Filter scenarios by tags (e.g., "@smoke")

## Migration from Playwright Tests

Most major workflows have been converted from Playwright tests to Cucumber features:
- ✅ Authentication workflows
- ✅ Patient management workflows
- ✅ Schedule management workflows
- ✅ Alert management workflows
- ✅ Caregiver management workflows
- ✅ MFA setup workflows
- ✅ Privacy request workflows
- ✅ Email/Phone verification workflows
- ✅ Invite caregiver workflows
- ✅ Password reset workflows

The original Playwright tests remain for reference and can be gradually removed as Cucumber tests are validated.
