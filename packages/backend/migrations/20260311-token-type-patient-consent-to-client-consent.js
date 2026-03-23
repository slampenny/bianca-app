/**
 * Migration: Token.type 'patientConsent' → 'clientConsent'
 *
 * Token documents created before this change stored consent token type as `patientConsent`.
 * Renames to `clientConsent` for consistent terminology.
 *
 * Safe to run multiple times: only updates documents where type === 'patientConsent'.
 */

module.exports = {
  async up(db) {
    try {
      const result = await db.collection('tokens').updateMany(
        { type: 'patientConsent' },
        { $set: { type: 'clientConsent' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Migration] tokens: migrated ${result.modifiedCount} document(s) type patientConsent → clientConsent`);
      }
      console.log('[Migration] token type patientConsent → clientConsent completed.');
    } catch (err) {
      console.error('[Migration] token type migration failed:', err);
      throw err;
    }
  },

  async down(db) {
    const result = await db.collection('tokens').updateMany(
      { type: 'clientConsent' },
      { $set: { type: 'patientConsent' } }
    );
    console.log(`[Migration] Rolled back ${result.modifiedCount} token(s) to patientConsent.`);
  },
};
