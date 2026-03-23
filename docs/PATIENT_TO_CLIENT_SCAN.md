# Patient → Client terminology scan

**Last updated:** 2026-03-09 (repo scan)

This document lists remaining `patient` / `Patient` references after the client migration. Many are **intentional** (migrations, clinical NLP copy, legacy API fields) vs **candidates for rename** (user-facing copy, test names, comments).

---

## Snapshot: what’s basically clean

| Area | Status |
|------|--------|
| **Core backend routes/controllers for clients** | `client.route.js`, `client.controller.js`, `client.service.js`, `client.model.js` — **present**; old `patient.route.js` / `patient.controller.js` **removed** from `src/`. |
| **Frontend `app/` (`*.ts` / `*.tsx`)** | **No** `patient` / `Patient` in production UI code paths except **legacy schedule field** (see below) and **unit test files** under `app/services/api/__tests__/`. |
| **`app/i18n/en.ts`** | **No** substring `patient` (keys/values migrated for English). |
| **`app/services/api/api.types.ts`** | **No** `patient` / `Patient` matches in current scan. |

---

## Filenames still containing `patient` (rename only if you want consistency)

| Path | Notes |
|------|--------|
| `docs/PATIENT_TO_CLIENT_SCAN.md` | This file. |
| `packages/backend/migrations/*patient*` | Historical migration IDs — **do not rename** applied migrations. |
| `packages/backend/scripts/migrate-patient-orgs.js`, `list-patients-staging.js` | Ops scripts; rename for clarity only. |
| `packages/backend/docs/MIGRATION_PATIENT_TO_CLIENT_ID.md`, `README-PATIENT-ORG-MIGRATION.md` | Docs tied to migration names. |
| `packages/backend/tests/unit/config/agenda.checkPatientsWithoutSchedules.test.js` | Test name; job may still say “patients” in code. |
| `packages/frontend/test/e2e/cucumber/features/patient-management.feature` | Gherkin / legacy name. |
| `packages/frontend/test/e2e/cucumber/features/patient-complete-management.feature` | Same. |
| `packages/frontend/test/e2e/cucumber/step_definitions/patient_steps.js` | Step defs; may still match “patient” in scenarios. |

---

## Frontend — remaining references ( actionable )

### Production app

- **`packages/frontend/app/screens/SchedulesScreen.tsx`**  
  Destructures legacy `patient` on schedule objects when saving:  
  `const { id, patient: _omitLegacyPatientField, ...scheduleData } = ...`  
  **Action:** keep until API never returns `patient`; or map to `client` only.

### Tests / E2E

- **`app/services/api/__tests__/caregiverApi.test.ts`** — `describe("caregiverApi - patients", ...)`, commented examples say “patient” / `patientId`.  
  **Action:** rename to “clients” / `clientId` for consistency.
- **`app/services/api/__tests__/orgApi.test.ts`** — commented `patients: []`.
- **`test/e2e/helpers/emailTestHelpers.ts`** — mock caregiver uses `patients: []`. Prefer **`clients: []`** if the app reads `clients` only (or support both during transition).
- **`test/e2e/alert-checkbox.e2e.test.ts`**, **`alert-polling.e2e.test.ts`** — `caregiver?.clients ?? caregiver?.patients` (defensive; OK).
- **`test/e2e/client-consent-flow.e2e.test.ts`** — regexes `require.*patient.*consent` for **legacy UI** text (keep until UI is fully updated).
- **`test/e2e/helpers/navigation.ts`**, **`schedule-integration.e2e.test.ts`** — `CREATE PATIENT` / `UPDATE PATIENT` in regexes for **legacy buttons** (keep for backward compatibility).

### Docs

- **`packages/frontend/test/e2e/NON-WORKFLOW-TESTS.md`** — may mention old filenames like `schedule-patient-workflow.e2e.test.ts`; current schedule E2E is `schedule-integration.e2e.test.ts`.

### Tooling

- **`packages/frontend/update-translations.js`** — `commonTranslations.patient` maps the **word** “patient” to other languages (medical glossary). Review if product language should be “client” everywhere.

---

## Backend — high-density areas (not exhaustive)

Counts are **matches per file** (`patient`, case-insensitive) under `packages/backend/src`:

| Category | Examples | Notes |
|----------|----------|--------|
| **AI / NLP analysis** | `medicalPatternAnalyzer`, `fraudAbuseAnalyzer`, `speechPatternAnalyzer`, `relationshipPatternAnalyzer`, `repetitionMemoryAnalyzer`, `psychiatricPatternDetector`, `cognitiveDeclineDetector`, etc. | Often **clinical** copy (“patient utterance”, “patient messages”) and variable names like `patientMessages`. |
| **Prompts / templates** | `templates/prompts.refined.js` | Model instructions may say “patient”. |
| **Alerts / deduplication** | `alertDeduplicator.js`, `alertTranslations.js` | Legacy alert types or text. |
| **Roles / auth** | `config/roles.js` | May still use `readOwn:patient`-style ability names until a roles migration. |
| **Caregiver / org services** | `caregiver.service.js`, `org.service.js`, `dtos/org.dto.js` | May reference schema/populate field names or legacy naming. |
| **Data deletion / privacy** | `dataDeletion.service.js` | Many references when scrubbing “patient” data. |
| **Test route / demo** | `routes/v1/test.route.js`, `demo.route.js` | Swagger comments, sample emails `sample.patient*@`, migration filenames in arrays. |
| **Sentiment / Twilio** | `sentiment.route.js` (Swagger “patient ID”), `twilioCall.route.js` | Docs; `testPatientId` query alias. |
| **Seed / old scripts** | `seedDatabase.old.js`, `seedDatabaseDemo.js`, `seeders/sentimentAnalysis.seeder.js` | Demo text “Patient expressed…”. |
| **Scripts** | `list-patients-staging.js` | Operational naming. |

---

## Backend tests & fixtures

- **`tests/integration/sentiment.test.js`** — local variable `patient` holding a `Client` document; test titles “for patient”; mock summaries “Patient shows…”.  
  **Action:** rename to `client` / “for client” for readability.
- **`tests/fixtures/medicalConversations.fixture.js`** and similar — may still say “patient” in synthetic clinical text.
- **Integration setup** — mock sentiment strings may include the word “Patient”.

---

## Intentional — do not change casually

- **Mongo migrations** whose **filename** contains `patient` (already applied in prod/staging).
- **Message / token enums** that historically used `patient` (migrations exist to move to `client`).
- **Third-party or legal** copy where “patient” is the correct HIPAA term (verify with counsel).
- **Regex fallbacks** in E2E that match old UI strings until releases roll out everywhere.

---

## Suggested priority

1. **Swagger / OpenAPI comments** — “patient ID” → “client ID” where routes are already `/client/...`.
2. **Operational scripts** — rename `list-patients-staging.js` → `list-clients-staging.js` (update CI/docs).
3. **Cucumber** — rename `patient-management.feature` → `client-management.feature` and align `patient_steps.js` when stable.
4. **AI services** — rename internal variables `patientMessages` → `clientMessages` only if it doesn’t confuse clinical reviewers; otherwise add a short comment that “patient” here means **care recipient** in NLP.
5. **Roles** — plan a dedicated migration for CASL strings `*:patient` → `*:client` with DB/ JWT compatibility.

---

## Historical section (superseded)

Earlier versions of this file listed `patient.route.js`, `patient.controller.js`, etc. Those **core files are replaced by `client.*`** in `packages/backend/src`. Remaining “patient” usage is mostly **strings**, **legacy fields**, **migrations**, or **clinical NLP**, not duplicate route trees.
