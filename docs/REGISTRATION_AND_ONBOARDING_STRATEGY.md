# Registration & Onboarding Strategy

**Status:** Strategy (pre-implementation)  
**Last updated:** 2025-03-04

---

## 1. Goals

- Improve the **registration** and **SSO first-time** experience with a friendly, persona-driven onboarding.
- After sign-up or first-time SSO, ask **“Who are you?”** (organization, caregiver, or aging in place), then show a **tailored “How Bianca works”** explanation.
- For **organizations** and **caregivers** (not individuals), collect **settings** during onboarding (including **single-consent state**).
- For **single users** (aging in place), make the **default home experience** the **reporting screen** instead of the patient list.

---

## 2. Current State Summary

| Area | Current behavior |
|------|------------------|
| **Registration** | `RegisterScreen`: account type toggle (individual vs organization). Individual uses name as org name; organization asks for org name. After success → email verification → `EmailVerifiedScreen` → `MainTabs` (no persona or “how it works” step). |
| **SSO first-time** | Backend creates org + caregiver (or attaches to existing org). Frontend receives tokens and user/org; navigates to `MainTabs`. No onboarding step. |
| **Post-login** | `AppNavigator` redirects to `MainTabs`; users with incomplete profile (e.g. missing phone) are sent to Profile. No “onboarding complete” or persona. |
| **Home** | `HomeScreen` = patient list (cards, “Add patient”, “Call now”). Same for all users. |
| **Reports** | `ReportsScreen` (Reports tab) = patient selector + links to Sentiment, Medical, Fraud/Abuse reports. |
| **Org settings** | `Org` has `requirePatientConsent` (double-party consent). No explicit “single-consent state” field; consent model is implied by jurisdiction. |

---

## 3. Personas (Who Are You?)

Onboarding will ask the user to choose one of:

| Persona | Description | Post-onboarding behavior |
|----------|-------------|---------------------------|
| **Organization** | Healthcare org / practice managing multiple clients. | Tailored “How Bianca works” → **Org information** page (name, country, timezone) → **Registration** page (your details + terms + single-consent). Default home = **patient list** (current Home tab). |
| **Caregiver** | Family or professional caregiver (may have one or a few people they care for). | Tailored “How Bianca works” → **Registration** page (your details + terms + single-consent). Default home = **patient list** (current Home tab). |
| **Aging in place** | Single user using Bianca for themselves. | Tailored “How Bianca works” → **Registration** page (your details + terms only; no single-consent). Default home = **Reports** (see §6). |

These map to existing concepts where useful (e.g. org vs individual registration), but the **choice happens after** auth (registration or SSO), not on the registration form, so SSO users get the same flow.

---

## 4. Post–Registration / Post–SSO Flow

### 4.1 When to show onboarding

- **Registration (email/password):** After successful registration and any required email verification, **before** entering `MainTabs`, show onboarding if the user has not completed it (see §7).
- **SSO first-time:** After backend creates/links org and caregiver and returns tokens, **before** entering `MainTabs`, show onboarding if not completed.
- **Returning users:** If `onboardingComplete` (or equivalent) is true, skip onboarding and go straight to `MainTabs` (with persona-based default tab/screen per §6).

### 4.2 Onboarding sequence (single flow for both registration and SSO)

1. **“About you” (fade-in)**  
   - Friendly, minimal screen: “Tell us a bit about you.”  
   - Three options: **Organization** | **Caregiver** | **Aging in place**.  
   - Single selection; primary CTA: “Continue”.

2. **“How Bianca works” (tailored)**  
   - One short, persona-specific explanation (copy + optional illustration).  
   - **Organization:** e.g. add clients, schedules, Bianca calls them, you see conversations and reports. CTA: “Next” → Org information.  
   - **Caregiver / Aging in place:** CTA “Next” or “Get started” → Registration.

3. **Org information (Organization only)**  
   - Shown only when persona = **Organization**. Single page: organization name, country, timezone.  
   - CTA: “Continue” → Registration.

4. **Registration (all personas)**  
   - Single registration-style page **without** the org/individual account-type tab.  
   - **Your details:** name, email, phone, country (pre-filled when available).  
   - **Terms/Privacy:** “I have read and accept the [Terms of Service] and [Privacy Policy]” with links; required checkbox.  
   - **Single-consent (Organization and Caregiver only):** “Are you in a single-consent state?” Yes/No, “Why is this important?” link; single-consent (Yes) checked by default when possible. See §5.  
   - CTA: “Save and continue”; enabled when terms are accepted (and details valid).

5. **Completion**  
   - On “Save and continue” from Registration: set `onboardingComplete`, persist persona, terms acceptance, and (for org/caregiver) single-consent.  
   - Navigate to `MainTabs` with persona-based default tab/screen (§6).

### 4.3 UX details

- **Fade-in:** First onboarding screen (“About you”) uses a gentle fade-in.  
- **Copy:** Warm, concise; avoid jargon.  
- **Accessibility:** Labels, focus order, and screen reader text for all options and CTAs.  
- **Skip for existing users:** If the user already has `onboardingComplete`, do not show onboarding again (no “re-onboard” unless we add an explicit “Redo onboarding” in settings later).

---

## 5. Terms and consent: single-consent next to Terms (Organization and Caregiver)

- **Who sees it:** **Organization** and **Caregiver** personas. **Not** shown for **Aging in place** (individuals).
- **Placement:** The single-consent question appears **on the same screen as** the Terms and Conditions (and Privacy Policy) that must be accepted — i.e. next to or immediately below the terms acceptance. One combined “legal and consent” step so both live together.
- **Meaning:** In some jurisdictions only one party (e.g. the organization or caregiver) needs to consent to recording; in others, both parties (e.g. org/client or caregiver/care recipient) must consent.  
- **Backend:**  
  - **Option A:** Add `singleConsentState: Boolean` on `Org`. If `true`, treat as single-consent (do not require client consent for recording). If `false`, respect existing `requirePatientConsent` (or set it to true for two-party states).  
  - **Option B:** Use only `requirePatientConsent`: single-consent state ⇒ `requirePatientConsent: false`; two-party ⇒ `requirePatientConsent: true`.  
- **Recommendation:** Option B minimizes schema change; ensure wording in UI (“single-consent state” vs “we need client consent for recording”) is clear so org admins set it correctly.  
- **Where used:** Any call/recording consent logic (e.g. consent banners, recording flags) should consider this setting so behavior matches jurisdiction.

**UX for the single-consent question**

- Shown in the **same block or section** as “I accept the Terms of Service and Privacy Policy” (links + required acceptance). **Check single-consent (Yes) by default when possible** — e.g. when location suggests one-party consent, or as the default when we have no suggestion (many jurisdictions are one-party); user can change to No. See §5.1 for location-based suggestion.
- **“Why is this important?”** — Provide a button or link next to the question that expands or opens a short explanation: why we ask (call recording laws vary by state/country; single- vs two-party consent affects whether we require client/care recipient consent before recording; getting this right keeps you and your organization compliant). Wording should work for both Organization and Caregiver. Keep the main question and Yes/No visible; the explanation is optional to read.

### 5.1 Detecting user location and suggesting single-consent state

**Yes — we can detect approximate location and suggest single- vs two-party consent**, but the result should always be a **suggestion** that the user confirms, not the sole source of truth for compliance.

**How to detect location**

| Method | Pros | Cons |
|--------|------|------|
| **IP geolocation** | No user action; works on first load. Services (e.g. ipapi.co, ip-api.com, Vercel Geo) return country and often state/region. | Approximate only; VPNs, corporate networks, and mobile carriers can return wrong country/state. |
| **Browser geolocation (GPS)** | More accurate. | Requires permission; often not granted on first visit; poor UX to ask during onboarding. |
| **Already-collected data** | We already have **country** from registration/org (CountryPicker). | No state/province yet; user’s org may operate in a different state than where they signed up. |

**Recommendation:** Use **IP geolocation** (backend or client) to get country + region/state when available. Backend can call a geolocation API using the request’s IP (or the frontend can call a CORS-enabled API and send the result to the backend). Prefer server-side so the IP is consistent and we don’t depend on client-side availability.

**Mapping jurisdiction → single- vs two-party consent**

- **US:** Maintain a static mapping of state → consent rule.  
  - **Two-party (all-party) consent states** (stricter): California, Connecticut, Delaware, Florida, Illinois, Maryland, Massachusetts, Montana, Nevada, New Hampshire, Pennsylvania, Washington, Oregon (and others — list should be validated by legal).  
  - **One-party consent:** All other US states and D.C.  
  - For interstate calls, the stricter rule typically applies; we only suggest based on org’s primary state.  
- **Canada / other countries:** Different regimes (e.g. PIPEDA, provincial rules). Map country (and province if we have it) to a default; legal review recommended.

**UX (in addition to §5 “checked by default when possible” and “Why is this important?”)**

- On the terms-and-consent step (Organization and Caregiver), **check single-consent (Yes) by default when possible** — e.g. when location suggests one-party consent, or as the default when we have no suggestion.  
- If we have a suggested jurisdiction (from IP geo or from org country/address), use it to set the default: **pre-select Yes** when the jurisdiction is one-party consent, **pre-select No** when two-party; show brief helper text (e.g. “Based on your location, one-party consent applies in [State].”). User can change the selection.  
- If we have no location or only country (and no state mapping): show the question without a suggestion (“Please confirm whether your organization operates in a single-consent state.”).  
- **Copy:** e.g. “This is only a suggestion. You are responsible for complying with the laws that apply to your organization.”

**Caveats**

- **Never rely on detection alone for legal compliance.** VPNs, remote workers, and multi-state orgs make IP/geo wrong or incomplete. The final answer must be the **user’s confirmed choice** (and ideally stored with a “user confirmed” flag).  
- **Legal review:** Have the US state list (and any non-US mapping) reviewed before shipping.  
- **Privacy:** If we log IP for geolocation, mention it in the privacy policy and use it only for this suggestion.

---

## 6. Single-user (aging in place) default “home”

- **Goal:** For persona **Aging in place**, the main landing experience should be **reporting** (their own wellness/reports), not the patient list.  
- **Options:**  
  - **A. Default tab = Reports**  
    - For this persona, `MainTabs` opens with **Reports** as the selected tab (e.g. `initialRouteName="Reports"` when persona is “aging in place”).  
    - Home tab still exists; they can switch to it (e.g. to see “self” as the single “patient” or to add themselves if that’s the model).  
  - **B. Home tab content swap**  
    - For this persona, the “Home” tab shows Reports-style content (e.g. same as current ReportsScreen) instead of the patient list.  
- **Recommendation:** **Option A** (default tab = Reports) for v1: small change (persona + `initialRouteName`), clear behavior, no new component. Option B can be considered later if we want “Home” to always mean “main dashboard” and differ by persona.  
- **Implementation:** Store persona (e.g. `userPersona` or on caregiver/org); in `MainTabs`, set `initialRouteName` from persona (e.g. `persona === 'agingInPlace' ? 'Reports' : 'Home'`). Ensure deep links and “Home” tab still work.

---

## 7. Data model and API

### 7.1 Onboarding and persona

- **Caregiver (or User) level**  
  - `onboardingComplete: Boolean` (default `false`). Set `true` when user finishes the onboarding sequence.  
  - `persona: 'organization' | 'caregiver' | 'agingInPlace'` (optional; can be derived from org/role/patient count, but explicit is clearer for UX and reporting).  
- **Persistence:** Backend persists these (e.g. on `Caregiver`). Auth/me response (or login/register/SSO response) includes them so the app can decide: show onboarding vs go to MainTabs, and which default tab to open.

### 7.2 Org settings (single-consent)

- Use existing `requirePatientConsent` (see §5) or add `singleConsentState` on `Org`.  
- PATCH endpoint for org settings (or include in onboarding payload) so the terms-and-consent step (Organization and Caregiver) can save single-consent (and optionally other org fields for orgs) in one shot. Terms acceptance is recorded as part of the same step.

### 7.3 When backend creates the user (SSO / register)

- **SSO:** Backend already creates org + caregiver. Do not set `onboardingComplete: true` for new users; leave it false so the app shows onboarding.  
- **Register:** Same: new caregivers have `onboardingComplete: false` until they finish the new flow.  
- **Existing users:** Backfill `onboardingComplete: true` and optionally `persona` (e.g. from role: orgAdmin → organization, staff → caregiver; single-patient self-use → agingInPlace) so they are not forced through onboarding.

---

## 8. Implementation phases

### Phase 1 – Backend (data + API)

- Add `onboardingComplete` (and optionally `persona`) to Caregiver model; backfill existing users.
- Add/use org field for single-consent (e.g. `requirePatientConsent` or `singleConsentState`) and expose in org GET/PATCH.
- Auth/me (and login/register/SSO responses) return onboarding and persona so the app can branch.

### Phase 2 – Frontend: onboarding flow

- New screens (or modals): “About you” (persona picker), “How Bianca works” (persona-specific copy), and “Terms and consent” (Organization and Caregiver only: Terms/Privacy acceptance + single-consent question with “Why is this important?”, single-consent checked by default when possible; not shown for Aging in place).
- After successful registration or first-time SSO, if `!onboardingComplete`, show onboarding sequence instead of navigating to MainTabs; on completion call API to set `onboardingComplete` (and save persona + org settings), then navigate to MainTabs.

### Phase 3 – Default home for single user

- In `MainTabs`, set `initialRouteName` based on persona (e.g. Reports for aging in place, Home otherwise).
- Ensure first-time single users land on Reports after onboarding.

### Phase 4 – Copy and polish

- Finalize copy for all three personas and for single-consent question.
- Fade-in and any animations; accessibility pass; i18n keys.

---

## 9. Edge cases and open questions

- **Invite flow:** Users who sign up via invite (e.g. `SignupScreen` with token) may already be “organization” or “caregiver” by context. Option: still show “About you” with a sensible default (e.g. Caregiver) or skip persona and set it from invite context; then show “How Bianca works” and the terms-and-consent step (Terms/Privacy + single-consent) for both org and caregiver; skip only any org-admin–only fields if they’re staff.  
- **Existing users without persona:** Backfill strategy (e.g. orgAdmin → organization, staff → caregiver; one patient and self-use pattern → agingInPlace) to avoid showing onboarding to everyone on first deploy.  
- **Changing persona later:** Out of scope for v1; can add “Account type” in Profile later if needed.  
- **Single-consent wording:** Legal/review of “single-consent state” and mapping to `requirePatientConsent` before shipping.  
- **Reports for single user:** If the aging-in-place user has no “patient” yet, ReportsScreen may need a fallback (e.g. “You’re the only client” / auto-select self) so the tab isn’t empty; confirm product preference.

---

## 10. Success criteria

- New registrations and first-time SSO users see “About you” → “How Bianca works” → (if Organization or Caregiver) “Terms and consent” (Terms/Privacy acceptance + single-consent, next to each other) before the main app; Aging in place skip this step.  
- Organization and Caregiver onboarding includes terms acceptance and single-consent on the same screen (with “Why is this important?”; single-consent checked by default when possible); single-consent is persisted and used in consent logic.  
- Aging-in-place users open the app to the Reports tab by default.  
- Existing users are not forced through onboarding (backfill + `onboardingComplete`).  
- Flow works on web and mobile, with clear copy and accessible controls.
