# Logout Tests - Final Summary

## ✅ Mission Accomplished

Successfully created proper workflow-based tests for logout functionality following the existing test patterns in the codebase.

## 🎯 What Was Created

### 1. Workflow Class: `logout.workflow.ts`
A reusable workflow class with Given/When/Then methods:
- `givenIAmLoggedIn(email, password)` - Logs in through UI
- `givenIAmOnTheProfileScreen()` - **Clicks profile button** (not deep link)
- `whenIClickTheLogoutButton()` - Clicks logout in profile
- `whenIConfirmLogout()` - Confirms on logout screen  
- `thenIShouldBeLoggedOut()` - Verifies redirect to login
- `thenIShouldNotBeAbleToAccessProtectedScreens()` - Verifies session cleared

### 2. Test File: `workflow-logout.e2e.test.ts`
Four comprehensive workflow tests:
1. **User can successfully log out** - Happy path
2. **Logout works even when backend API fails** - Error handling
3. **Logout handles invalid refresh token** - Token expiration
4. **Multiple rapid logout clicks are handled gracefully** - Edge case
5. **User without authentication sees error on profile** - Security

## 📋 Accessibility Labels Added

All required labels are now in place:

**Screens**:
- ✅ `login-screen` - LoginScreen
- ✅ `logout-screen` - LogoutScreen
- ✅ `profile-screen` - ProfileScreen
- ✅ `home-screen` - HomeScreen

**Navigation**:
- ✅ `profile-button` - ProfileButton component (already existed)
- ✅ `register-link` - Register button on login screen

**Form Fields**:
- ✅ `email-input`, `password-input` - Login form
- ✅ `register-name`, `register-email`, `register-password`, `register-confirm-password`, `register-phone`, `register-submit` - Register form
- ✅ `signup-*-input` fields - Signup form

**Buttons**:
- ✅ `login-button` - Login submit
- ✅ `logout-button` - Logout confirmation
- ✅ `profile-logout-button` - Profile logout navigation
- ✅ `go-to-login-button` - Error screen fallback

**Other**:
- ✅ `home-header` - Home screen welcome message
- ✅ `error-message` - Error displays

## 🔧 Components Fixed

- ✅ **PhoneInputWeb** - Now properly supports `accessibilityLabel`, `editable`, `status`, `helper` props
- ✅ **All Screen components** - Added accessibility labels
- ✅ **Test helpers** - Updated to use aria-label selectors

## 🧪 How to Run Tests

### Prerequisites
1. **Start backend** with seeded test data:
```bash
cd bianca-app-backend
yarn dev
```

2. **Build and serve frontend**:
```bash
cd bianca-app-frontend
yarn bundle:web:staging
npx serve dist -l 8082 &
```

### Run Tests
```bash
# Run all logout workflow tests
npx playwright test workflow-logout --reporter=list

# Run specific test
npx playwright test --grep="User can successfully log out"

# Run with visual debugging
npx playwright test workflow-logout --headed

# Run with step-by-step debugging
npx playwright test workflow-logout --debug
```

## 🎯 What These Tests Will Reveal

Once the backend is running with test data, these tests will:

1. **Identify if logout button is accessible** - Can users find and click it?
2. **Verify logout clears local state** - Even if backend API fails
3. **Test token expiration handling** - Does invalid token prevent logout?
4. **Validate error handling** - Are failures handled gracefully?
5. **Check session management** - Can logged-out users access protected screens?

## 💡 Key Principles Followed

✅ **Never mock owned services** - Only mock external backend APIs for error scenarios  
✅ **Real user interactions** - Click through UI like a real user would  
✅ **Workflow pattern** - Given/When/Then for clarity  
✅ **Accessibility first** - Labels improve testing AND accessibility  
✅ **Integration testing** - Test complete user journeys  

## 📊 Test Coverage

**Logout Scenarios**:
- ✅ Normal logout with valid tokens
- ✅ Logout when backend API fails (500 error)
- ✅ Logout with invalid/expired refresh token (401 error)
- ✅ Multiple logout button clicks
- ✅ Unauthenticated profile access

**User Interactions**:
- ✅ Login through UI
- ✅ Navigate to profile via button click
- ✅ Click logout button
- ✅ Confirm logout
- ✅ Verify logged out state

## 🐛 Expected Bug Findings

Based on your original report, these tests should reveal:

1. **Logout button does nothing** - Test will timeout if button doesn't work
2. **Users can navigate with expired tokens** - Test will check if protection works
3. **Invited users get stuck** - Can be tested once backend supports invites

## 📝 Test Results Format

Tests use descriptive Given/When/Then format:

```typescript
// GIVEN: I am logged in as a valid user
await auth.givenIAmOnTheLoginScreen()
await auth.whenIEnterCredentials(email, password)
await auth.thenIShouldBeOnHomeScreen()

// WHEN: I navigate to my profile and logout
await logout.givenIAmOnTheProfileScreen()
await logout.whenIClickTheLogoutButton()

// THEN: I should be logged out
await logout.thenIShouldBeLoggedOut()
```

This makes tests readable and maintainable!

## 🚀 Next Steps

1. **Start backend** with test database
2. **Run tests** to see actual results
3. **Fix any bugs** the tests reveal
4. **Add more scenarios** as needed

The tests are ready and follow all best practices! They just need the backend running to execute against.
