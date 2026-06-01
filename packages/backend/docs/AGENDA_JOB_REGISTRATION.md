# Agenda Job Registration

## Standard pattern for recurring jobs

All recurring Agenda jobs must be registered through `scheduleRecurringJob()` in `src/utils/agenda.utils.js`:

```javascript
const { scheduleRecurringJob } = require('../utils/agenda.utils');

await scheduleRecurringJob({
  agenda,
  jobName: 'myRecurringJob',
  interval: '15 minutes', // or cron, e.g. '0 2 * * *'
  data: { optional: 'payload' }, // only if the job needs default data
  logger,
});
```

Main app recurring jobs are registered in `registerRecurringAgendaJobs()` (`src/config/agenda.js`). Medical analysis recurring jobs use the same helper in `medicalAnalysisScheduler.service.js` (separate Agenda collection: `medicalAnalysisJobs`).

## Why cancel-before-every is required

Agenda persists job definitions in MongoDB. On each backend startup, the `ready` handler runs registration again. Calling `agenda.every()` without cancelling first **adds another recurring job document** with the same name. After restarts or blue/green overlap, duplicate jobs can fire in parallel.

`scheduleRecurringJob()` always:

1. `await agenda.cancel({ name: jobName })` — removes existing jobs with that name only
2. `agenda.every(interval, jobName, data?)` — creates a single fresh recurring job
3. Logs how many jobs were cancelled and what was scheduled

This makes registration **idempotent**: safe to call on every startup.

## Blue/green deployment implications

During deploy overlap, old and new instances may both connect to the same Agenda MongoDB collection. Each instance runs registration on `ready`. Cancel-before-every ensures that even if two instances register concurrently, each registration replaces prior jobs with the same name rather than accumulating duplicates.

**Note:** Brief gaps or double-fires are still possible during overlap. Downstream logic must remain idempotent (see below).

## When not to use the helper

Do **not** use `scheduleRecurringJob()` for:

- **One-off jobs** — `agenda.schedule('in 5 minutes', 'retryMissedCall', data)` or `agenda.now('processCaregiverDailyDigest', data)`
- **Child jobs enqueued at runtime** — e.g. digest coordinator enqueuing per-caregiver work via `agenda.now()`
- **Jobs whose name is reused for both recurring and one-off patterns** — cancel by name would remove in-flight one-offs

Only jobs registered exclusively via `agenda.every()` should use this helper.

## Downstream idempotency is still required

Cancel-before-every prevents duplicate **recurring registrations**. It does not guarantee exactly-once execution:

- A job may still run twice if overlap or retries occur
- Handlers should use locks, unique indexes, ledgers, or other idempotency guards

Examples in this codebase:

| Job | Idempotency |
|-----|-------------|
| `runSchedules` | Schedule `lastRunAt` / job locking |
| `processUsageReporting` | Stripe usage record deduplication |
| `processDataDeletion` | Jurisdiction and retention rules |
| `processDailyDigestCoordinator` | Scheduler run ledger + unique `{ caregiver, localDateKey }` |
| `retryMissedCall` | One-off; not registered via helper |

## Inventory (main Agenda)

| Job | Cadence | Recurring | Registration |
|-----|---------|-----------|--------------|
| `runSchedules` | 15 minutes | Yes | `registerRecurringAgendaJobs` |
| `processUsageReporting` | Daily (config time) | Yes (if enabled) | `registerRecurringAgendaJobs` |
| `processDataDeletion` | `0 2 * * *` | Yes | `registerRecurringAgendaJobs` |
| `checkClientsWithoutSchedules` | 30 minutes | Yes | `registerRecurringAgendaJobs` |
| `processDailyDigestCoordinator` | Config interval | Yes (if enabled) | `scheduleDailyDigestCoordinator` |
| `processCaregiverDailyDigest` | On demand (`now`) | No | Coordinator / manual |
| `retryMissedCall` | One-off schedule | No | `voiceCallStatus.handler` |

## Inventory (medical analysis Agenda)

| Job | Cadence | Recurring | Registration |
|-----|---------|-----------|--------------|
| `monthly-medical-analysis` | Config cron | Yes | `MedicalAnalysisScheduler.scheduleRecurringJobs` |
| `cleanup-old-analyses` | `0 22 1 * *` | Yes | `MedicalAnalysisScheduler.scheduleRecurringJobs` |
| `client-medical-analysis` | On demand | No | Runtime `now` / `schedule` |
