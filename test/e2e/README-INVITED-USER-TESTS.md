# Invited User Authentication Workflow Tests

This directory contains comprehensive Playwright tests for invited user authentication workflows, specifically addressing common issues with logout functionality and token expiration scenarios.

## Test Files

### 1. `invited-user-auth-workflow.e2e.test.ts`
Comprehensive test suite covering the complete invited user authentication flow, including:
- Profile screen authentication errors
- Invite token persistence and handling
- Signup completion and redirection
- Token expiration scenarios

### 2. `invited-user-logout-issues.e2e.test.ts`
Focused tests for logout functionality issues, specifically:
- Logout button behavior with expired tokens
- Network error handling during logout
- Multiple logout attempts
- Mixed authentication states

### 3. `token-expiration-navigation.e2e.test.ts`
Tests for token expiration and navigation issues:
- Navigation with expired tokens but currentUser in Redux
- API call failures with expired tokens
- Token refresh failures and user logout
- Concurrent token refresh attempts

### 4. `helpers/authHelpers.ts`
Utility functions for authentication testing:
- Mock Redux state setup
- Token creation and management
- API mocking utilities
- Authentication verification helpers

## Key Issues Addressed

### 1. Logout Button Does Nothing
**Problem**: Users with expired tokens can see the logout button but clicking it doesn't work properly.

**Tests**:
- `logout-button-does-nothing-when-refresh-token-expired`
- `logout-button-handles-network-errors-gracefully`
- `logout-button-behavior-with-missing-tokens`

### 2. Token Expiration Navigation Issue
**Problem**: Users can navigate the app even with expired tokens because `currentUser` is persisted in Redux state.

**Tests**:
- `user-can-navigate-app-with-expired-tokens-but-currentuser-in-state`
- `api-calls-fail-with-expired-tokens-but-ui-navigation-works`
- `token-expiration-during-user-interaction`

### 3. Invited User Profile Screen Issues
**Problem**: Invited users get stuck on profile screen without proper authentication.

**Tests**:
- `invited-user-gets-stuck-on-profile-screen-without-credentials`
- `invited-user-with-invite-token-gets-redirected-to-signup`
- `invited-user-can-complete-signup-and-access-profile`

## Running the Tests

### Run All Invited User Tests
```bash
npx playwright test invited-user
```

### Run Specific Test File
```bash
npx playwright test invited-user-auth-workflow
npx playwright test invited-user-logout-issues
npx playwright test token-expiration-navigation
```

### Run with Debug Mode
```bash
npx playwright test invited-user --debug
```

### Run in Headed Mode
```bash
npx playwright test invited-user --headed
```

## Test Data and Fixtures

The tests use the existing test data fixtures:
- `generateUniqueTestData()` for creating unique test users
- `TEST_USERS` for predefined test user data

## Mocking Strategy

### Redux State Mocking
Tests mock Redux state by injecting it into localStorage before page load:
```typescript
await setupMockAuthState(page, {
  tokens: expiredTokens,
  currentUser: mockUser,
  authEmail: mockUser.email,
  inviteToken: null
})
```

### API Mocking
API endpoints are mocked to simulate various scenarios:
- Successful authentication
- Token expiration (401 responses)
- Network errors
- Invalid invite tokens

### Token Management
Helper functions create realistic token scenarios:
- Valid tokens
- Expired tokens
- Soon-to-expire tokens
- Mixed token states

## Expected Behaviors

### Logout Button
- Should work with valid tokens
- Should clear local state even if API fails
- Should redirect to login screen
- Should handle network errors gracefully

### Token Expiration
- Should attempt automatic token refresh
- Should redirect to login on refresh failure
- Should prevent API calls with expired tokens
- Should show appropriate error messages

### Invited Users
- Should be redirected to signup screen with invite token
- Should complete signup successfully
- Should clear invite token after successful registration
- Should handle invalid/expired invite tokens

## Debugging Tips

### Console Logs
Tests include console logging to help debug issues:
```typescript
console.log('Current URL:', currentUrl)
console.log('On logout screen:', isOnLogoutScreen)
console.log('API calls made:', apiCalls)
```

### State Verification
Use helper functions to verify authentication state:
```typescript
const authState = await getCurrentAuthState(page)
expect(authState.tokens).toBeNull()
expect(authState.currentUser).toBeNull()
```

### Visual Debugging
Run tests in headed mode to see what's happening:
```bash
npx playwright test invited-user --headed --slowMo=1000
```

## Common Issues and Solutions

### 1. Tests Timing Out
- Increase timeout values for slow operations
- Add explicit waits for critical UI elements
- Use `waitForFunction` for state-dependent assertions

### 2. Mock State Not Persisting
- Ensure `addInitScript` is called before navigation
- Verify localStorage key matches Redux persist configuration
- Check for state conflicts between tests

### 3. API Mocks Not Working
- Verify route patterns match actual API calls
- Check for route conflicts (more specific routes first)
- Use `route.continue()` for unmatched routes

### 4. Navigation Issues
- Wait for navigation to complete before assertions
- Use `waitForSelector` for target screens
- Handle redirect scenarios properly

## Contributing

When adding new tests:
1. Use the existing helper functions from `authHelpers.ts`
2. Follow the naming convention for test descriptions
3. Include console logging for debugging
4. Add appropriate error handling
5. Document any new helper functions

## Related Issues

These tests address the following user-reported issues:
- Logout button not working with expired tokens
- Users can navigate app with expired authentication
- Invited users getting stuck on profile screen
- Token expiration not handled gracefully
- Mixed authentication states causing confusion
