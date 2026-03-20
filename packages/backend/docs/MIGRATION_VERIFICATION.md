# Migration Verification

After deploying to production, verify that all migrations (especially critical ones) have run successfully.

## Quick Check

### Option 1: API Endpoint (Recommended)

Call the migration status endpoint (requires authentication):

```bash
curl -H "Authorization: Bearer <token>" https://api.biancawellness.com/v1/test/migration-status
```

Response includes:
- `total`: Total migration files
- `ran`: Number that have run
- `pending`: Number pending
- `critical`: Object with `total`, `ran`, `missing` arrays
- `healthy`: `true` if all critical migrations have run
- `migrations`: Array of each migration with `fileName`, `hasRun`, `isCritical`, `status`

If `healthy: false` or `critical.missing.length > 0`, **critical migrations are missing** and the app may not work correctly.

### Option 2: Command Line Script

SSH to the production server and run:

```bash
cd /opt/bianca-production
docker compose run --rm -e NODE_ENV=production -e MONGODB_URL=mongodb://mongodb:27017/bianca-service app yarn migrate:check
```

Or if using `docker-compose` (older):

```bash
docker-compose run --rm -e NODE_ENV=production -e MONGODB_URL=mongodb://mongodb:27017/bianca-service app yarn migrate:check
```

The script will:
- ✅ Show all migrations and their status
- 🔴 Highlight critical migrations that haven't run
- Exit with code 1 if critical migrations are missing (so you can use it in CI/CD)

### Option 3: Standard migrate-mongo Status

```bash
docker compose run --rm -e NODE_ENV=production -e MONGODB_URL=mongodb://mongodb:27017/bianca-service app yarn migrate:status
```

This shows the raw migrate-mongo status (which migrations have run).

## Critical Migrations

These migrations **MUST** run for the app to work correctly:

1. **`20260310-copy-patients-to-clients.js`** - Copies all documents from `patients` collection to `clients` collection. Without this, existing `clientId` references in calls/conversations/schedules won't resolve.

2. **`20260310-message-role-patient-to-client.js`** - Updates message roles from `'patient'` to `'client'`. Without this, messages with old roles will fail validation.

3. **`20260310-patient-to-client-enums.js`** - Updates enum fields in privacy/consent/breach/complaint models. Without this, old enum values will fail validation.

4. **`20260310-org-require-patient-consent-to-require-client-consent.js`** - Renames `requirePatientConsent` to `requireClientConsent` in orgs. Without this, the app will look for the wrong field name.

## Automatic Verification

The deployment script (`application_start.sh`) now automatically runs `yarn migrate:check` after migrations complete. Check the deployment logs for:

```
✅ Migrations completed successfully
🔍 Verifying migration status...
✅ All critical migrations verified
```

If you see warnings, check the logs above for which migrations are missing.

## Manual Migration

If migrations didn't run automatically or you need to run them manually:

```bash
cd /opt/bianca-production
docker compose run --rm -e NODE_ENV=production -e MONGODB_URL=mongodb://mongodb:27017/bianca-service app yarn migrate:up
```

Then verify with `yarn migrate:check` or the API endpoint.
