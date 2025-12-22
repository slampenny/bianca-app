# Patient Org Migration

## Overview

This migration assigns organizations to patients that don't have one. This is required before making the `org` field required in the Patient model.

**Note:** This migration has been converted to use `migrate-mongo`. See the migration file in `migrations/20250115-require-patient-org.js`.

The old script-based migration (`scripts/migrate-patient-orgs.js`) is kept for reference but should not be used.

## What It Does

The script:
1. Finds all patients without an org assigned (`org` is `null` or doesn't exist)
2. Attempts to assign org from their caregivers (if they have any)
3. Falls back to checking schedules if caregivers don't have orgs
4. Reports patients that cannot be assigned (no caregivers or caregivers without orgs)

## When to Run

**IMPORTANT:** Run this migration **BEFORE** deploying the code that makes `org` required in the Patient model.

Run this migration:
- **Before deploying** the Patient model changes that make `org` required
- **If you see** patients without orgs in your database
- **After** any data imports that might create patients without orgs

## How to Run

### Using migrate-mongo (Recommended)

```bash
# Check migration status
yarn migrate:status

# Run the migration
yarn migrate:up

# For specific environments, set MONGODB_URL
MONGODB_URL=<your-url> yarn migrate:up
```

### Using the Old Script (Deprecated)

The old script is still available but deprecated:

```bash
# Local Development
NODE_ENV=development yarn migrate:patient-orgs

# Staging
NODE_ENV=staging yarn migrate:patient-orgs

# Production
NODE_ENV=production yarn migrate:patient-orgs
```

## Output Example

```
Connecting to database...
Connected to database
Found 5 patient(s) without an org assigned

✅ Updated patient 507f1f77bcf86cd799439011 (John Doe) with org Acme Healthcare
✅ Updated patient 507f1f77bcf86cd799439012 (Jane Smith) with org Acme Healthcare
⚠️  Patient 507f1f77bcf86cd799439013 (Bob Johnson) has no org and no caregivers with orgs - needs manual assignment

📊 Migration Summary:
   ✅ Updated: 2 patient(s)
   ⚠️  Skipped (needs manual review): 3 patient(s)
   ❌ Errors: 0 patient(s)

⚠️  Patients requiring manual org assignment:
   - Bob Johnson (507f1f77bcf86cd799439013): No caregivers with orgs found
     Email: bob@example.com
     Caregivers: 0

✅ All patients now have orgs assigned
Database connection closed
```

## Handling Patients That Can't Be Auto-Assigned

If the script reports patients that need manual assignment:

1. **Check if they have caregivers**: If a patient has caregivers, verify those caregivers have orgs assigned
2. **Assign manually**: Use the admin interface or API to assign the patient to the correct org
3. **Orphaned patients**: If a patient truly has no org and no caregivers, you may need to:
   - Assign them to a default org
   - Delete them if they're test/duplicate records
   - Create a caregiver relationship first, then re-run the migration

## After Migration

After running the migration successfully:

1. **Verify all patients have orgs**: Check the migration output to ensure no patients were skipped
2. **Deploy the code changes**: Deploy the Patient model changes that make `org` required
3. **Test patient creation**: Verify that new patients require an org when created

## Rollback

If you need to rollback (make `org` optional again):

1. Revert the Patient model changes (remove `required: true`)
2. Revert the validation changes (make `org` optional in `patient.validation.js`)
3. No database changes needed - the migration only adds orgs, it doesn't remove them

## Related Changes

This migration is part of making the `org` field required in the Patient model:
- `src/models/patient.model.js` - `org` field now has `required: true`
- `src/validations/patient.validation.js` - `org` is now required in `createPatient` validation
- `src/services/twilioCall.service.js` - Added warnings when patients don't have orgs

