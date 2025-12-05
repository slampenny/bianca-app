# PIPEDA Compliance Tests

## Overview

This document describes the comprehensive test suite for PIPEDA compliance features, including privacy requests, consent management, and data export functionality.

## Test Coverage

### Backend Unit Tests

#### 1. Privacy Service Tests (`tests/unit/services/privacy.service.test.js`)
- ✅ Create access requests
- ✅ Create correction requests
- ✅ Get privacy request by ID (with authorization checks)
- ✅ Query privacy requests (with user filtering)
- ✅ Process access requests (automatic data gathering and emailing)
- ✅ Create consent records
- ✅ Check if user has consent
- ✅ Withdraw consent (with account locking for collection consent)
- ✅ Get consent history
- ✅ Get requests approaching deadline
- ✅ Get overdue requests
- ✅ Get privacy statistics

#### 2. Privacy Controller Tests (`tests/unit/controllers/privacy.controller.test.js`)
- ✅ Create access request endpoint
- ✅ Create correction request endpoint
- ✅ Get privacy request endpoint
- ✅ Get privacy requests (paginated) endpoint
- ✅ Create consent endpoint
- ✅ Get active consent endpoint
- ✅ Check consent endpoint
- ✅ Withdraw consent endpoint
- ✅ Get consent history endpoint
- ✅ Admin endpoints (approaching deadline, overdue, statistics)

#### 3. Model Tests

##### PrivacyRequest Model (`tests/unit/models/privacyRequest.model.test.js`)
- ✅ Schema validation (access and correction requests)
- ✅ Default response deadline (30 days)
- ✅ Extension support
- ✅ Fee tracking
- ✅ Appeal process
- ✅ Static methods (approaching deadline, overdue, by requestor, statistics)

##### ConsentRecord Model (`tests/unit/models/consentRecord.model.test.js`)
- ✅ Schema validation (explicit and implied consent)
- ✅ Active consent retrieval
- ✅ Consent filtering by type
- ✅ Exclude withdrawn/expired consent
- ✅ Consent history
- ✅ Consent statistics
- ✅ Withdrawal functionality

### Backend Integration Tests

#### Privacy API Routes (`tests/integration/privacy.test.js`)
- ✅ POST `/v1/privacy/requests/access` - Create access request
- ✅ POST `/v1/privacy/requests/correction` - Create correction request
- ✅ GET `/v1/privacy/requests` - List user's requests
- ✅ GET `/v1/privacy/requests/:requestId` - Get specific request
- ✅ POST `/v1/privacy/consent` - Create consent record
- ✅ GET `/v1/privacy/consent` - Get active consent
- ✅ GET `/v1/privacy/consent/check` - Check if consent exists
- ✅ POST `/v1/privacy/consent/:consentId/withdraw` - Withdraw consent
- ✅ GET `/v1/privacy/consent/history` - Get consent history
- ✅ Admin endpoints (approaching deadline, overdue, statistics)
- ✅ Authorization checks (users can only see their own requests)
- ✅ Account locking when collection consent is withdrawn

### Frontend E2E Tests

#### Privacy Request Screen (`test/e2e/privacy-request.e2e.test.ts`)
- ✅ User can submit access request from profile screen
- ✅ User can see their request history
- ✅ User sees error if request submission fails
- ✅ "Request My Data" button is visible on profile screen

## Test Data

Tests use realistic test data:
- **Caregivers**: Users with various roles (orgAdmin, staff, superAdmin)
- **Patients**: Associated with caregivers
- **Privacy Requests**: Access and correction requests with various statuses
- **Consent Records**: Explicit and implied consent for various purposes
- **Conversations**: Patient conversations for data export testing
- **Medical Analysis**: Medical analysis data for export testing

## Mocking Strategy

### Backend Tests
- **Email Service**: Mocked to avoid actual email sending
- **Database**: Uses MongoDB Memory Server with cleanup
- **Authentication**: Mocked tokens and user sessions
- **Time**: Uses real dates for realistic testing

### Frontend Tests
- **API Calls**: Mocked using Playwright route interception
- **Authentication**: Mocked login flow
- **Navigation**: Real navigation (not mocked per testing philosophy)

## Running the Tests

### Backend Unit Tests
```bash
cd bianca-app-backend

# Run all privacy service tests
yarn test tests/unit/services/privacy.service.test.js

# Run all privacy controller tests
yarn test tests/unit/controllers/privacy.controller.test.js

# Run all privacy model tests
yarn test tests/unit/models/privacyRequest.model.test.js
yarn test tests/unit/models/consentRecord.model.test.js
```

### Backend Integration Tests
```bash
cd bianca-app-backend

# Run all privacy integration tests
yarn test tests/integration/privacy.test.js
```

### Frontend E2E Tests
```bash
cd bianca-app-frontend

# Start the web server first
yarn bundle:web:staging
npx serve dist -l 8082

# In another terminal, run tests
npx playwright test privacy-request --reporter=list

# Run with visual debugging
npx playwright test privacy-request --headed

# Run with debug mode
npx playwright test privacy-request --debug
```

## Test Philosophy

### Backend
- Use MongoDB Memory Server for isolated database testing
- Mock external services (email) but use real internal services
- Test authorization and access control thoroughly
- Test edge cases (expired consent, overdue requests, etc.)

### Frontend
- **Golden Rule**: We NEVER mock services we own (backend API, Redux state, navigation)
- We ONLY mock external services (OpenAI, Twilio, Asterisk, AWS)
- Actually log in through the UI
- Navigate through real app flows
- Use real routing/navigation

## Key Test Scenarios

### 1. Access Request Flow
1. User submits access request
2. System automatically gathers all user data (profile, patients, conversations, medical analysis, consent)
3. System emails data as JSON attachment
4. Request status updated to "completed"
5. User can view request history

### 2. Consent Withdrawal Flow
1. User withdraws collection consent
2. System locks user account (can't use app without consent)
3. Consent record marked as withdrawn
4. User cannot perform actions requiring consent

### 3. Authorization Checks
1. Users can only see their own requests
2. Admins can see all requests
3. Users cannot withdraw another user's consent
4. Users cannot view another user's request details

### 4. Data Export
1. System gathers complete user data
2. Includes profile, patients, conversations (up to 100 per patient), medical analysis (up to 50 per patient), consent history
3. Data formatted as JSON
4. Emailed automatically to user

## Continuous Integration

These tests are designed to run in CI/CD pipelines:
- No external dependencies (except mocked services)
- Proper cleanup and isolation
- Deterministic results
- Clear error reporting
- Coverage reporting

## Debugging Tests

To debug failing tests:

1. **Check test database**: Ensure MongoDB test instance is running
2. **Verify test data**: Check that test data is properly created/cleaned
3. **Review async operations**: Ensure proper await/async handling
4. **Check mocks**: Verify mocked services are properly configured
5. **Check authorization**: Verify user roles and permissions are correct
6. **Check email service**: Verify email service is properly mocked

## Coverage Goals

- ✅ Privacy Service: 100% coverage
- ✅ Privacy Controller: 100% coverage
- ✅ Privacy Models: 100% coverage
- ✅ Privacy Routes: 100% coverage
- ✅ Frontend Privacy Screen: Core flows covered

## Future Enhancements

- [ ] Add tests for correction request processing
- [ ] Add tests for appeal process
- [ ] Add tests for fee calculation
- [ ] Add tests for deadline extension
- [ ] Add tests for bulk consent operations
- [ ] Add performance tests for large data exports



