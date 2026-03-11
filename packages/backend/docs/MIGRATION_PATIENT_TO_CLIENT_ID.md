# Migration: patient_id → client_id (and Message.role patient → client)

## Overview

The app uses **client_id** (and `clientId` in code) everywhere. Production databases that were created or written when the app used **patient_id** need a one-time migration so existing data is preserved. Message documents that used **role: 'patient'** for the caller are also migrated to **role: 'client'**.

## What the migrations do

### 1. Field renames: `migrations/20260307-patient-id-to-client-id.js`

- **calls**: `patientId` → `clientId`
- **conversations**: `patientId` → `clientId`
- **schedules**: `patient` / `patientId` → `client`
- **alerts**: `relatedPatient` → `relatedClient`
- **tokens**: `patient` → `client`
- **caregivers**: `patients` → `clients` (only when `clients` is missing or empty)
- **medicalanalyses**: `patientId` → `clientId`
- **medicalbaselines**: `patientId` → `clientId`
- **fraudabuseanalyses**: `patientId` → `clientId`
- **lineitems**: `patientId` → `clientId`
- **reports**: `patientId` → `clientId` (if present)

### 2. Message role: `migrations/20260310-message-role-patient-to-client.js`

- **messages**: `role: 'patient'` → `role: 'client'` (caller/customer messages only)

### 3. Enum fields: `migrations/20260310-patient-to-client-enums.js`

- **privacyrequests**: `requestorType: 'patient'` → `'client'`, `requestorModel: 'Patient'` → `'Client'`
- **consentrecords**: `userType: 'patient'` → `'client'`, `userModel: 'Patient'` → `'Client'`
- **breachlogs**: `affectedResourceType: 'patient'` → `'client'`
- **privacycomplaints**: `complainantType: 'patient'` → `'client'`, `complainantModel: 'Patient'` → `'Client'`

### 4. Copy patients collection into clients: `migrations/20260310-copy-patients-to-clients.js`

- Copies every document from the **patients** collection into the **clients** collection, preserving `_id`.
- Ensures existing `clientId` references (in calls, conversations, schedules, etc.) resolve to a document, since the app uses the Client model and the `clients` collection.
- Idempotent: only inserts documents whose `_id` is not already in `clients`. Safe to run multiple times.

Each migration only updates documents that still have the legacy value (or, for the copy, only inserts missing docs), so they are safe to run multiple times.

All migrations only update documents that still have the legacy field/value, so they are safe to run multiple times. The migrations do not use a MongoDB transaction so they work on standalone instances (e.g. local dev); production replica sets could add a transaction if desired.

## How to run

1. **Back up the database** (e.g. mongodump or your provider’s snapshot).
2. Set `MONGODB_URL` for the target environment (e.g. production).
3. From the backend package:

   ```bash
   cd packages/backend
   yarn migrate:up
   ```

4. Check logs for how many documents were updated per collection.

## Rollback

The migration does not automatically roll back. To undo, restore from the backup taken before running the migration. The `down` handler is intentionally a no-op to avoid overwriting data.

## After the migration

- Application code should use only `clientId` / `client` / `relatedClient` / `clients`.
- Message documents should use only `role: 'client'` for the caller (not `'patient'`). The Message schema enum no longer includes `'patient'`.
- New data will be written with the new field names and role; the migrations are for existing documents that still had the old names/values.

## Migration audit (patient → client coverage)

Checked so that no legacy patient data or references are left behind:

| Collection / area | Migrated by | Notes |
|-------------------|-------------|--------|
| **patients → clients** | `20260310-copy-patients-to-clients.js` | Copies all docs from `patients` into `clients` (same `_id`). Critical so `clientId` refs resolve. |
| **calls** | 20260307 | `patientId` → `clientId` |
| **conversations** | 20260307 | `patientId` → `clientId` |
| **messages** (sub-docs / collection) | 20260310-message-role | `role: 'patient'` → `'client'` |
| **schedules** | 20260307 | `patient` / `patientId` → `client` |
| **alerts** | 20260307 | `relatedPatient` → `relatedClient` |
| **tokens** | 20260307 | `patient` → `client` |
| **caregivers** | 20260307 | `patients` array → `clients` |
| **medicalanalyses** | 20260307 | `patientId` → `clientId` |
| **medicalbaselines** | 20260307 | `patientId` → `clientId` |
| **fraudabuseanalyses** | 20260307 | `patientId` → `clientId` |
| **lineitems** | 20260307 | `patientId` → `clientId` |
| **reports** | 20260307 | `patientId` → `clientId` (if present) |
| **privacyrequests** | 20260310-patient-to-client-enums | `requestorType` / `requestorModel` |
| **consentrecords** | 20260310-patient-to-client-enums | `userType` / `userModel` |
| **breachlogs** | 20260310-patient-to-client-enums | `affectedResourceType` |
| **privacycomplaints** | 20260310-patient-to-client-enums | `complainantType` / `complainantModel` |
| **orgs** | — | Schema has only `clients` (no `patients` array); no migration needed. |
| **invoices** | — | No patient refs; lineitems migrated in 20260307. |

**Other fixes:**

- **20250124-require-caregiver-org.js**: Strategy 2 now uses `Client` (from `src/models`) instead of `Patient`, so the migration does not throw when inferring org from “caregiver’s clients”.
- **20251225-add-patient-consent-fields.js**: Uses the native driver and both `patients` and `clients` collections (no `Patient` model dependency).
