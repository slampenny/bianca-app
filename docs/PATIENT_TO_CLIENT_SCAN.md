# Patient → Client terminology scan

Scan of both backend and frontend for remaining `patient`/`Patient` references. API responses now use `clients`; below is what still uses "patient" and where.

---

## Backend (`packages/backend`)

### Core / must-change for full consistency

| Area | Files | Notes |
|------|--------|------|
| **Routes** | `src/routes/v1/patient.route.js` | Route file name; param `:patientId`; auth scopes `updateOwn:patient`, etc.; Swagger tags "Patients"; controller/validation names. |
| **Route index** | `src/routes/v1/index.js` | `patientRoute` require; mounted at `/clients` (path already correct). |
| **Controller** | `src/controllers/patient.controller.js` | File name; all handlers (createPatient, getPatient, etc.); `req.params.patientId`. |
| **Service** | `src/services/patient.service.js` | File name; internal logic and param names. |
| **Model** | `src/models/patient.model.js` | Model name `Patient`; schema/comments say "Patient"; DB collection can stay for migration. |
| **Validation** | `src/validations/patient.validation.js` | File name; `patientId` in schemas. |
| **DTO** | `src/dtos/patient.dto.js` | File name; still used for transforming DB → API (output is "client" at API layer). |
| **Caregiver routes** | `src/routes/v1/caregiver.route.js` | Paths `/caregivers/:caregiverId/patients/:patientId` and `/caregivers/:caregiverId/patients`. |
| **Caregiver service** | `src/services/caregiver.service.js` | `getPatientById`, `addPatient`, `removePatient`, `getPatients`, `checkCaregiverOwnsPatient`; populate `path: 'patients'`; `caregiver.patients` (schema field). |
| **Caregiver model** | `src/models/caregiver.model.js` | Schema field `patients: [...]` (would need migration to rename to `clients`). |
| **Org model** | `src/models/org.model.js` | Schema field `patients` (same as above). |
| **Audit log** | `src/middlewares/auditLog.js` | `resource: 'patient'` for client routes; `req.params.patientId`; sentiment/fraud/medical routes use `:patientId`. |
| **Roles** | `src/config/roles.js` | Abilities like `readOwn:patient`, `updateAny:patient`, etc. |

### Other backend (params / URLs / logic)

- **Schedule route** `src/routes/v1/schedule.route.js`: `/patients/:patientId`, auth `patient`.
- **Sentiment route** `src/routes/v1/sentiment.route.js`: `/patient/:patientId/trend`, `/patient/:patientId/summary`.
- **Medical analysis route** `src/routes/v1/medicalAnalysis.route.js`: `/:patientId`, `/trigger-patient/:patientId`, etc.
- **Fraud/abuse route** `src/routes/v1/fraudAbuseAnalysis.route.js`: `/:patientId`, `/trigger-patient/:patientId`.
- **Conversation route** `src/routes/v1/conversation.route.js`: `/patient/:patientId`.
- **Payment route** `src/routes/v1/payment.route.js`: patient-related paths.
- **SSO controller** `src/controllers/sso.controller.js`: `path: 'patients'` (populate); comments "patients".
- **Auth controller** `src/controllers/auth.controller.js`: `PatientDTO` require; `requirePatientConsent` (org setting name).
- **Org DTO** `src/dtos/org.dto.js`: reads schema field `patients`; output key is already `clients`. `requirePatientConsent` (setting name).
- **Token config** `src/config/tokens.js`: e.g. `PATIENT_CONSENT`.
- **Agenda** `src/config/agenda.js`: job names/comments (e.g. patients without schedules).
- **Services**: conversation, sentiment, call, twilioCall, alert, email, emergency, breach, privacy, stripe, payment, dataDeletion, AI services, etc. — all use `patientId` or "patient" in logic/params.
- **Migrations**: `20251225-110207-add-patient-consent-fields.js`, `20250115-require-patient-org.js` (historical; leave as-is unless re-running).
- **Tests**: `patient.test.js`, `patient.consent.test.js`, fixtures `patient.fixture.js`, and many other test files reference Patient model and patientId.
- **Scripts**: `list-patients-staging.js`, `migrate-patient-orgs.js`, seeders `patients.seeder.js`, etc.

---

## Frontend (`packages/frontend`)

### App code (non-i18n, non-test)

| File | References |
|------|------------|
| **api.types.ts** | `CreatedModel = "Patient" \| ...`, `AlertType = "patient" \| ...`, `relatedPatient?`, `requirePatientConsent?`, `Patient = Client` (deprecated), `MessageRole = "patient" \| ...`, various `patientId` in types. |
| **authApi.ts** | `Patient` in login response type (array element type). |
| **ssoApi.ts** | `Patient` in SSOLoginResponse `clients?: Patient[]`. |
| **CaregiverScreen.tsx** | `setPatientsToReassign`; testIDs `assign-unassigned-patients-modal`, `unassigned-patients-loading`, `patients-assigned-success-message`, `select-all-patients-button`, `deselect-all-patients-button`, `no-unassigned-clients-message`; i18n keys like `assignUnassignedPatients`, `loadingUnassignedPatients`, etc. (keys still "patient"). |
| **ReportsScreen.tsx** | i18n keys only: `reportsScreen.selectPatient`, `reportsScreen.choosePatient` (values already "client"). |
| **AlertScreen.tsx** | Likely `relatedPatient`, alert types, or similar. |
| **ClientScreen.tsx** | Possible `patientId` in navigation or API. |
| **conversationSlice.ts** | `patientId` in conversation type/state. |
| **FraudAbuseAnalysisScreen.tsx** | `patientId` in API calls. |
| **MedicalAnalysisScreen.tsx** | Same. |
| **SentimentAnalysisScreen.tsx** | Same. |
| **SchedulesScreen.tsx** | `patientId` in schedule/client context. |
| **ConversationsScreen.tsx** | Conversation/patient linkage. |
| **CallScreen.tsx** | Call/patient context. |
| **scheduleApi.ts** | URL `/schedules/patients/${patientId}`; comments "patient". |
| **caregiverApi.ts** | URLs `/caregivers/${id}/patients/${patientId}`, `/caregivers/${id}/patients`. |
| **conversationApi.ts** | `patientId` in endpoints. |
| **paymentApi.ts** | `/payments/patients/${patientId}/invoices`. |
| **sentimentApi.ts** | `patientId` params. |
| **medicalAnalysisApi.ts** | `patientId`; response types e.g. `patientsAnalyzed`, `patients`. |
| **fraudAbuseAnalysisApi.ts** | `patientId` in endpoints. |
| **callWorkflowApi.ts** | `patientId` in payloads. |
| **clientApi.ts** | Minimal (e.g. 1 ref). |
| **HomeScreen.tsx** | Comments "create patients", "view patients". |
| **OrgScreen.tsx** | `requirePatientConsent`; helper text "patients". |
| **MainTabs.tsx** | Likely 1 ref (tab or comment). |
| **TermsScreen.tsx** | Legal copy "patients". |
| **PrivacyScreen.tsx** | Legal copy "patients". |
| **PaymentInfoScreen.tsx** | i18n keys `patientsWithCharges`, `patients`; `patientCosts`. |
| **CallNowButton / CallStatusBanner** | `patientId` / `patientName` props or API. |
| **Schedule.tsx** | `patientId` or similar. |
| **SentimentDashboard, SentimentLastCall, SentimentIndicator** | `patientId` in types or API. |
| **app.tsx** | Likely 1–2 refs. |
| **constants/languages.ts** | 1 ref. |
| **update-translations.js** | 2 refs. |

### i18n (key names vs displayed text)

- **en.ts**: Key names still use "patient" in many places (e.g. `patientScreen`, `createPatient`, `noPatientsFound`, `selectPatientToView`). **Displayed values** are already "Client"/"client"/"clients" where you’ve updated them.
- **Other locales** (zh, ar, pt, it, fr, de, es, ru, ja, ko): Same key names; **translated strings** still say "patient"/"Patient"/"paciente"/"患者"/etc. To show "client" in every locale, update the **values** in each file (and optionally rename keys to `clientScreen`, `createClient`, etc.).

### E2E / tests

- **Cucumber**: `fraud_abuse_steps.js` ("I select a patient from the patient picker"); `patient_steps.js` (many vars/comments "patient"; step patterns already support client|patient); `common_steps.js`, `auth_steps.js`, `alert_steps.js`, `payment_steps.js`.
- **Workflows**: `patient.workflow.ts`, `patient-detailed.workflow.ts`, `org.workflow.ts`, `simple.workflow.ts`, `caregiver.workflow.ts`, `auth.workflow.ts`, `emergency.workflow.ts`, `mfa.workflow.ts`.
- **E2E tests**: `schedule-integration.e2e.test.ts`, `multiple-schedules.e2e.test.ts`, `navigation.ts`, `testHelpers.ts`, `patient-consent-flow.e2e.test.ts`, conversations/call/alert/avatar tests, etc.
- **Unit tests**: `caregiverApi.test.ts`, `paymentApi.test.ts`, `scheduleApi.test.ts`, `sentimentApi.test.ts`, `conversationApi.test.ts`, `clientApi.test.ts`, `orgApi.test.ts`, SentimentDashboard/CallNowButton/SentimentIndicator tests, `conversation.fixture.ts`.
- **Fixtures**: `testData.ts`, `conversation.fixture.ts`.
- **World/support**: `world.js`, `emailTestHelpers.ts`, `helpers.ts`.

---

## Summary

- **Done**: Login, verify-email, SSO, and DTOs now expose **clients**; frontend auth/client/org types and Redux use **clients** for those payloads.
- **Backend**: To have "only clients" everywhere you’d still need: route param and path renames (`patientId` → `clientId`, paths like `/patients` → `/clients` where applicable), controller/service/file renames (patient → client), model/schema field renames (if you migrate DB), and audit/roles wording.
- **Frontend**: Replace remaining `patientId`/`Patient` in types and API calls with `clientId`/`Client` where they denote the same entity; align testIDs and i18n **keys** with "client" if desired; update non-en i18n **values** to the local word for "client" where the UI should say client.
- **i18n**: Key renames are optional (code uses `translate("key")`); for consistent UX in all locales, update the **translation values** in each locale file from "patient" to "client" (or equivalent).

If you want to tackle a specific layer next (e.g. backend route param + controller, or frontend API types + one screen), say which and we can do that step by step.
