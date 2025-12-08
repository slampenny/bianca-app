# TestID and Accessibility Label Pattern

**Status:** ✅ Implemented and Tested  
**Date:** November 2025

## Overview

This document describes the pattern for using `testID` for testing and `accessibilityLabel` for screen readers, ensuring both work correctly across React Native and React Native Web.

## The Problem

- **Testing needs:** Test-oriented identifiers like `"login-button"`, `"email-input"`
- **Accessibility needs:** User-friendly labels like `"Log in"`, `"Email address"`
- **React Native Web limitation:** `TextInput` doesn't automatically map `testID` to `data-testid` on web

## The Solution

### Pattern for All Components

```typescript
<Component
  testID="login-button"           // For testing (works on native, web via data-testid)
  accessibilityLabel="Log in"      // For screen readers (user-friendly)
/>
```

### Component-Specific Implementation

#### 1. TextInput/TextField Components

**Issue:** React Native Web's `TextInput` doesn't automatically map `testID` to `data-testid`.

**Solution:** Explicitly add `data-testid` on web:

```typescript
<TextInput
  testID={testID}
  // TextInput needs explicit data-testid on web (React Native Web doesn't map it automatically)
  {...(Platform.OS === 'web' && testID ? { 'data-testid': testID } : {})}
/>
```

**Playwright Usage:**
```typescript
// Use locator with data-testid (getByTestId doesn't work for inputs in React Native Web)
const emailInput = page.locator('input[data-testid="email-input"]')
await emailInput.fill('test@example.com')
```

#### 2. Pressable/Button Components

**No special handling needed:** React Native Web automatically maps `testID` to `data-testid` for `Pressable`.

```typescript
<Pressable testID={testID}>
  {/* testID automatically becomes data-testid on web */}
</Pressable>
```

**Playwright Usage:**
```typescript
// Both approaches work:
const button = page.getByTestId('login-button')
// or
const button = page.locator('[data-testid="login-button"]')
```

#### 3. View Components

**No special handling needed:** React Native Web automatically maps `testID` to `data-testid` for `View`.

```typescript
<View testID={testID}>
  {/* testID automatically becomes data-testid on web */}
</View>
```

## Updated Components

### ✅ TextField
- Added explicit `data-testid` for web
- Updated `accessibilityLabel` to be user-friendly in `LoginForm`

### ✅ Button
- Already works (Pressable handles it automatically)
- Updated `accessibilityLabel` to be user-friendly in `LoginForm`

### ✅ Card
- Already works (TouchableOpacity/Pressable handles it automatically)
- Removed fallback `accessibilityLabel={accessibilityLabel || testID}`

### ✅ Toggle
- Already works (Pressable handles it automatically)
- Removed fallback `accessibilityLabel={accessibilityLabel || testID}`

### ✅ LoadingButton
- Already works (Pressable handles it automatically)
- Removed fallback `accessibilityLabel={accessibilityLabel || testID}`

### ✅ Screen
- Already works (View handles it automatically)

## Label Guidelines

### ✅ Good Accessibility Labels
- `"Log in"` - Matches visible text
- `"Email address"` - Descriptive and natural
- `"Save patient"` - Clear action
- `"Delete schedule"` - Descriptive action
- `"Password"` - Simple and clear

### ❌ Bad Accessibility Labels (Test-Oriented)
- `"login-button"` - Technical identifier
- `"email-input"` - Technical identifier
- `"save-button"` - Technical identifier
- `"delete-button"` - Technical identifier

## Playwright Test Patterns

### For TextInput/TextField
```typescript
// Use locator with data-testid
const emailInput = page.locator('input[data-testid="email-input"]')
await emailInput.fill('test@example.com')
```

### For Buttons/Pressable
```typescript
// Use getByTestId (works automatically)
const loginButton = page.getByTestId('login-button')
await loginButton.click()

// Or use locator
const loginButton = page.locator('[data-testid="login-button"]')
await loginButton.click()
```

### For Containers/Views
```typescript
// Use getByTestId (works automatically)
const profileScreen = page.getByTestId('profile-screen')

// Or use locator
const profileScreen = page.locator('[data-testid="profile-screen"]')
```

## Migration Checklist

When updating components:

- [ ] Remove fallback `accessibilityLabel={accessibilityLabel || testID}`
- [ ] Ensure `accessibilityLabel` is user-friendly (not test-oriented)
- [ ] For `TextInput`: Add explicit `data-testid` on web
- [ ] For `Pressable`/`Button`: No changes needed (works automatically)
- [ ] For `View`: No changes needed (works automatically)
- [ ] Update Playwright tests to use `locator('input[data-testid="..."]')` for inputs
- [ ] Update Playwright tests to use `getByTestId()` or `locator('[data-testid="..."]')` for buttons

## Testing

✅ Verified with `test-testid-approach.e2e.test.ts`:
- TextField inputs can be found using `locator('input[data-testid="email-input"]')`
- Buttons can be found using `getByTestId('login-button')`
- Both `testID` (native) and `data-testid` (web) work correctly

## Next Steps

1. **Update remaining components** to remove `accessibilityLabel || testID` fallbacks
2. **Update all `accessibilityLabel` values** to be user-friendly
3. **Update Playwright tests** to use `data-testid` selectors
4. **Document the pattern** in component development guidelines

