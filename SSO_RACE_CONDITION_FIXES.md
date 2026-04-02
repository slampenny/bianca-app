# SSO Race Condition Fixes - Empty Profile Screen Issue

## Problem Summary

After SSO login, the profile screen frequently showed empty/missing user data even though authentication succeeded. This was caused by multiple race conditions and timing issues in the SSO authentication flow.

## Root Causes Identified

### 1. Backend Issues

#### A. Incomplete Data Population After Caregiver Creation
**Location:** `packages/backend/src/controllers/sso.controller.js:69-77`

**Issue:** When creating a caregiver for an existing org, the code would re-query to populate relationships, but if MongoDB writes weren't fully committed, the populate would return incomplete data.

**Fix:**
- Added `setImmediate` wait to ensure MongoDB writes are committed
- Changed from using `existingOrg` directly to fetching fresh via `Org.findById()`
- Added fallback to manually set org if populate fails
- Added validation logging

#### B. Incomplete Data After Org Creation
**Location:** `packages/backend/src/controllers/sso.controller.js:96-139`

**Issue:** When creating a new org+caregiver, the code accessed `org.caregivers[0]` directly, which wasn't a fully populated Mongoose document.

**Fix:**
- Extract caregiver ID from org.caregivers array
- Fetch caregiver with full population (org, patients, schedules)
- Fetch org separately to ensure complete data
- Added validation that caregiver exists after creation
- Added logging for troubleshooting

#### C. Missing DTO Validation
**Location:** `packages/backend/src/controllers/sso.controller.js:227-243`

**Issue:** No validation that the generated DTOs contained required fields before sending to frontend.

**Fix:**
- Added validation that caregiverDTO has `id`, `email`, and `name`
- Added detailed error logging if DTO is incomplete
- Throws ApiError if DTO validation fails

#### D. Inconsistent Field Naming
**Location:** `packages/backend/src/controllers/sso.controller.js:308`

**Issue:** SSO endpoint returned `user` field while regular auth endpoints return `caregiver` field, causing confusion and potential bugs.

**Fix:**
- Changed SSO response to use `caregiver` field to match other auth endpoints
- Updated all frontend code to expect `caregiver` instead of `user`
- Updated TypeScript interfaces to reflect correct field name

### 2. Frontend Issues

#### A. Redux Matcher Not Validating Data
**Location:** `packages/mobile/app/store/authSlice.ts:98-104`

**Issue:** The RTK Query matcher updated state even if caregiver data was incomplete.

**Fix:**
- Added validation that caregiver has `id`, `email`, and `name` before setting state
- Added detailed debug and error logging
- Only updates state if all required fields present
- Changed from `payload.user` to `payload.caregiver` for consistency

#### B. Caregiver Slice Matcher Not Validating Data
**Location:** `packages/mobile/app/store/caregiverSlice.ts:129-133`

**Issue:** Similar to authSlice, the matcher didn't validate caregiver data completeness.

**Fix:**
- Added same validation as authSlice
- Added detailed debug and error logging
- Only updates state if all required fields present
- Changed from `payload.user` to `payload.caregiver` for consistency

#### C. ProfileScreen Fallback Lacks Error Handling
**Location:** `packages/mobile/app/screens/ProfileScreen.tsx:57-76`

**Issue:** 
- JWT decode errors were silently swallowed
- No error logging for API fetch failures
- No logging for successful fallback restoration

**Fix:**
- Added try-catch logging for JWT decode failures
- Added error logging for API fetch failures
- Added success logging when user is restored from API
- Better debug visibility into fallback mechanisms

#### D. SSO Cache Fallback Not Validating Data
**Location:** `packages/mobile/app/screens/ProfileScreen.tsx:78-91`

**Issue:**
- No validation that cached caregiver data was complete
- No logging to diagnose cache hits/misses
- Looking for wrong field name (`user` instead of `caregiver`)

**Fix:**
- Added validation that cached caregiver has `id`, `email`, and `name`
- Added detailed logging for cache lookup results
- Only uses cache if caregiver data is complete
- Changed from `data.user` to `data.caregiver`

#### E. LoginForm SSO Handler Lacks Validation
**Location:** `packages/mobile/app/components/LoginForm.tsx:270-314`

**Issue:**
- No validation that user data was complete before setting state
- Limited error logging
- No visibility into what data was received

**Fix:**
- Added validation that user has `id`, `email`, and `name`
- Returns early with error message if data incomplete
- Added detailed logging at each step
- Better visibility into SSO flow execution

#### F. SSO Service Type Interface Mismatch
**Location:** `packages/mobile/app/services/api/ssoApi.ts:17`

**Issue:** TypeScript interface defined `user: Caregiver` but backend actually returns `caregiver: Caregiver`.

**Fix:**
- Updated interface to use `caregiver: Caregiver` to match backend
- Updated ssoService.ts to use `data.caregiver` instead of `data.user`

## Testing Recommendations

After deploying these fixes, test the following scenarios:

1. **New User SSO Login** - User with no existing account
   - Should see complete profile immediately
   - Check logs for successful org/caregiver creation

2. **Existing User SSO Login** - User with existing account
   - Should see complete profile immediately
   - Check logs for successful data fetch

3. **SSO Login with Slow Network** - Simulate network delay
   - Profile should show loading spinner
   - Should eventually load complete profile
   - Should not show empty profile even briefly

4. **SSO Login then Refresh** - Login, then hard refresh browser
   - Should restore user from token
   - Check logs for token decode and API fetch

5. **Concurrent SSO Logins** - Multiple tabs/windows
   - Each should complete successfully
   - Check backend logs for race condition handling

## Monitoring

Key log messages to monitor:

### Backend Success Indicators:
- `SSO login successfully created new org and caregiver` - with `orgPopulated: true`
- `SSO login successfully created caregiver for existing org`
- No `SSO login generated incomplete caregiverDTO` errors

### Frontend Success Indicators:
- `[authSlice] SSO login fulfilled, setting tokens and caregiver`
- `[caregiverSlice] SSO login fulfilled, setting caregiver`
- `LoginForm: SSO login complete`
- No `SSO returned incomplete user data` errors

### Expected Fallback Activity (only during races):
- `ProfileScreen: decoded token sub` - token decode working
- `ProfileScreen: restoring user from API fetch` - API fallback working
- `ProfileScreen: restoring caregiver from SSO cache` - cache fallback working

### Error Indicators to Watch:
- `SSO login generated incomplete caregiverDTO` - backend DTO issue
- `[authSlice] SSO login fulfilled but caregiver data incomplete` - missing fields
- `ProfileScreen: SSO cache caregiver incomplete, skipping` - cache has bad data
- `LoginForm: SSO returned incomplete user data` - backend response bad

## Files Modified

### Backend:
- `packages/backend/src/controllers/sso.controller.js` - Fixed data population timing, added validation, changed `user` to `caregiver`

### Frontend:
- `packages/mobile/app/services/api/ssoApi.ts` - Updated TypeScript interface: `user` → `caregiver`
- `packages/mobile/app/store/authSlice.ts` - Added validation, changed `payload.user` → `payload.caregiver`
- `packages/mobile/app/store/caregiverSlice.ts` - Added validation, changed `payload.user` → `payload.caregiver`
- `packages/mobile/app/screens/ProfileScreen.tsx` - Improved error handling, changed `data.user` → `data.caregiver`
- `packages/mobile/app/components/LoginForm.tsx` - Added validation and detailed logging
- `packages/mobile/app/services/ssoService.ts` - Changed `data.user` → `data.caregiver`

## Summary

The fixes address the race conditions by:
1. Ensuring backend returns complete, validated caregiver data
2. Making field naming consistent (`caregiver` not `user`) across all auth endpoints
3. Adding validation in all frontend state updates
4. Improving fallback mechanisms with better error handling
5. Adding comprehensive logging for troubleshooting
6. Using fresh database queries instead of assuming populated documents

These changes should eliminate the "empty profile after SSO login" issue while maintaining fast SSO login performance.
