# Testing Setup Required for Invited User Tests

## Status

The Playwright tests for invited user authentication have been created but **cannot run yet** because the required `accessibilityLabel` attributes are missing from the React Native components.

## Why Tests Are Failing

The tests fail with errors like:
```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
waiting for locator('[aria-label="profile-screen"]') to be visible
```

This is because React Native Web uses **`accessibilityLabel`** (which maps to `aria-label` in web) to locate elements, not `testID`.

## Required Accessibility Labels

To make these tests work, you need to add `accessibilityLabel` attributes to the following components:

### Screens
- `accessibilityLabel="login-screen"` - LoginScreen main container
- `accessibilityLabel="signup-screen"` - SignupScreen main container
- `accessibilityLabel="profile-screen"` - ProfileScreen main container
- `accessibilityLabel="logout-screen"` - LogoutScreen main container
- `accessibilityLabel="home-screen"` - HomeScreen main container
- `accessibilityLabel="alerts-screen"` - AlertsScreen main container

### Buttons
- `accessibilityLabel="logout-button"` - Actual logout confirmation button on LogoutScreen
- `accessibilityLabel="profile-logout-button"` - Navigate to logout button on ProfileScreen
- `accessibilityLabel="go-to-login-button"` - Go to login button (on error screens)
- `accessibilityLabel="signup-submit-button"` - Signup form submit button
- `accessibilityLabel="login-button"` - Login form submit button
- `accessibilityLabel="profile-button"` - Profile navigation button
- `accessibilityLabel="update-profile-button"` - Update profile button

### Input Fields
- `accessibilityLabel="email-input"` - Email input field
- `accessibilityLabel="password-input"` - Password input field  
- `accessibilityLabel="signup-password-input"` - Signup password input
- `accessibilityLabel="signup-confirm-password-input"` - Confirm password input

### Other Elements
- `accessibilityLabel="home-header"` - Home screen header
- `accessibilityLabel="error-message"` - Error message display
- `accessibilityLabel="loading-spinner"` - Loading indicator

## Example Implementation

### ProfileScreen.tsx
```typescript
function ProfileScreen() {
  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.contentContainer}
      accessibilityLabel="profile-screen"  // ADD THIS
    >
      {/* ... content ... */}
      
      <Pressable
        style={styles.button}
        onPress={handleLogout}
        accessibilityLabel="profile-logout-button"  // ADD THIS
        accessible={true}
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
      accessibilityLabel="logout-screen"  // ADD THIS
    >
      <Text style={styles.title} tx="logoutScreen.logoutMessage" />
      <Button
        tx="logoutScreen.logoutButton"
        onPress={handleLogoutPress}
        style={styles.logoutButton}
        textStyle={styles.logoutButtonText}
        preset="filled"
        accessibilityLabel="logout-button"  // ADD THIS
      />
    </Screen>
  )
}
```

### LoginScreen.tsx
```typescript
export const LoginScreen: FC<LoginScreenProps> = ({ navigation }) => {
  return (
    <Screen 
      style={styles.container} 
      accessibilityLabel="login-screen"  // ADD THIS
    >
      {/* ... content ... */}
      
      <TextField
        value={authEmail}
        onChangeText={handleEmailChange}
        accessibilityLabel="email-input"  // ADD THIS
        // ... other props
      />
      
      <TextField
        value={authPassword}
        onChangeText={setAuthPassword}
        accessibilityLabel="password-input"  // ADD THIS
        // ... other props
      />
      
      <Button
        onPress={handleLoginPress}
        accessibilityLabel="login-button"  // ADD THIS
        // ... other props
      />
    </Screen>
  )
}
```

**Note**: React Native Web automatically maps `accessibilityLabel` to `aria-label` in the DOM, which Playwright can find.

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
