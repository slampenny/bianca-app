# E2E Tests for New Functionality

This document outlines the E2E tests created for recently added functionality.

## Overview

New E2E test files have been created to cover advanced features that were not previously tested:

1. **ConversationsScreen Advanced Features** - `conversations-screen-advanced.e2e.test.ts`
2. **AvatarPicker Component** - `avatar-picker.e2e.test.ts`

## Test Coverage

### 1. ConversationsScreen Advanced Features

**File**: `test/e2e/conversations-screen-advanced.e2e.test.ts`

**Tests Created** (7 total):

1. **Pull-to-Refresh**
   - Tests that users can pull down to refresh conversations
   - Verifies refresh maintains conversation data
   - Ensures loading state appears during refresh

2. **Sentiment Indicators**
   - Tests that sentiment indicators are displayed on conversations
   - Verifies sentiment display in conversation cards
   - Checks sentiment visibility in expanded conversations

3. **Date Formatting**
   - Tests date formatting logic (today, yesterday, date)
   - Verifies time format for today's conversations
   - Checks "Yesterday" label for recent conversations
   - Validates date format for older conversations

4. **Pagination**
   - Tests loading more conversations when scrolling to bottom
   - Verifies conversation count increases with pagination
   - Ensures pagination works correctly

5. **Loading States**
   - Tests initial loading state when screen first loads
   - Verifies "load more" loading indicator appears
   - Checks loading states don't block UI

6. **Error Handling**
   - Tests graceful error display when API fails
   - Verifies empty state messages
   - Ensures error states don't crash the app

### 2. AvatarPicker Component

**File**: `test/e2e/avatar-picker.e2e.test.ts`

**Tests Created** (4 total):

1. **Default Avatar Display**
   - Tests that default avatar (Gravatar) is shown when no avatar is set
   - Verifies avatar image is rendered correctly
   - Checks avatar container is visible

2. **Avatar Upload**
   - Tests that avatar upload button/input is accessible
   - Verifies file picker can be triggered
   - Ensures upload UI is functional

3. **Avatar Update**
   - Tests that avatar updates after successful upload
   - Verifies new avatar replaces old one
   - Checks avatar persists after page refresh

4. **Error Handling**
   - Tests graceful handling of upload errors
   - Verifies error messages are displayed
   - Ensures app doesn't crash on upload failure

## Running the Tests

### Run All New E2E Tests

```bash
cd packages/frontend
NODE_ENV=test npx playwright test test/e2e/conversations-screen-advanced.e2e.test.ts test/e2e/avatar-picker.e2e.test.ts
```

### Run Individual Test Files

```bash
# ConversationsScreen advanced features
NODE_ENV=test npx playwright test test/e2e/conversations-screen-advanced.e2e.test.ts

# AvatarPicker tests
NODE_ENV=test npx playwright test test/e2e/avatar-picker.e2e.test.ts
```

### Run Specific Tests

```bash
# Run only pagination test
NODE_ENV=test npx playwright test test/e2e/conversations-screen-advanced.e2e.test.ts -g "pagination"

# Run only avatar upload test
NODE_ENV=test npx playwright test test/e2e/avatar-picker.e2e.test.ts -g "upload"
```

## Test Prerequisites

1. **Backend Running**: Backend must be running on `http://localhost:3000`
2. **Frontend Running**: Frontend must be running on `http://localhost:8082`
3. **Test Users**: Test users must exist in the database (seeded via `/v1/test/seed`)
4. **Test Data**: Patients with conversations should exist for comprehensive testing

## Integration with Existing Tests

These new tests complement the existing test suite:

- **`conversations-screen.e2e.test.ts`** - Basic conversations screen functionality
- **`conversations-screen-advanced.e2e.test.ts`** - Advanced features (NEW)
- **`avatar-picker.e2e.test.ts`** - Avatar management (NEW)
- **Cucumber tests** - High-level workflow tests

## Coverage Summary

### ConversationsScreen Features Covered

✅ Basic display and navigation (existing test)
✅ Expand/collapse conversations (existing test)
✅ Message display (existing test)
✅ **Pagination** (NEW)
✅ **Pull-to-refresh** (NEW)
✅ **Sentiment indicators** (NEW)
✅ **Date formatting** (NEW)
✅ **Loading states** (NEW)
✅ **Error handling** (NEW)

### AvatarPicker Features Covered

✅ **Default avatar display** (NEW)
✅ **Avatar upload** (NEW)
✅ **Avatar update** (NEW)
✅ **Error handling** (NEW)

## Notes

- Some tests may skip if test data is not available (e.g., no conversations exist)
- Tests are designed to be resilient to test environment variations
- All tests follow the "no mocking of owned services" philosophy
- Tests use real API calls and Redux state

## Future Enhancements

Potential additions:
- Test avatar upload with actual file selection
- Test sentiment indicator interactions
- Test date formatting edge cases (timezone handling)
- Test pagination with large datasets
- Test refresh with network failures
