/**
 * Migration: 'patient' / 'Patient' → 'client' / 'Client' in enum fields
 *
 * Updates documents that still have legacy patient values so they match
 * the updated schema enums (patient removed; client only).
 *
 * - privacyrequests: requestorType 'patient' → 'client', requestorModel 'Patient' → 'Client'
 * - consentrecords: userType 'patient' → 'client', userModel 'Patient' → 'Client'
 * - breachlogs: affectedResourceType 'patient' → 'client'
 * - privacycomplaints: complainantType 'patient' → 'client', complainantModel 'Patient' → 'Client'
 *
 * Safe to run multiple times. Created: 2026-03-10
 */

module.exports = {
  async up(db) {
    try {
      let n;
      n = (await db.collection('privacyrequests').updateMany({ requestorType: 'patient' }, { $set: { requestorType: 'client' } })).modifiedCount;
      if (n > 0) console.log(`[Migration] privacyrequests: requestorType patient → client (${n})`);
      n = (await db.collection('privacyrequests').updateMany({ requestorModel: 'Patient' }, { $set: { requestorModel: 'Client' } })).modifiedCount;
      if (n > 0) console.log(`[Migration] privacyrequests: requestorModel Patient → Client (${n})`);

      n = (await db.collection('consentrecords').updateMany({ userType: 'patient' }, { $set: { userType: 'client' } })).modifiedCount;
      if (n > 0) console.log(`[Migration] consentrecords: userType patient → client (${n})`);
      n = (await db.collection('consentrecords').updateMany({ userModel: 'Patient' }, { $set: { userModel: 'Client' } })).modifiedCount;
      if (n > 0) console.log(`[Migration] consentrecords: userModel Patient → Client (${n})`);

      n = (await db.collection('breachlogs').updateMany({ affectedResourceType: 'patient' }, { $set: { affectedResourceType: 'client' } })).modifiedCount;
      if (n > 0) console.log(`[Migration] breachlogs: affectedResourceType patient → client (${n})`);

      n = (await db.collection('privacycomplaints').updateMany({ complainantType: 'patient' }, { $set: { complainantType: 'client' } })).modifiedCount;
      if (n > 0) console.log(`[Migration] privacycomplaints: complainantType patient → client (${n})`);
      n = (await db.collection('privacycomplaints').updateMany({ complainantModel: 'Patient' }, { $set: { complainantModel: 'Client' } })).modifiedCount;
      if (n > 0) console.log(`[Migration] privacycomplaints: complainantModel Patient → Client (${n})`);

      console.log('[Migration] patient → client enums completed.');
    } catch (err) {
      console.error('[Migration] patient → client enums failed:', err);
      throw err;
    }
  },

  async down(db) {
    console.log('[Migration] Down: patient→client enums does not auto-rollback. Restore from backup if needed.');
  },
};
