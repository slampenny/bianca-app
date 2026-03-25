/**
 * Migration: Call.agentId → Call.caregiverId
 *
 * Renames the field on the calls collection to match domain language (caregiver, not "agent").
 * Safe to run multiple times: only updates documents that still have agentId and no caregiverId.
 *
 * Run: yarn migrate:up (from packages/backend)
 */

module.exports = {
  async up(db) {
    const result = await db.collection('calls').updateMany(
      {
        agentId: { $exists: true },
        $or: [{ caregiverId: { $exists: false } }, { caregiverId: null }],
      },
      [{ $set: { caregiverId: '$agentId' } }, { $unset: 'agentId' }]
    );
    if (result.modifiedCount > 0) {
      console.log(
        `[Migration] calls: renamed agentId → caregiverId on ${result.modifiedCount} document(s)`
      );
    }
  },

  async down(db) {
    const result = await db.collection('calls').updateMany(
      {
        caregiverId: { $exists: true },
        $or: [{ agentId: { $exists: false } }, { agentId: null }],
      },
      [{ $set: { agentId: '$caregiverId' } }, { $unset: 'caregiverId' }]
    );
    if (result.modifiedCount > 0) {
      console.log(
        `[Migration] calls rollback: renamed caregiverId → agentId on ${result.modifiedCount} document(s)`
      );
    }
  },
};
