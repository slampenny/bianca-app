/**
 * Migration: Caregiver notificationPreferences.dailyDigestEmail default false
 *
 * - Ensures existing caregivers have explicit dailyDigestEmail=false (opt-in consent gate)
 * - New caregivers receive schema default false at creation
 *
 * Run: yarn migrate:up (from packages/backend)
 * Rollback: yarn migrate:down
 *
 * Rollback note: we do not unset notificationPreferences on rollback because removing
 * explicit consent state could re-enable ambiguous automated sends for caregivers who
 * opted in after this migration.
 */

const COLLECTION = 'caregivers';

module.exports = {
  async up(db) {
    const coll = db.collection(COLLECTION);
    const result = await coll.updateMany(
      {
        $or: [
          { notificationPreferences: { $exists: false } },
          { 'notificationPreferences.dailyDigestEmail': { $exists: false } },
        ],
      },
      { $set: { 'notificationPreferences.dailyDigestEmail': false } }
    );
    if (result.modifiedCount > 0) {
      console.log(
        `[Migration] ${COLLECTION}: set notificationPreferences.dailyDigestEmail=false on ${result.modifiedCount} document(s)`
      );
    } else {
      console.log(`[Migration] ${COLLECTION}: all documents already have dailyDigestEmail preference`);
    }
  },

  async down(db) {
    console.log(
      `[Migration] ${COLLECTION}: rollback skipped — notificationPreferences.dailyDigestEmail left in place to preserve opt-in consent state`
    );
  },
};
