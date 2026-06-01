/**
 * Migration: emergencyContact.familyDigestEmail opt-in defaults (enabled=false).
 *
 * Run: yarn migrate:up (from packages/backend)
 * Rollback: preserves explicit opt-in values on documents (no-op).
 */

module.exports = {
  async up(db) {
    const coll = db.collection('clients');
    const result = await coll.updateMany(
      {
        emergencyContact: { $type: 'object' },
        $or: [
          { 'emergencyContact.familyDigestEmail': { $exists: false } },
          { 'emergencyContact.familyDigestEmail.enabled': { $exists: false } },
        ],
      },
      {
        $set: {
          'emergencyContact.familyDigestEmail.enabled': false,
          'emergencyContact.familyDigestEmail.verifiedAt': null,
          'emergencyContact.familyDigestEmail.verifiedEmail': null,
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(
        `[Migration] clients: initialized emergencyContact.familyDigestEmail on ${result.modifiedCount} document(s) (enabled=false)`
      );
    }
  },

  async down() {
    console.log(
      '[Migration] clients: rollback no-op for familyDigestEmail (explicit opt-in values preserved on documents)'
    );
  },
};
