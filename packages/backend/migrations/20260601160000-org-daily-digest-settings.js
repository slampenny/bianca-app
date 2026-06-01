/**
 * Migration: Org dailyDigestSettings defaults
 *
 * - Ensures dailyDigestSettings.enabled=false on existing orgs
 * - sendTime left null (platform default applied at runtime)
 *
 * Run: yarn migrate:up (from packages/backend)
 * Rollback: yarn migrate:down
 */

const COLLECTION = 'orgs';

module.exports = {
  async up(db) {
    const coll = db.collection(COLLECTION);
    const result = await coll.updateMany(
      {
        $or: [
          { dailyDigestSettings: { $exists: false } },
          { 'dailyDigestSettings.enabled': { $exists: false } },
        ],
      },
      {
        $set: {
          'dailyDigestSettings.enabled': false,
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(
        `[Migration] ${COLLECTION}: set dailyDigestSettings.enabled=false on ${result.modifiedCount} document(s)`
      );
    } else {
      console.log(`[Migration] ${COLLECTION}: all orgs already have dailyDigestSettings.enabled`);
    }
  },

  async down(db) {
    console.log(
      `[Migration] ${COLLECTION}: rollback skipped — dailyDigestSettings left in place to preserve org opt-in state`
    );
  },
};
