# SSO and Invite User Workflow Tests

This directory contains comprehensive end-to-end tests for the Single Sign-On (SSO) and user invitation workflows in the Bianca App.

## Test Files

### 1. `sso.e2e.test.ts`
Tests the complete SSO authentication workflow including:
- Google SSO login with profile completion
- Microsoft SSO login
- SSO logout flow
- SSO error handling
- Unverified user role and profile completion

### 2. `invite-user.e2e.test.ts`
Tests the user invitation workflow including:
- Admin sending invites
- Email link simulation
- Invite registration completion
- Invalid/expired token handling
- Form validation

### 3. `sso-invite-integration.e2e.test.ts`
Integration tests that combine SSO and invite workflows:
- SSO admin invites user
- Unverified SSO users cannot send invites
- Invited users can later use SSO

### 4. `helpers/emailTestHelpers.ts`
Helper utilities for email testing:
- Email capture and simulation
- Email link extraction
- Invite workflow automation

## Test Configuration

### `sso-invite.config.ts`
Special configuration for SSO and invite tests:
- Longer timeouts for OAuth flows
- Non-headless mode for debugging
- Separate test projects for different test types
- Retry logic for flaky tests

## Running the Tests

### Prerequisites
1. Backend server running on `localhost:3000`
2. Frontend server running on `localhost:8081`
3. Database seeded with test data

### Run All SSO and Invite Tests
```bash
# Using the special configuration
npx playwright test --config=test/e2e/sso-invite.config.ts

# Or using the main configuration
npx playwright test test/e2e/sso*.e2e.test.ts test/e2e/invite*.e2e.test.ts
```

### Run Specific Test Suites
```bash
# SSO tests only
npx playwright test test/e2e/sso.e2e.test.ts

# Invite tests only
npx playwright test test/e2e/invite-user.e2e.test.ts

# Integration tests only
npx playwright test test/e2e/sso-invite-integration.e2e.test.ts
```

### Run with Debug Mode
```bash
# Run with browser visible and slower actions
npx playwright test --config=test/e2e/sso-invite.config.ts --headed --slowMo=1000
```

## Test Data

### SSO Test Data
- Uses `generateUniqueTestData()` for unique test users
- Mocks OAuth responses for Google and Microsoft
- Simulates user info from OAuth providers

### Invite Test Data
- Uses seeded admin users from `TEST_USERS.ORG_ADMIN`
- Generates unique invitee data
- Mocks email sending and capture

## Mocking Strategy

### OAuth Flows
- Mock OAuth authorization endpoints
- Simulate OAuth callbacks with success responses
- Mock user info APIs (Google, Microsoft)

### Backend APIs
- Mock SSO login endpoints
- Mock invite sending and verification
- Mock user registration and profile updates

### Email Service
- Capture emails instead of actually sending them
- Extract invite links from captured emails
- Simulate email link clicks

## Key Test Scenarios

### SSO Workflow
1. **New SSO User**: OAuth → Profile completion → Full access
2. **Existing SSO User**: OAuth → Direct login
3. **SSO Logout**: Logout → Token cleanup → Redirect to login
4. **SSO Errors**: Invalid OAuth → Error handling

### Invite Workflow
1. **Admin Sends Invite**: Admin → Organization screen → Invite Caregiver → Fill details → Send invite → Email captured
2. **User Clicks Email Link**: Email link → Signup page with token
3. **User Completes Signup**: Set password → Backend verification → Login
4. **Invalid/Expired Tokens**: Error handling

### Integration Scenarios
1. **SSO Admin + Invite**: SSO admin → Organization screen → Send invite → User signup
2. **Unverified SSO User**: SSO login → Profile completion → Full access
3. **Invited User + SSO**: Invite signup → Logout → SSO login

## Debugging Tips

### SSO Issues
- Check OAuth mock responses
- Verify user info API mocks
- Ensure backend SSO endpoint mocks are correct
- Check token format and expiration

### Invite Issues
- Verify email capture is working
- Check invite token generation and validation
- Ensure registration form mocks are correct
- Verify user role promotion logic

### Common Issues
- **Timeout errors**: Increase timeout in config
- **Mock failures**: Check route patterns and responses
- **Navigation issues**: Verify test IDs and selectors
- **State issues**: Ensure proper cleanup between tests

## Test Maintenance

### Adding New SSO Providers
1. Add OAuth mock routes
2. Add user info API mocks
3. Update test data and scenarios
4. Add provider-specific error cases

### Adding New Invite Features
1. Update email helper functions
2. Add new form validation tests
3. Update integration scenarios
4. Add error handling tests

### Updating Test Data
1. Modify `testData.ts` for new user types
2. Update mock responses accordingly
3. Ensure test isolation and cleanup
4. Update documentation

## Best Practices

### Test Isolation
- Each test generates unique data
- Proper cleanup of mocks and state
- Independent test execution

### Mock Management
- Realistic mock responses
- Proper error simulation
- Consistent data formats

### Error Testing
- Test both success and failure paths
- Verify error messages and handling
- Test edge cases and invalid inputs

### Performance
- Use appropriate timeouts
- Minimize unnecessary waits
- Optimize mock responses

## Troubleshooting

### Tests Failing
1. Check if backend is running
2. Verify frontend is accessible
3. Check mock route patterns
4. Review test logs and screenshots

### OAuth Issues
1. Verify OAuth mock responses
2. Check callback URL handling
3. Ensure proper token formats
4. Test with real OAuth providers

### Email Issues
1. Check email capture logic
2. Verify link extraction
3. Test email link navigation
4. Ensure proper email format

### Integration Issues
1. Check test data consistency
2. Verify state management
3. Ensure proper cleanup
4. Test with real backend integration
