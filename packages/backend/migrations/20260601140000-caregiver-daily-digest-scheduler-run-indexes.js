/**
 * Migration: CaregiverDailyDigestSchedulerRun indexes
 *
 * - Ensures unique caregiver + localDateKey ledger index
 * - Ensures org + localDateKey + status query index
 *
 * Run: yarn migrate:up (from packages/backend)
 * Rollback: yarn migrate:down
 */

const COLLECTION = 'caregiverdailydigestschedulerruns';

const INDEXES = [
  { key: { caregiver: 1, localDateKey: 1 }, options: { unique: true, name: 'caregiver_1_localDateKey_1' } },
  { key: { org: 1, localDateKey: 1, status: 1 }, options: { name: 'org_1_localDateKey_1_status_1' } },
];

async function ensureIndex(coll, { key, options }) {
  const existing = await coll.indexes();
  const name = options.name;
  const already = existing.some((idx) => idx.name === name);
  if (already) {
    console.log(`[Migration] ${COLLECTION}: index ${name} already exists`);
    return;
  }
  await coll.createIndex(key, options);
  console.log(`[Migration] ${COLLECTION}: created index ${name}`);
}

module.exports = {
  async up(db) {
    const coll = db.collection(COLLECTION);
    // eslint-disable-next-line no-restricted-syntax
    for (const spec of INDEXES) {
      await ensureIndex(coll, spec);
    }
  },

  async down(db) {
    const coll = db.collection(COLLECTION);
    // eslint-disable-next-line no-restricted-syntax
    for (const spec of INDEXES) {
      const name = spec.options.name;
      try {
        await coll.dropIndex(name);
        console.log(`[Migration] ${COLLECTION}: dropped index ${name}`);
      } catch (err) {
        console.warn(`[Migration] ${COLLECTION}: could not drop index ${name}: ${err.message}`);
      }
    }
  },
};
