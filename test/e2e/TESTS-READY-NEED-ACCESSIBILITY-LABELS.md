# ✅ Tests Ready - Need Accessibility Labels

## Summary

Comprehensive Playwright tests for invited user authentication issues have been created and are **ready to run** once `accessibilityLabel` attributes are added to components.

## ✅ What's Been Fixed

- ✅ Tests now use `aria-label` selectors (React Native Web compatibility)
- ✅ Helper functions updated to use `accessibilityLabel` / `aria-label`
- ✅ All test files updated to use correct selectors
- ✅ Documentation updated with correct examples
- ✅ Tests committed to git

## 🎯 What Tests Cover

### Logout Button Issues (7 tests)
- Logout with expired tokens
- Logout with network errors
- Logout with missing tokens
- Multiple logout attempts
- Logout with invite token present

### Token Expiration (9 tests)
- Navigation with expired tokens
- API failures vs UI navigation
- Token refresh failures
- User returning after session expired
- Concurrent token refresh

### Invited User Flow (12 tests)
- Profile screen authentication errors
- Invite token persistence
- Signup completion and redirect
- Token expiration during signup

## 📝 Required: Add Accessibility Labels

### High Priority (for logout issues)
```typescript
// ProfileScreen.tsx
<ScrollView accessibilityLabel="profile-screen">
  <Pressable accessibilityLabel="profile-logout-button" accessible={true}>
    <Text>Logout</Text>
  </Pressable>
</ScrollView>

// LogoutScreen.tsx
<Screen accessibilityLabel="logout-screen">
  <Button accessibilityLabel="logout-button" />
</Screen>
```

### Medium Priority (for auth flow)
```typescript
// LoginScreen.tsx
<Screen accessibilityLabel="login-screen">
  <TextField accessibilityLabel="email-input" />
  <TextField accessibilityLabel="password-input" />
  <Button accessibilityLabel="login-button" />
</Screen>

// SignupScreen.tsx
<Screen accessibilityLabel="signup-screen">
  <TextField accessibilityLabel="signup-password-input" />
  <TextField accessibilityLabel="signup-confirm-password-input" />
  <Button accessibilityLabel="signup-submit-button" />
</Screen>
```

See `TESTING-SETUP-REQUIRED.md` for complete list.

## 🚀 Running Tests (Once Labels Are Added)

```bash
# Terminal 1: Serve the app
cd bianca-app-frontend
yarn bundle:web:staging
npx serve dist -l 8082

# Terminal 2: Run tests
cd bianca-app-frontend

# Run all invited user tests
npx playwright test invited-user --reporter=list

# Run specific test file
npx playwright test invited-user-logout-issues --reporter=list

# Run with headed mode (visual)
npx playwright test invited-user --headed

# Run single test for quick verification
npx playwright test --grep="Logout button works with valid tokens"
```

## 📊 Expected Results (Once Labels Added)

**Tests Will Show:**
1. **Exact scenarios where logout fails** - With expired tokens, network errors, etc.
2. **Navigation bugs** - Users navigating with expired tokens
3. **Invite flow issues** - Where users get stuck
4. **Token expiration handling** - How app behaves when tokens expire

## 🔍 Quick Verification

Add just these 4 labels for a quick test:
1. `accessibilityLabel="profile-screen"` on ProfileScreen
2. `accessibilityLabel="logout-screen"` on LogoutScreen
3. `accessibilityLabel="profile-logout-button"` on profile logout button
4. `accessibilityLabel="logout-button"` on logout confirmation button

Then run:
```bash
npx playwright test --grep="Logout button works with valid tokens"
```

If this test passes, the setup is working correctly!

## 📁 Test Files

- `invited-user-logout-issues.e2e.test.ts` - 7 logout tests
- `invited-user-auth-workflow.e2e.test.ts` - 12 workflow tests
- `token-expiration-navigation.e2e.test.ts` - 9 expiration tests
- `helpers/authHelpers.ts` - Utility functions
- `TESTING-SETUP-REQUIRED.md` - Implementation guide

## 💡 Why This Matters

These tests will:
- **Catch logout bugs** before they reach production
- **Validate token expiration** handling is working correctly
- **Ensure invited users** complete signup successfully
- **Prevent regressions** in authentication flows
- **Document behavior** as living documentation

## ⚠️ Important Notes

1. **React Native Web** uses `accessibilityLabel` → `aria-label` in DOM
2. **NOT `testID`** - That's for React Native only, not web
3. **Playwright** can find elements by `aria-label` automatically
4. **Good for accessibility** - These labels improve screen reader support too!

## 🎯 Next Steps

1. Add high-priority accessibility labels to logout flow components
2. Run quick verification test
3. Add remaining labels for complete coverage
4. Run full test suite
5. Fix any issues the tests reveal
6. Profit! 🎉

