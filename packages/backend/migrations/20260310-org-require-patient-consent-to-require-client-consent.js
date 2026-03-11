/**
 * Migration: Rename org.requirePatientConsent → org.requireClientConsent
 *
 * Aligns org schema with client terminology. Idempotent: only renames when
 * requirePatientConsent exists and requireClientConsent does not.
 *
 * Created: 2026-03-10
 */

module.exports = {
  async up(db) {
    const orgs = db.collection('orgs');
    const result = await orgs.updateMany(
      { requirePatientConsent: { $exists: true } },
      { $rename: { requirePatientConsent: 'requireClientConsent' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Migration] Renamed requirePatientConsent → requireClientConsent in ${result.modifiedCount} org(s).`);
    }
  },

  async down(db) {
    const orgs = db.collection('orgs');
    const result = await orgs.updateMany(
      { requireClientConsent: { $exists: true } },
      { $rename: { requireClientConsent: 'requirePatientConsent' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Migration] Rolled back: requireClientConsent → requirePatientConsent in ${result.modifiedCount} org(s).`);
    }
  },
};
