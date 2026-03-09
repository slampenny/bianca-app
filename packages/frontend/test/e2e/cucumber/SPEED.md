# Why Cucumber E2E Is Slow (and how to fix it)

## The numbers

- **189** `waitForTimeout()` calls across step definitions
- **~5+ minutes** of **pure sleeping** in a full run:
  - 100 × 2s = 200s
  - 47 × 1s = 47s
  - 16 × 3s = 48s
  - 16 × 0.5s = 8s
  - 3 × 4s = 12s
  - etc.

Plus:

- **Sequential execution** – all scenarios run one after another (no parallel workers)
- **Full login every scenario** – "Given I am logged in" does a real login each time
- **Real browser + real app** – Playwright, real frontend, real backend

So 15–20+ minutes for ~60 scenarios is mostly **fixed delays**, not the 40 tests themselves.

## Quick wins

1. **Replace fixed sleeps with conditional waits**  
   Use Playwright’s `locator.waitFor({ state: 'visible', timeout: 5000 })` (or `attached`, `hidden`) instead of `waitForTimeout(2000)` so steps proceed as soon as the UI is ready.

2. **Reduce sleep durations where they’re “let the UI settle”**  
   Many 2000ms/3000ms sleeps can be 300–500ms or removed once you wait on a specific element.

3. **Reuse login state**  
   Log in once per feature (or per worker) and reuse the session (e.g. storage state) instead of logging in in every scenario.

4. **Run in parallel**  
   Use Cucumber’s parallel formatter or split by feature and run multiple `cucumber-js` processes (e.g. 4 workers) so total wall time drops.

5. **Tag a fast smoke set**  
   e.g. `@smoke` with a few critical scenarios and run only those for quick feedback:  
   `CUCUMBER_TAGS="@smoke" yarn test:cucumber`

## Where the sleeps are

| File              | ~Count | Typical value |
|-------------------|--------|----------------|
| payment_steps.js  | 35+    | 2000, 3000     |
| common_steps.js   | 30+    | 1000–3000      |
| schedule_steps.js | 25+    | 2000, 3000, 10000 |
| fraud_abuse_steps.js | 20+  | 2000, 4000     |
| privacy_steps.js  | 20+    | 1000, 2000     |
| invite_steps.js   | 15+    | 500, 2000      |
| mfa_steps.js      | 10+    | 2000, 3000     |
| alert_steps.js    | 1      | 2000           |
| patient_steps.js  | 1      | 1000           |

Tackle `payment_steps.js` and `common_steps.js` first for the biggest impact.

## Done: `waitForTimeout` → `locator.waitFor`

The following files have been updated to use conditional waits instead of fixed sleeps:

- **payment_steps.js** – all waits replaced with waits on payment/org/screen elements
- **common_steps.js** – all waits replaced (except the explicit “I wait X seconds” step)
- **schedule_steps.js** – all waits replaced with waits on schedule/client/screen elements
- **fraud_abuse_steps.js** – all waits replaced with waits on reports/fraud-abuse elements
- **alert_steps.js** – all safeWait calls replaced with locator.waitFor / waitForResponse
- **patient_steps.js** – all safeWait calls replaced with locator.waitFor
- **auth_steps.js** – all safeWait calls replaced with locator.waitFor

**Why the suite is still not “much” faster:** Several files still use **fixed sleeps** (`safeWait` / `waitForTimeout`): caregiver_steps.js (~28), mfa_steps.js (~26), privacy_steps.js (~25), verification_steps.js (~21), invite_steps.js (~14), password_reset_steps.js (~8). Replacing those with `locator.waitFor` the same way will reduce run time further.
