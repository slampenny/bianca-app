# Invited User Integration Tests

## Testing Philosophy

**Golden Rule**: We NEVER mock services we own (backend API, Redux state, navigation).  
We ONLY mock external services (OpenAI, Twilio, Asterisk, AWS).

## Test Approach

### ✅ What We DO
- Actually log in through the UI using `ensureUserRegisteredAndLoggedInViaUI()`
- Navigate through real app flows
- Interact with real Redux state
- Use real routing/navigation
- Mock only external service responses (if needed for specific scenarios)

### ❌ What We DON'T Do
- Mock Redux state via localStorage injection
- Mock our own backend API responses (except for specific error scenarios)
- Mock navigation or routing
- Inject fake authentication state

## Test Files

### `invited-user-integration.e2e.test.ts`
Integration tests covering:
1. **Normal logout flow** - User logs in and logs out successfully
2. **Logout with API failure** - Backend logout fails but local state is cleared
3. **Logout with invalid token** - Refresh token is invalid but logout still works
4. **Token expiration** - User can't perform actions after tokens expire
5. **Invited user signup** - Complete invite signup flow
6. **Invited user profile redirect** - User with invite token redirected from profile to signup
7. **Unauthenticated profile access** - Shows error and "Go to Login" button
8. **Multiple logout attempts** - Rapid clicks handled gracefully

## Issues Being Tested

### 1. 🚫 Logout Button Does Nothing
**Test Cases**:
- `User can log in and log out successfully` - Baseline happy path
- `Logout works even when backend logout API fails` - API failure scenario
- `Logout works when refresh token is invalid` - Token expiration scenario
- `Multiple logout attempts are handled gracefully` - Rapid clicking

**Expected Behavior**:
- Logout should ALWAYS clear local state
- User should ALWAYS be redirected to login screen
- Even if backend API fails, local logout should work

### 2. 🔄 Token Expiration Navigation Issue  
**Test Cases**:
- `User cannot perform actions after tokens expire` - Simulates all APIs returning 401

**Expected Behavior**:
- App should detect 401 responses
- User should be logged out automatically
- OR user should see clear error messages

### 3. 👤 Invited User Profile Screen Issues
**Test Cases**:
- `Invited user can complete signup and access app` - Full signup flow
- `Invited user who returns to profile screen is redirected to signup` - Redirect logic
- `User without authentication sees error on profile screen` - Error handling

**Expected Behavior**:
- Users with invite token redirect to signup
- Users without auth see error and "Go to Login" button
- After signup, users can access all features

## Running the Tests

### Prerequisites
```bash
# Terminal 1: Start the web server
cd bianca-app-frontend
yarn bundle:web:staging
npx serve dist -l 8082

# Keep this running...
```

### Run Tests
```bash
# Terminal 2: Run tests
cd bianca-app-frontend

# Run all invited user integration tests
npx playwright test invited-user-integration --reporter=list

# Run specific test
npx playwright test --grep="User can log in and log out successfully"

# Run with visual debugging
npx playwright test invited-user-integration --headed

# Run with debug mode (step through)
npx playwright test invited-user-integration --debug
```

## Test Structure

Each test follows this pattern:

```typescript
test('Test description', async ({ page }) => {
  // 1. Setup: Register and log in through UI
  await ensureUserRegisteredAndLoggedInViaUI(page, name, email, password, phone)
  
  // 2. (Optional) Mock external service or error scenario
  await page.route('**/v1/some-endpoint', async (route) => {
    route.fulfill({ status: 500, ... })
  })
  
  // 3. Perform action
  await logoutViaUI(page)
  
  // 4. Verify expected behavior
  await expect(page.getByLabel('login-screen')).toBeVisible()
})
```

## Mocking Strategy

### When to Mock
- **External services**: OpenAI, Twilio, Asterisk (not needed for these tests)
- **Error scenarios**: Simulate backend failures (401, 500 errors)
- **Edge cases**: Invalid tokens, network failures

### When NOT to Mock
- **Our backend API** (for normal flows)
- **Redux state**
- **Navigation/routing**
- **User authentication** (log in for real)

### Example: Mocking Only Error Scenarios
```typescript
// ✅ Good: Mock backend to return error for specific scenario
await page.route('**/v1/auth/logout', async (route) => {
  route.fulfill({
    status: 500, // Simulate server error
    body: JSON.stringify({ message: 'Server error' })
  })
})

// ❌ Bad: Mock backend for normal flow
await page.route('**/v1/auth/login', async (route) => {
  route.fulfill({ 
    status: 200, 
    body: JSON.stringify({ tokens: mockTokens }) // Don't do this
  })
})
```

## Accessibility Labels Added

The following components now have `accessibilityLabel` attributes:

**Screens**:
- `login-screen` - LoginScreen
- `logout-screen` - LogoutScreen
- `profile-screen` - ProfileScreen

**Buttons**:
- `login-button` - Login submit button
- `logout-button` - Logout confirmation button
- `profile-logout-button` - Profile logout navigation button
- `go-to-login-button` - Error screen login button

**Inputs**:
- `email-input` - Email field
- `password-input` - Password field
- `signup-password-input` - Signup password field
- `signup-confirm-password-input` - Confirm password field

These labels:
- Map to `aria-label` in React Native Web
- Enable Playwright to find elements
- Improve accessibility for screen readers

## Expected Test Results

### What Tests Will Reveal

1. **Logout Button Issues**:
   - Does logout work with expired tokens?
   - Does logout work when API fails?
   - Is local state cleared even if backend fails?

2. **Token Expiration**:
   - Can users navigate with expired tokens?
   - Are expired tokens detected?
   - Are users logged out automatically?

3. **Invited User Flow**:
   - Do users get stuck on profile screen?
   - Are they redirected to signup properly?
   - Can they complete signup successfully?

### Debugging Failed Tests

If a test fails:
1. Check the screenshot in `test-results/`
2. Run with `--headed` to see what's happening
3. Check console logs for API call errors
4. Verify the accessibility labels are correct

## Helper Functions

### `ensureUserRegisteredAndLoggedInViaUI(page, name, email, password, phone)`
- Registers a new user through the UI
- Logs them in
- Returns when fully authenticated
- From `test/e2e/helpers/testHelpers.ts`

### `logoutViaUI(page)`
- Clicks through logout flow
- Returns when back on login screen
- From `test/e2e/helpers/testHelpers.ts`

## Next Steps

1. **Run the tests** to see current behavior
2. **Identify failures** - Which scenarios break?
3. **Fix the issues** in the app code
4. **Re-run tests** to verify fixes
5. **Add more tests** as needed for edge cases

## Benefits

- ✅ Tests real user flows, not mocked scenarios
- ✅ Catches real bugs that users would encounter
- ✅ Easy to debug (can see what's happening)
- ✅ Reliable (not dependent on mock timing)
- ✅ Maintainable (follows existing test patterns)

