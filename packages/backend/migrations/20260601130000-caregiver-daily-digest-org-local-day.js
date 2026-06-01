/**
 * Migration: CaregiverDailyDigest org-local day fields
 *
 * - Adds localDateKey, timezoneAtBuild, legacyUtcDay
 * - Backfills existing rows as legacy UTC-day records (legacyUtcDay=true)
 *
 * Existing digestDate values were stored as UTC midnight; localDateKey is derived
 * from UTC calendar components for those rows. New digests use org-local semantics.
 *
 * Run: yarn migrate:up (from packages/backend)
 * Rollback: yarn migrate:down
 */

const formatUtcLocalDateKey = (digestDate) => {
  const d = digestDate instanceof Date ? digestDate : new Date(digestDate);
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
    const coll = db.collection('caregiverdailydigests');
    const cursor = coll.find({});
    let updated = 0;

    // eslint-disable-next-line no-restricted-syntax
    for await (const doc of cursor) {
      if (doc.localDateKey && doc.legacyUtcDay === true) {
        continue;
      }

      const localDateKey =
        doc.localDateKey || (doc.digestDate ? formatUtcLocalDateKey(doc.digestDate) : null);
      if (!localDateKey) {
        continue;
      }

      const $set = {
        localDateKey,
        legacyUtcDay: true,
        timezoneAtBuild: doc.timezoneAtBuild ?? null,
      };

      await coll.updateOne({ _id: doc._id }, { $set });
      updated += 1;
    }

    if (updated > 0) {
      console.log(
        `[Migration] caregiverdailydigests: backfilled org-local fields on ${updated} document(s) (legacyUtcDay=true)`
      );
    }

    await coll.createIndex({ caregiver: 1, localDateKey: 1 });
    console.log('[Migration] caregiverdailydigests: ensured index caregiver_1_localDateKey_1');
  },

  async down(db) {
    const coll = db.collection('caregiverdailydigests');

    try {
      await coll.dropIndex('caregiver_1_localDateKey_1');
      console.log('[Migration] caregiverdailydigests: dropped index caregiver_1_localDateKey_1');
    } catch (err) {
      console.warn(`[Migration] caregiverdailydigests: could not drop localDateKey index: ${err.message}`);
    }

    console.log(
      '[Migration] caregiverdailydigests: rollback complete (localDateKey/timezoneAtBuild/legacyUtcDay retained on documents)'
    );
  },
};
