# Invite User Workflow Tests

This directory contains end-to-end tests for the user invitation workflows in the Bianca App.

**Note:** SSO tests have been removed because they depend on external Google/Microsoft OAuth screens that cannot be controlled in automated tests.

## Test Files

### 1. `invite-user.e2e.test.ts`
Tests the user invitation workflow including:
- Admin sending invites
- Email link simulation
- Invite registration completion
- Invalid/expired token handling
- Form validation

### 2. `helpers/emailTestHelpers.ts`
Helper utilities for email testing:
- Email capture and simulation
- Email link extraction
- Invite workflow automation

## Running the Tests

### Prerequisites
1. Backend server running on `localhost:3000`
2. Frontend server running on `localhost:8081`
3. Database seeded with test data

### Run Invite Tests
```bash
npx playwright test test/e2e/invite*.e2e.test.ts
```

### Run with Debug Mode
```bash
npx playwright test test/e2e/invite*.e2e.test.ts --headed --slowMo=1000
```

## Test Data

### Invite Test Data
- Uses seeded admin users from `TEST_USERS.ORG_ADMIN`
- Generates unique invitee data
- Mocks email sending and capture

## Mocking Strategy

### Backend APIs
- Mock invite sending and verification
- Mock user registration and profile updates

### Email Service
- Capture emails instead of actually sending them
- Extract invite links from captured emails
- Simulate email link clicks

## Key Test Scenarios

### Invite Workflow
1. **Admin Sends Invite**: Admin → Organization screen → Invite Caregiver → Fill details → Send invite → Email captured
2. **User Clicks Email Link**: Email link → Signup page with token
3. **User Completes Signup**: Set password → Backend verification → Login
4. **Invalid/Expired Tokens**: Error handling

## Debugging Tips

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
