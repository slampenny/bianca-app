# Phone Number Migration to E.164 Format

## Overview

This migration script normalizes all phone numbers in the database to E.164 format (`+1XXXXXXXXXX`). This ensures consistency across the application and compatibility with AWS SNS for SMS verification.

## What It Does

The script:
1. Finds all **Caregivers**, **Patients**, and **Orgs** with phone numbers
2. Normalizes them to E.164 format:
   - `6045624263` → `+16045624263`
   - `16045624263` → `+16045624263`
   - `+16045624263` → `+16045624263` (already correct, skipped)
3. Updates the database with normalized phone numbers
4. Provides a detailed summary of changes

## When to Run

Run this migration:
- **After deploying** the phone number normalization changes to staging/production
- **Before testing** phone verification features
- **If you see** phone number format errors in logs

## How to Run

### Local Development

```bash
# Make sure you're connected to the correct database
NODE_ENV=development yarn migrate:phone-numbers
```

### Staging

```bash
# SSH into staging instance or run via SSM
NODE_ENV=staging node src/scripts/migrate-phone-numbers-to-e164.js
```

### Production

```bash
# SSH into production instance or run via SSM
NODE_ENV=production node src/scripts/migrate-phone-numbers-to-e164.js
```

## Output Example

```
🔌 Connecting to database...
✅ Connected to database

🚀 Starting phone number migration to E.164 format...

📱 Migrating Caregiver phone numbers...
   Found 15 Caregiver documents with phone numbers
   ✅ Updated Caregiver 507f1f77bcf86cd799439011: "6045624263" → "+16045624263"
   ✅ Updated Caregiver 507f1f77bcf86cd799439012: "16045624263" → "+16045624263"
   📊 Caregiver Summary: 12 updated, 3 skipped, 0 errors

📱 Migrating Patient phone numbers...
   Found 8 Patient documents with phone numbers
   ✅ Updated Patient 507f1f77bcf86cd799439020: "5551234567" → "+15551234567"
   📊 Patient Summary: 5 updated, 3 skipped, 0 errors

📱 Migrating Org phone numbers...
   Found 2 Org documents with phone numbers
   📊 Org Summary: 0 updated, 2 skipped, 0 errors

📊 Migration Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Caregivers: 12 updated, 3 skipped, 0 errors
Patients:   5 updated, 3 skipped, 0 errors
Orgs:       0 updated, 2 skipped, 0 errors
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Migration completed successfully! 17 phone number(s) normalized to E.164 format.

🔌 Disconnected from database
```

## Safety

- **Read-only check**: The script shows what will be updated before making changes
- **Idempotent**: Safe to run multiple times (skips already-normalized numbers)
- **Error handling**: Continues processing even if individual updates fail
- **Validation**: Only updates valid phone numbers (skips invalid formats)

## Invalid Phone Numbers

If a phone number cannot be normalized (e.g., too short, too long, invalid format), the script will:
- Skip that document
- Log a warning message
- Continue processing other documents
- Report the count in the summary

You should manually review and fix invalid phone numbers after the migration.

## Rollback

If you need to rollback:
1. Restore from a database backup taken before the migration
2. Or manually update phone numbers back to their original format (not recommended)

## Notes

- The script uses the same normalization logic as `caregiver.service.js`
- Phone numbers are validated using the same rules as the application
- The migration is safe to run on production (uses MongoDB transactions where possible)

