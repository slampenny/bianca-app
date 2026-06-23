# Family Mobile Access — Implementation Plan

**Status:** Plan (pre-implementation)  
**Branch:** `feat/family-mobile-access`  
**Last updated:** 2026-06-10

---

## 1. Goals

Enable **facility family members** (digest recipients configured on a resident) to use the **existing mobile app** to view information about **only the residents they are linked to**—not the full facility staff experience.

In parallel, ship **weekly family digests in the mobile app for B2C** account owners (personal org caregivers), reusing the same digest UI and APIs.

### Account modes (one app, two behaviors)

| | **B2C mode** | **Org-family mode** |
|--|--------------|---------------------|
| **Identity** | `orgAdmin` / self-serve caregiver on personal org | New `family` role on facility org |
| **Residents shown** | Clients they manage (self-created) | Only residents with an explicit link |
| **Weekly digests** | Yes | Yes |
| **Alerts tab** | Yes | **Hidden** |
| **Emergency SMS** | Yes (orgAdmin on client) | **No** |

### Per-resident linking (org-family)

Access is **not** org-wide. Each account holds zero or more links:

```
(clientId, recipientId) → must match a row on client.familyDigestRecipients[]
```

Example: Mom (client 1) has daughter + son as recipients; Dad (client 2) has son only → daughter sees 1 resident, son sees 2.

---

## 2. Non-goals (this project)

- Separate web “family portal”
- Full conversation transcripts / recordings for org-family
- Facility operational reports (alert audit, call completion CSV)
- Org-family alert inbox or emergency SMS
- Phase 2+ items unless noted: family-safe call history API, push notifications, medical/sentiment gating by org settings

---

## 3. Architecture summary

### 3.1 Identity

Extend **`Caregiver`** with role **`family`** (same collection as staff; different RBAC and UI mode).

Add **`FamilyResidentLink`** (name TBD) collection **or** embed links on caregiver when `role === 'family'`:

```javascript
// Preferred: separate collection for audit + revoke
FamilyResidentLink {
  caregiverId      // family account
  orgId
  clientId
  recipientId      // familyDigestRecipients[]._id on that client
  portalEnabled    // staff can disable without deleting recipient
  invitedAt, invitedBy, revokedAt
}
```

Login returns **`linkedResidents[]`** for the app picker.

### 3.2 Authorization invariant

Every family-scoped API call:

1. Authenticated caregiver with `role === 'family'`
2. Valid `FamilyResidentLink` for requested `clientId`
3. Live check: `recipientId` still on `client.familyDigestRecipients`, email matches account, `portalEnabled`, org portal enabled, client consent OK

Never list clients via org membership alone.

### 3.3 SMS guard

```javascript
SMS_ELIGIBLE_ROLES = ['staff', 'orgAdmin', 'superAdmin']
```

Filter in `emergencyProcessor.getClientCaregivers()` (or immediately before `sendEmergencyAlert`).

---

## 4. Implementation phases

Work proceeds in order. Each phase should merge green tests before the next.

---

### Phase 0 — Foundations (backend schema + RBAC)

**Objective:** Data model and permissions exist; no mobile UI yet.

#### Step 0.1 — Org settings

- [ ] Add `familyPortalSettings` on `Org` model:
  - `enabled: boolean` (default `false`)
  - `allowInviteAfterDigestVerify: boolean` (default `true`)
- [ ] Validation in `org.validation.js`, DTO in `org.dto.js`
- [ ] PATCH/GET via existing org routes (orgAdmin only)
- [ ] Unit tests: `org.service.test.js`, `org.test.js` integration

**Files:** `packages/backend/src/models/org.model.js`, `validations/org.validation.js`, `dtos/org.dto.js`, `services/org.service.js`

#### Step 0.2 — FamilyResidentLink model

- [ ] Create `familyResidentLink.model.js` with indexes:
  - Unique `(caregiverId, clientId, recipientId)` where `revokedAt` null
  - `(caregiverId, revokedAt)`
  - `(clientId, recipientId)`
- [ ] Export from `models/index.js`

#### Step 0.3 — `family` role

- [ ] Add `family` to `roles` array in `config/roles.js`
- [ ] Permissions (minimum):
  - `readOwn:caregiver`, `updateOwn:caregiver`
  - `readOwn:familyDigest`
  - `readOwn:familyResident` (minimal client fields for header/picker)
- [ ] Explicitly **no** alert, conversation, medicalAnalysis, org admin permissions
- [ ] Add `family` to caregiver validation enum where roles are listed
- [ ] Phone **optional** for `family` in `caregiver.model.js` required-phone logic

#### Step 0.4 — Link service + access helpers

- [ ] Create `familyResidentLink.service.js`:
  - `createLink(caregiverId, orgId, clientId, recipientId, invitedBy)`
  - `revokeLink(linkId | caregiverId + clientId)`
  - `listActiveLinksForCaregiver(caregiverId)`
  - `assertFamilyAccess(caregiver, clientId)` → link + live recipient validation
- [ ] Create `familyAccess.util.js` (or extend `accessControl.js`):
  - `isOrgFamilyMode(caregiver) => caregiver.role === 'family'`
  - `isSmsEligibleRole(role)`

#### Step 0.5 — minimumNecessary

- [ ] Add `family` block in `minimumNecessary.js`:
  - **client / familyResident:** `id`, `name`, `preferredName`, `avatar`, `preferredLanguage` only
  - **familyDigest:** full sent payload (same boundaries as email)
- [ ] Unit tests in `minimumNecessary.test.js`

#### Step 0.6 — Emergency SMS filter

- [ ] Update `getClientCaregivers()` to exclude caregivers where `role === 'family'` (or not in `SMS_ELIGIBLE_ROLES`)
- [ ] Unit/integration test: family caregiver on `client.caregivers` with phone does **not** receive SMS

**Files:** `packages/backend/src/services/emergencyProcessor.service.js`, tests under `tests/unit/` or `tests/integration/`

---

### Phase 1 — Staff invite + family auth (backend)

**Objective:** Facility can invite a digest recipient; family user can log in and see linked residents in API.

#### Step 1.1 — Invite flow (staff)

- [ ] `POST /v1/clients/:clientId/family-portal/invite` body: `{ recipientId }`
  - Auth: orgAdmin (or staff if we explicitly deny — **default orgAdmin only**)
  - Preconditions: org `familyPortalSettings.enabled`, recipient exists, digest email verified (reuse `familyDigestEligibility`)
  - If no caregiver with recipient email: create `family` caregiver (invited state) + send invite email
  - If caregiver exists: add/update `FamilyResidentLink`
  - Add caregiver to `client.caregivers[]` if not present (for roster consistency; SMS still filtered by role)
- [ ] `DELETE` or `PATCH .../revoke` to revoke link
- [ ] `GET /v1/clients/:clientId/family-portal` — status per recipient (not invited / invited / active / revoked)

**Files:** `client.route.js`, `client.controller.js`, `client.validation.js`, `client.service.js`, `email.service.js` (invite template)

#### Step 1.2 — Family registration / accept invite

- [ ] Extend invite token flow (or new token type) for `family` role acceptance
- [ ] On accept: set password, verify email if needed, activate link, promote from `invited` → `family`
- [ ] Reuse patterns from `auth.controller.js` + `token.service.js`

#### Step 1.3 — Session payload

- [ ] Extend login / refresh response (caregiver DTO) with:
  - `linkedResidents: [{ clientId, displayName, recipientId, relationship }]`
  - `accountMode: 'b2c' | 'orgFamily'` derived from role
- [ ] `GET /v1/caregivers/me/linked-residents` for refresh without re-login

#### Step 1.4 — Block family from staff endpoints

- [ ] Audit auth middleware usage: family token must get **403** on alerts, conversations, medical analysis, org PATCH, client PATCH, digest create/send/preview
- [ ] Integration tests: family JWT cannot `GET /alerts`, `GET /conversations/...`

---

### Phase 2 — Weekly digests on mobile (B2C + org-family)

**Objective:** Both B2C and org-family users can list and read **sent** digests in the app.

#### Step 2.1 — Backend digest read for family role

- [ ] Update `familyWeeklyDigest.service.js` `queryDigests` / `getDigestById`:
  - **orgAdmin/staff:** unchanged
  - **family:** filter by `assertFamilyAccess(clientId)`; only `status === 'sent'`; verify caregiver email ∈ `digest.emailRecipients` (or re-personalize for their recipient row)
- [ ] Apply `minimumNecessary` on digest responses for family

#### Step 2.2 — Mobile API layer

- [ ] Add RTK endpoints in new or existing mobile API module (mirror web `familyWeeklyDigest` routes):
  - `listFamilyDigests({ clientId, page, limit })`
  - `getFamilyDigest({ digestId, clientId })`
- [ ] Types in `packages/mobile/app/services/api/api.types.ts`

#### Step 2.3 — Mobile UI

- [ ] Create `FamilyWeeklyDigestsScreen` (list) + `FamilyWeeklyDigestDetailScreen`
  - Port rendering from `packages/web/src/pages/FamilyWeeklyDigestClientPage.tsx` (read-only)
- [ ] Add navigation entry under **Insights** stack (and/or Home → “Weekly updates”)
- [ ] **Client picker** when `linkedResidents.length > 1` (reuse `ReportsScreen` picker pattern)
- [ ] Wire for **B2C** (`orgAdmin`) and **org-family** (`family`) — same screens, same API shape

#### Step 2.4 — i18n + tests

- [ ] Strings in `packages/mobile/app/i18n/en.ts`
- [ ] Component tests for list empty state, single vs multi resident
- [ ] Backend integration test: family user with 2 links gets digests per client only when email on recipients

---

### Phase 3 — Mobile account mode gating

**Objective:** Org-family users see a trimmed app; B2C unchanged.

#### Step 3.1 — `useAccountMode()` hook

- [ ] `packages/mobile/app/hooks/useAccountMode.ts`:
  ```typescript
  { mode: 'b2c' | 'orgFamily', showAlertsTab, showOrgAdmin, showAddClient, smsEligible }
  ```
- [ ] Derive from `currentUser.role === 'family'`

#### Step 3.2 — MainTabs

- [ ] Conditionally omit **Alert** tab when `mode === 'orgFamily'`
- [ ] Adjust `initialRouteName` if needed (Home default for both)

#### Step 3.3 — HomeScreen

- [ ] Org-family: load clients from `linkedResidents` / dedicated query, not full org client list
- [ ] Hide “Add client”, “Call now” (if staff-only), alert badges on cards
- [ ] Multi-resident: show picker or multiple cards (only linked IDs)

#### Step 3.4 — ClientScreen + stacks

- [ ] Org-family: read-only profile (hide save/delete, schedules edit, caregiver assignment)
- [ ] Hide navigation to Conversations (full transcript) until Phase 4 optional work

#### Step 3.5 — OrgScreen / Settings

- [ ] Hide org admin sections for org-family (voice onboarding, invite staff, billing)
- [ ] Keep Profile, Privacy, MFA, Logout

#### Step 3.6 — API skip rules

- [ ] Mobile: `skip: mode === 'orgFamily'` on alert queries and subscriptions
- [ ] Prevent wasted 403s in logs

---

### Phase 4 — Web admin UX (invite from resident profile)

**Objective:** Staff can invite/revoke without API calls.

- [ ] On `ResidentDetailPage.tsx` digest recipient rows:
  - Portal status badge
  - “Invite to mobile app” (enabled when org portal on + email verified)
  - “Revoke app access”
- [ ] Admin org settings page toggle: `familyPortalSettings.enabled`
- [ ] API types + mutations in `clientApi.ts` / admin if needed

---

### Phase 5 — Polish + hardening

#### Step 5.1 — Audit logging

- [ ] Log: `familyPortal.invite`, `familyPortal.revoke`, `familyPortal.login`, `familyPortal.viewDigest` with caregiverId, clientId, recipientId

#### Step 5.2 — Edge cases

- [ ] Recipient removed from client → link invalid on next request; mobile drops resident from list
- [ ] Recipient email changed → require re-verify before portal access; invalidate old link
- [ ] Same email invited on second resident → second link on same account (son sees Mom + Dad)
- [ ] Revoke one link only → other links remain

#### Step 5.3 — Migration / staging

- [ ] Document `yarn migrate:up` if any schema migration beyond Org fields
- [ ] Seed: extend `family.seeder.js` or add facility fixture with sample family links for manual QA

#### Step 5.4 — E2E (optional in v1)

- [ ] Mobile E2E: org-family login → digests visible, alerts tab absent
- [ ] Backend integration: SMS exclusion with family on caregivers array

---

## 5. File checklist (primary touch points)

| Area | Files |
|------|--------|
| Models | `org.model.js`, `caregiver.model.js`, **new** `familyResidentLink.model.js` |
| RBAC | `config/roles.js`, `middlewares/auth.js`, `middlewares/minimumNecessary.js` |
| Access | `utils/accessControl.js`, **new** `services/familyResidentLink.service.js` |
| Client API | `routes/v1/client.route.js`, `controllers/client.controller.js`, `validations/client.validation.js` |
| Digests | `services/familyWeeklyDigest.service.js`, `controllers/familyWeeklyDigest.controller.js` |
| SMS | `services/emergencyProcessor.service.js` |
| Auth | `controllers/auth.controller.js`, `services/token.service.js`, `dtos/caregiver.dto.js` |
| Mobile | `hooks/useAccountMode.ts`, `navigators/MainTabs.tsx`, `screens/HomeScreen.tsx`, **new** digest screens, `services/api/*` |
| Web | `pages/ResidentDetailPage.tsx`, org settings (web/admin) |
| Tests | `tests/integration/familyPortal*.test.js`, `minimumNecessary.test.js`, mobile screen tests |

---

## 6. Acceptance criteria (MVP = Phases 0–3 + 4)

1. Org admin enables family portal on org; invites verified digest recipient for resident A.
2. Daughter accepts invite, logs into mobile app, sees **only** resident A.
3. Son invited on A and B sees **both** in picker; daughter never sees B.
4. Both can open **sent** weekly digests in app for residents they’re linked to.
5. B2C `parent@example.org` can open digests for their loved ones in the same UI.
6. Org-family: **no Alerts tab**, alert API returns 403.
7. Org-family caregiver on client with phone: **no emergency SMS**.
8. B2C orgAdmin parent: **still receives** emergency SMS.
9. Staff revokes son’s link to B → son’s app drops B on next refresh; A unchanged.

---

## 7. Suggested PR split (for review)

1. **PR1:** Phase 0 — schema, role, SMS filter, minimumNecessary  
2. **PR2:** Phase 1 — invite, auth, linked-residents API + tests  
3. **PR3:** Phase 2 — mobile digest screens + B2C wiring  
4. **PR4:** Phase 3 + 4 — mobile gating + web invite UI  

---

## 8. Open product decisions (resolve before Phase 1.2)

1. Historical digests before `grantedAt` — show all sent where email matches, or only after invite?
2. Separate family ToS at invite accept vs reuse caregiver terms?
3. Can staff invite before digest email verified, or require verify first (recommended: **require verify**)?

---

## 9. Reference: related docs

- `docs/REGISTRATION_AND_ONBOARDING_STRATEGY.md` — B2C persona / mobile onboarding
- `packages/backend/src/utils/clientContacts.util.js` — digest recipients
- `packages/web/src/pages/FamilyWeeklyDigestClientPage.tsx` — digest UI to port
