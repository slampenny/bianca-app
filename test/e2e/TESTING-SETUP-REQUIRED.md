# Testing Setup Required for Invited User Tests

## Status

The Playwright tests for invited user authentication have been created but **cannot run yet** because the required `testID` attributes are missing from the React Native components.

## Why Tests Are Failing

The tests fail with errors like:
```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
waiting for locator('[data-testid="profile-screen"]') to be visible
```

This is because the components don't have the necessary `testID` props that Playwright uses to locate elements in the web version of the app.

## Required TestIDs

To make these tests work, you need to add `testID` attributes to the following components:

### Screens
- `testID="login-screen"` - LoginScreen main container
- `testID="signup-screen"` - SignupScreen main container
- `testID="profile-screen"` - ProfileScreen main container
- `testID="logout-screen"` - LogoutScreen main container
- `testID="home-screen"` - HomeScreen main container
- `testID="alerts-screen"` - AlertsScreen main container

### Buttons
- `testID="logout-button"` - Actual logout confirmation button on LogoutScreen
- `testID="profile-logout-button"` - Navigate to logout button on ProfileScreen
- `testID="go-to-login-button"` - Go to login button (on error screens)
- `testID="signup-submit-button"` - Signup form submit button
- `testID="login-button"` - Login form submit button
- `testID="profile-button"` - Profile navigation button
- `testID="update-profile-button"` - Update profile button

### Input Fields
- `testID="email-input"` - Email input field
- `testID="password-input"` - Password input field  
- `testID="signup-password-input"` - Signup password input
- `testID="signup-confirm-password-input"` - Confirm password input

### Other Elements
- `testID="home-header"` - Home screen header
- `testID="error-message"` - Error message display
- `testID="loading-spinner"` - Loading indicator

## Example Implementation

### ProfileScreen.tsx
```typescript
function ProfileScreen() {
  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.contentContainer}
      testID="profile-screen"  // ADD THIS
    >
      {/* ... content ... */}
      
      <Pressable
        style={styles.button}
        onPress={handleLogout}
        testID="profile-logout-button"  // ADD THIS
      >
        <Text style={styles.buttonText}>Logout</Text>
      </Pressable>
    </ScrollView>
  )
}
```

### LogoutScreen.tsx
```typescript
export const LogoutScreen = () => {
  return (
    <Screen 
      style={styles.container}
      testID="logout-screen"  // ADD THIS
    >
      <Text style={styles.title} tx="logoutScreen.logoutMessage" />
      <Button
        tx="logoutScreen.logoutButton"
        onPress={handleLogoutPress}
        style={styles.logoutButton}
        textStyle={styles.logoutButtonText}
        preset="filled"
        testID="logout-button"  // ALREADY EXISTS
      />
    </Screen>
  )
}
```

### LoginScreen.tsx
```typescript
export const LoginScreen: FC<LoginScreenProps> = ({ navigation }) => {
  return (
    <Screen style={styles.container} testID="login-screen">  // ADD THIS
      {/* ... content ... */}
      
      <TextField
        value={authEmail}
        onChangeText={handleEmailChange}
        testID="email-input"  // ADD THIS
        // ... other props
      />
      
      <TextField
        value={authPassword}
        onChangeText={setAuthPassword}
        testID="password-input"  // ADD THIS
        // ... other props
      />
      
      <Button
        onPress={handleLoginPress}
        testID="login-button"  // ADD THIS
        // ... other props
      />
    </Screen>
  )
}
```

## Alternative Approach: Integration Tests

Instead of mock-based unit tests, consider creating **integration tests** that:
1. Don't rely on mocking Redux state
2. Actually test the user flow from login to logout
3. Use the existing test helpers like `ensureUserRegisteredAndLoggedInViaUI()`
4. Test real scenarios instead of edge cases

See `workflow-successful-login.e2e.test.ts` for examples of working integration tests.

## Running the Tests (Once TestIDs Are Added)

```bash
# Start the dev server
cd /home/jordanlapp/code/bianca-app/bianca-app-frontend
yarn bundle:web:staging
npx serve dist -l 8082  # In background

# Run tests
npx playwright test invited-user-logout-issues --reporter=list
npx playwright test invited-user-auth-workflow --reporter=list
npx playwright test token-expiration-navigation --reporter=list
```

## Priority

**High Priority TestIDs** (for logout issues):
1. `testID="profile-screen"` on ProfileScreen
2. `testID="logout-screen"` on LogoutScreen
3. `testID="profile-logout-button"` on logout navigation button
4. `testID="logout-button"` on confirmation button (likely already exists)

**Medium Priority TestIDs** (for auth flow):
5. `testID="login-screen"` on LoginScreen
6. `testID="signup-screen"` on SignupScreen
7. `testID="go-to-login-button"` on error fallback buttons

**Low Priority** (for comprehensive testing):
- All input fields
- All navigation elements
- Error messages and loading states

## Next Steps

1. Add the high-priority testIDs to ProfileScreen and LogoutScreen
2. Run a single test to verify: `npx playwright test --grep="Logout button works with valid tokens"`
3. Add remaining testIDs incrementally
4. Run full test suite once all testIDs are in place

## Benefits Once Implemented

- **Catches Logout Bugs**: Will immediately show if logout button stops working
- **Validates Token Expiration**: Ensures users can't navigate with expired tokens
- **Tests Invite Flow**: Verifies invited users aren't getting stuck
- **Regression Prevention**: Future changes won't break authentication flows
- **Documentation**: Tests serve as living documentation of expected behavior
