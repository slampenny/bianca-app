# Non-Workflow Tests

This document categorizes the remaining Playwright tests that are **NOT** user workflow tests but cover technical behavior, component functionality, edge cases, or integration scenarios.

## Test Categories

### 1. Crash/Smoke Tests
These tests verify the app doesn't crash and loads correctly:

- **`all-screens-crash-check.e2e.test.ts`**
  - Tests all screens load without crashing
  - Verifies no JavaScript errors occur when navigating between screens
  - **Purpose**: Smoke test to catch regressions that break the app entirely
  - **Should keep**: Yes - Critical for catching breaking changes

- **`app-loading.e2e.test.ts`**
  - Tests app loads without JavaScript errors
  - Verifies root element exists
  - **Purpose**: Basic smoke test for app initialization
  - **Should keep**: Yes - Critical for catching initialization issues

### 2. Technical Behavior Tests
These tests verify specific technical behaviors or algorithms:

- **`conversation-message-ordering.e2e.test.ts`**
  - Tests message ordering logic during live calls
  - Verifies messages display in chronological order even when created out of order
  - **Purpose**: Tests technical implementation of message sorting
  - **Should keep**: Yes - Tests critical technical behavior

- **`login-modal-error-display.e2e.test.ts`**
  - Tests error display behavior in login modal
  - Verifies SSO account linking errors show correctly
  - **Purpose**: Tests edge case error handling
  - **Should keep**: Yes - Tests important edge case

### 3. Component/UI Behavior Tests
These tests verify specific UI component behaviors:

- **`alert-polling.e2e.test.ts`**
  - Tests alert polling mechanism
  - Verifies alerts update automatically via polling
  - **Purpose**: Tests technical polling implementation
  - **Should keep**: Yes - Tests critical real-time behavior

- **`alert-read-unread-tabs.e2e.test.ts`**
  - Tests alert tab switching (read/unread/all)
  - Verifies tab filtering works correctly
  - **Purpose**: Tests UI component behavior
  - **Could convert to Cucumber**: Yes - This is actually a workflow (filtering alerts)

- **`alert-mark-all-read.e2e.test.ts`**
  - Tests "mark all as read" functionality
  - **Purpose**: Tests UI component behavior
  - **Could convert to Cucumber**: Yes - Already covered in `alert-management.feature`

- **`conversations.e2e.test.ts`**
  - Tests conversation expand/collapse behavior
  - Verifies conversations can be expanded and collapsed without errors
  - **Purpose**: Tests UI component interaction
  - **Should keep**: Yes - Tests specific UI behavior

- **`complete-theme-system.e2e.test.ts`**
  - Tests theme system (color swatches, theme switching)
  - Verifies correct number of swatches for each theme
  - **Purpose**: Tests UI component behavior
  - **Should keep**: Yes - Tests specific UI feature

- **`fraud-abuse-analysis.e2e.test.ts`**
  - Tests fraud/abuse analysis screen loads without crashing
  - Verifies screen renders correctly
  - **Purpose**: Component smoke test
  - **Should keep**: Yes - Tests specific feature screen

### 4. Integration/Feature Tests
These tests verify feature integration or complex scenarios:

- **`billing.e2e.test.ts`**
  - Tests billing screen displays correctly
  - Verifies payment information is shown
  - **Purpose**: Feature integration test
  - **Could convert to Cucumber**: Maybe - Could be a "View Billing Information" workflow

- **`payment-methods.e2e.test.ts`**
  - Tests payment method management (add, edit, delete)
  - **Purpose**: Feature test
  - **Could convert to Cucumber**: Yes - This is a workflow (manage payment methods)

- **`multiple-schedules.e2e.test.ts`**
  - Tests handling multiple schedules for a patient
  - **Purpose**: Technical behavior test
  - **Could convert to Cucumber**: Maybe - Could be a "Manage Multiple Schedules" workflow

- **`schedule-integration.e2e.test.ts`**
  - Tests schedule integration with patient management
  - Verifies schedules can be accessed from patient screen
  - **Purpose**: Integration test
  - **Could convert to Cucumber**: Maybe - Already covered in `schedule-management.feature`

- **`patient-consent-flow.e2e.test.ts`**
  - Tests complete patient consent flow with real email
  - Complex workflow with email verification
  - **Purpose**: End-to-end integration test with external service
  - **Could convert to Cucumber**: Yes - This is actually a workflow, but complex

### 5. Already Converted (Can be removed)
These tests have been converted to Cucumber and can be removed:

- `workflow-*.e2e.test.ts` - All workflow tests (converted to Cucumber)
- `*-workflow.e2e.test.ts` - Workflow tests (converted to Cucumber)
- `login.e2e.test.ts` - Authentication (covered in `authentication.feature`)
- `register.e2e.test.ts` - Registration (covered in `authentication.feature`)
- `email-verification-flow.e2e.test.ts` - Email verification (covered in `email-verification.feature`)
- `phone-verification.e2e.test.ts` - Phone verification (covered in `phone-verification.feature`)
- `reset-password-flow.e2e.test.ts` - Password reset (covered in `password-reset.feature`)
- `privacy-request.e2e.test.ts` - Privacy requests (covered in `privacy-requests.feature`)
- `mfa-workflow.e2e.test.ts` - MFA (covered in `mfa-setup.feature`)
- `invite-caregiver-workflow.e2e.test.ts` - Invite caregiver (covered in `invite-caregiver.feature`)
- `alert-workflow.e2e.test.ts` - Alert workflow (covered in `alert-management.feature`)
- `schedule-workflow.e2e.test.ts` - Schedule workflow (covered in `schedule-management.feature`)
- `schedule-management.e2e.test.ts` - Schedule management (covered in `schedule-management.feature`)
- `schedule-patient-workflow.e2e.test.ts` - Schedule patient workflow (covered in `schedule-management.feature`)

## Recommendations

### Keep as Playwright Tests (Technical/Component Tests)
1. **Crash/Smoke Tests** - Critical for catching breaking changes
2. **Technical Behavior Tests** - Test implementation details
3. **Component Behavior Tests** - Test specific UI interactions
4. **Integration Tests** - Test complex technical integrations

### Could Convert to Cucumber (Workflow-like)
1. `alert-read-unread-tabs.e2e.test.ts` - Alert filtering workflow
2. `payment-methods.e2e.test.ts` - Payment method management workflow
3. `patient-consent-flow.e2e.test.ts` - Patient consent workflow (complex)
4. `billing.e2e.test.ts` - View billing information workflow

### Can Remove (Already in Cucumber)
All `workflow-*.e2e.test.ts` and `*-workflow.e2e.test.ts` files can be removed once Cucumber tests are validated.

## Summary

**Total Non-Workflow Tests**: ~15-20 tests
- **Keep**: ~10-12 tests (crash, technical behavior, component tests)
- **Could convert**: ~4-5 tests (workflow-like but complex)
- **Can remove**: All workflow tests (already converted)

The remaining tests serve important purposes:
- **Smoke tests** catch breaking changes
- **Technical tests** verify implementation correctness
- **Component tests** verify UI behavior
- **Integration tests** verify complex feature interactions

These complement the Cucumber workflow tests by testing technical details that aren't well-suited for BDD-style tests.






