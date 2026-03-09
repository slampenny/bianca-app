# Migration: patient_id → client_id

## Overview

The app uses **client_id** (and `clientId` in code) everywhere. Production databases that were created or written when the app used **patient_id** need a one-time migration so existing data is preserved.

## What the migration does

The migration script `migrations/20260307-patient-id-to-client-id.js`:

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

It only updates documents that still have the legacy field, so it is safe to run multiple times. The migration does not use a MongoDB transaction so it works on standalone instances (e.g. local dev); production replica sets could add a transaction in the migration if desired.

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
- New data will be written with the new field names; the migration is for existing documents that still had the old names.
