# Root cause of unexpected 401s in E2E tests

## What we saw

- **getCaregiver** (and sometimes **getAlerts**) return **401 Unauthorized** shortly after login when navigating (e.g. to billing or alerts).
- Login itself succeeds (`authApi.login.matchFulfilled`), but a later request fails with 401.

## Root cause: full page reload + async rehydration

1. **Auth is persisted**  
   The app uses `redux-persist` for the auth slice (tokens, currentUser). On load, state is rehydrated from storage **asynchronously**.

2. **Step did a full page reload**  
   Steps like "I am on the billing screen" used `page.goto(baseURL)`, which **reloads the page**. After reload, the app boots with empty Redux state, then persist rehydrates in the background.

3. **Requests ran before rehydration**  
   As soon as the app mounts, components (e.g. `PhoneVerificationBanner` with `useGetCaregiverQuery`, or screens that call `getOrg` / `getCaregiver`) trigger API calls. `prepareHeaders` in `baseQueryWithAuth` reads `getState().auth.tokens?.access?.token`. If rehydration has not finished yet, `auth.tokens` is still `null`, so the request is sent **without** the `Authorization: Bearer …` header → backend returns **401**.

So the 401s are not due to an invalid or expired token; they are due to **no token being sent** because the request ran before the persisted token was restored to Redux.

## Fix (what we did)

- **Avoid unnecessary full page reloads** when the test is already on the app. Steps updated: "I am on the billing screen" (payment_steps.js), "I am on the alerts screen" (alert_steps.js), "I am on the schedules screen" (schedule_steps.js). Only call `page.goto(baseURL)` if we’re not already on the app (e.g. URL not baseURL or tabs not visible). If we’re already on the app after login, we keep the in-memory auth state and don’t trigger the rehydration race.

## If 401s still appear

- Look for other steps that use `page.goto()` in the middle of a flow (after login). Prefer in-app navigation (e.g. clicking tabs/links) when the user is already logged in.
- Optionally, in test env, you could delay or gate authenticated API calls until after rehydration (e.g. a “rehydration complete” flag); that’s a larger app change and usually unnecessary if we avoid reloads in E2E.
