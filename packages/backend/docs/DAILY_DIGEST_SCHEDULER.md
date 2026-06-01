# Daily Wellness Digest Scheduler

Automated daily digest emails for opted-in caregivers, one send per org-local calendar day.

## Prerequisites

Run migrations (from `packages/backend`):

```bash
yarn migrate:up
```

Relevant migrations:

| Migration | Purpose |
|-----------|---------|
| `20260601120000-caregiver-daily-digest-versioning.js` | Digest versioning |
| `20260601130000-caregiver-daily-digest-org-local-day.js` | Org-local day fields |
| `20260601140000-caregiver-daily-digest-scheduler-run-indexes.js` | Scheduler run ledger indexes |
| `20260601150000-caregiver-daily-digest-email-preference.js` | Caregiver `dailyDigestEmail` default false |
| `20260601160000-org-daily-digest-settings.js` | Org `dailyDigestSettings.enabled` default false |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DAILY_DIGEST_SCHEDULER_ENABLED` | `false` | Master switch for Agenda coordinator + child jobs |
| `DAILY_DIGEST_COORDINATOR_INTERVAL_MINUTES` | `15` | How often the coordinator runs (also used as send-window width) |
| `DAILY_DIGEST_DEFAULT_SEND_TIME` | `18:00` | Org-local HH:mm when org has no custom `sendTime` |

## Consent gates

Automated sends require **all** of:

1. Platform scheduler enabled (`DAILY_DIGEST_SCHEDULER_ENABLED=true`)
2. Org `dailyDigestSettings.enabled === true`
3. Caregiver `notificationPreferences.dailyDigestEmail === true`
4. Caregiver active + verified email

Manual sends from the Daily Digest UI are unchanged and do not require the notification preference.

## Manual: one org / one day

Process synchronously (no Agenda):

```bash
node src/scripts/runDailyDigestScheduler.js \
  --orgId <orgObjectId> \
  --localDateKey 2026-06-01 \
  --trigger manual_test
```

One caregiver:

```bash
node src/scripts/runDailyDigestScheduler.js \
  --orgId <orgObjectId> \
  --caregiverId <caregiverObjectId> \
  --localDateKey 2026-06-01 \
  --trigger manual_test
```

Dry run (build draft, no email):

```bash
node src/scripts/runDailyDigestScheduler.js \
  --orgId <orgObjectId> \
  --localDateKey 2026-06-01 \
  --dryRun
```

Manual coordinator tick (exercises org send-window logic):

```bash
node src/scripts/runDailyDigestCoordinator.js
node src/scripts/runDailyDigestCoordinator.js --dryRun
```

## Staging enablement

1. **Run migrations** on staging MongoDB (`yarn migrate:up`).

2. **Enable platform scheduler** on the backend container / ECS task:

   ```bash
   DAILY_DIGEST_SCHEDULER_ENABLED=true
   DAILY_DIGEST_COORDINATOR_INTERVAL_MINUTES=15
   DAILY_DIGEST_DEFAULT_SEND_TIME=18:00
   ```

3. **Enable org scheduling** (org admin or super admin API):

   ```http
   PATCH /v1/orgs/:orgId
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "dailyDigestSettings": {
       "enabled": true,
       "sendTime": "18:00"
     }
   }
   ```

4. **Opt in caregivers** (Settings UI or API):

   ```http
   PATCH /v1/caregivers/:caregiverId
   {
     "notificationPreferences": { "dailyDigestEmail": true }
   }
   ```

   Web UI: **Settings → Email notifications → Daily wellness digest emails**.

5. **Deploy / restart** backend so Agenda registers jobs on boot.

6. **Verify** ledger rows in `caregiverdailydigestschedulerruns` after the org-local send window.

## Architecture

- **Coordinator** (`processDailyDigestCoordinator`): runs every N minutes; finds orgs in send window; creates ledger rows; enqueues child jobs.
- **Child job** (`processCaregiverDailyDigest`): processes one ledger run via `processCaregiverDailyDigestJob`.
- **Idempotency**: unique index on `{ caregiver, localDateKey }`; terminal runs and existing sent digests skip resend.
- **Stale recovery**: runs in `processing` > 30 minutes are marked `failed` before retry.
- **Restart safety**: on boot, existing `processDailyDigestCoordinator` recurring jobs are cancelled before rescheduling to avoid duplicate ticks.

## Disable / rollback

### Stop automated sends immediately (no deploy)

Set on the backend task / container and restart:

```bash
DAILY_DIGEST_SCHEDULER_ENABLED=false
```

This prevents Agenda job definition, recurring schedule registration, and coordinator ticks. Manual scripts (`runDailyDigestScheduler.js`, `runDailyDigestCoordinator.js --dryRun`) do not send unless explicitly run without `--dryRun`.

### Disable for one org (keep platform scheduler on)

```http
PATCH /v1/orgs/:orgId
{ "dailyDigestSettings": { "enabled": false } }
```

### Disable for one caregiver

```http
PATCH /v1/caregivers/:caregiverId
{ "notificationPreferences": { "dailyDigestEmail": false } }
```

Or use **Settings → Email notifications** in the web app.

### Roll back migrations

Only index migrations have reversible `down` steps. Data migrations intentionally retain consent/opt-in state:

| Migration | Rollback |
|-----------|----------|
| `20260601140000-caregiver-daily-digest-scheduler-run-indexes.js` | Drops scheduler-run indexes only |
| `20260601150000-caregiver-daily-digest-email-preference.js` | No-op (preserves caregiver opt-in) |
| `20260601160000-org-daily-digest-settings.js` | No-op (preserves org opt-in) |

To fully disable after enabling in staging: set env flag false, set org `dailyDigestSettings.enabled=false`, and optionally set caregiver `dailyDigestEmail=false`.
