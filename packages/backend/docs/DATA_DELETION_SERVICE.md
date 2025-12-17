# Data Deletion Service

**Status:** ✅ Complete  
**Date:** December 2024

## Overview

The Data Deletion Service handles automated and user-initiated data deletion based on jurisdiction-specific retention rules. It ensures compliance with both HIPAA (US) and PIPEDA (Canada) requirements.

## Key Features

### 1. Jurisdiction-Based Deletion Rules

- **HIPAA (US):** Never auto-deletes data (7-year retention requirement)
- **PIPEDA (Canada):** Auto-deletes data after retention period expires
- Uses `jurisdiction.utils.js` to determine rules per organization

### 2. Automated Deletion

- **Scheduled Job:** Runs daily at 2:00 AM via Agenda
- **Processes:** All organizations, grouped by country
- **Data Types:**
  - Call recordings (2 years for PIPEDA, 7 for HIPAA - no delete)
  - Conversations (5 years for PIPEDA, 7 for HIPAA - no delete)
  - Medical analysis (7 years for PIPEDA, 7 for HIPAA - no delete)
  - Consent records (7 years for both, only deletes withdrawn records for PIPEDA)

### 3. User-Initiated Deletion

- **Endpoint:** `POST /v1/privacy/deletion`
- **Frontend:** Available in PrivacyRequestScreen
- **Validation:** Checks jurisdiction - blocks deletion for HIPAA users
- **Confirmation:** Requires user confirmation via modal

## Retention Rules

### HIPAA (US)
- **Patient data:** 7 years, **NO auto-delete** (legal requirement)
- **Call recordings:** 7 years, **NO auto-delete**
- **Conversations:** 7 years, **NO auto-delete**
- **Medical analysis:** 7 years, **NO auto-delete**
- **Consent records:** 7 years, **NO auto-delete**

### PIPEDA (Canada)
- **Patient data:** 7 years, **auto-delete after period**
- **Call recordings:** 2 years, **auto-delete after period**
- **Conversations:** 5 years, **auto-delete after period**
- **Medical analysis:** 7 years, **auto-delete after period**
- **Consent records:** 7 years, **auto-delete after period** (only withdrawn records)

## Implementation Details

### Service Location
- `packages/backend/src/services/dataDeletion.service.js`

### Scheduled Job
- **Location:** `packages/backend/src/config/agenda.js`
- **Schedule:** Daily at 2:00 AM (`0 2 * * *`)
- **Job Name:** `processDataDeletion`

### API Endpoint
- **Route:** `POST /v1/privacy/deletion`
- **Controller:** `privacy.controller.js` → `requestDataDeletion`
- **Auth:** Requires authentication

### Frontend Integration
- **Screen:** `PrivacyRequestScreen.tsx`
- **API:** `privacyApi.ts` → `useRequestDataDeletionMutation`
- **UI:** Deletion section with confirmation modal

## Safety Features

1. **Jurisdiction Check:** Only deletes for PIPEDA jurisdictions
2. **Billing Protection:** Won't delete calls with active billing references (`lineItemId`)
3. **Cascading Deletes:** Properly handles related data (messages, conversations)
4. **Error Handling:** Logs errors but continues processing other orgs
5. **User Confirmation:** Requires explicit confirmation for user-initiated deletions

## Usage

### Automated Deletion
Runs automatically via Agenda scheduler. No manual intervention needed.

### User-Initiated Deletion
1. User navigates to Privacy Request Screen
2. Scrolls to "Request Data Deletion" section
3. Selects data type to delete
4. Clicks "Request Data Deletion"
5. Confirms in modal
6. Data is deleted (if jurisdiction allows)

## Logging

All deletion operations are logged with:
- Organization country and jurisdiction
- Number of items deleted per data type
- Errors (if any)
- Skipped deletions (with reason)

## Testing

To test the service manually:
```javascript
const dataDeletionService = require('./services/dataDeletion.service');

// Test for specific country
await dataDeletionService.processDataDeletionForOrg('CA');

// Test user-initiated deletion
await dataDeletionService.handleDeletionRequest(userId, 'all');
```

## Notes

- Deletion is **permanent** - no recovery possible
- HIPAA users will receive an error if they try to delete (legal requirement)
- Only withdrawn consent records are deleted (active records kept)
- Calls with billing references are protected from deletion
