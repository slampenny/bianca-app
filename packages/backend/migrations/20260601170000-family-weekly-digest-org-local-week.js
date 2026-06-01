/**
 * Migration: FamilyWeeklyDigest org-local week fields
 *
 * - Adds localWeekKey, timezoneAtBuild, legacyUtcWeek
 * - Backfills existing rows as legacy UTC-week records (legacyUtcWeek=true)
 *
 * Existing weekStart values were stored as UTC Monday midnight; localWeekKey is
 * derived from UTC calendar components for those rows. New digests use org-local semantics.
 *
 * Run: yarn migrate:up (from packages/backend)
 * Rollback: yarn migrate:down
 */

const formatUtcLocalDateKey = (weekStart) => {
  const d = weekStart instanceof Date ? weekStart : new Date(weekStart);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

module.exports = {
  async up(db) {
    const coll = db.collection('familyweeklydigests');
    const cursor = coll.find({});
    let updated = 0;

    // eslint-disable-next-line no-restricted-syntax
    for await (const doc of cursor) {
      if (doc.localWeekKey && doc.legacyUtcWeek === true) {
        continue;
      }

      const localWeekKey =
        doc.localWeekKey || (doc.weekStart ? formatUtcLocalDateKey(doc.weekStart) : null);
      if (!localWeekKey) {
        continue;
      }

      const $set = {
        localWeekKey,
        legacyUtcWeek: true,
        timezoneAtBuild: doc.timezoneAtBuild ?? null,
      };

      await coll.updateOne({ _id: doc._id }, { $set });
      updated += 1;
    }

    if (updated > 0) {
      console.log(
        `[Migration] familyweeklydigests: backfilled org-local week fields on ${updated} document(s) (legacyUtcWeek=true)`
      );
    }

    try {
      await coll.dropIndex('client_1_weekStart_1');
      console.log('[Migration] familyweeklydigests: dropped index client_1_weekStart_1');
    } catch (err) {
      console.warn(`[Migration] familyweeklydigests: could not drop client_1_weekStart_1: ${err.message}`);
    }

    await coll.createIndex({ client: 1, localWeekKey: 1 }, { unique: true });
    console.log('[Migration] familyweeklydigests: ensured unique index client_1_localWeekKey_1');

    await coll.createIndex({ org: 1, localWeekKey: 1, phiRedactedAt: 1 });
    console.log('[Migration] familyweeklydigests: ensured index org_1_localWeekKey_1_phiRedactedAt_1');
  },

  async down(db) {
    const coll = db.collection('familyweeklydigests');

    try {
      await coll.dropIndex('client_1_localWeekKey_1');
      console.log('[Migration] familyweeklydigests: dropped index client_1_localWeekKey_1');
    } catch (err) {
      console.warn(`[Migration] familyweeklydigests: could not drop client_1_localWeekKey_1: ${err.message}`);
    }

    try {
      await coll.dropIndex('org_1_localWeekKey_1_phiRedactedAt_1');
    } catch (err) {
      console.warn(`[Migration] familyweeklydigests: could not drop org localWeekKey index: ${err.message}`);
    }

    await coll.createIndex({ client: 1, weekStart: 1 }, { unique: true });
    console.log('[Migration] familyweeklydigests: restored index client_1_weekStart_1');

    console.log(
      '[Migration] familyweeklydigests: rollback complete (localWeekKey/timezoneAtBuild/legacyUtcWeek retained on documents)'
    );
  },
};
