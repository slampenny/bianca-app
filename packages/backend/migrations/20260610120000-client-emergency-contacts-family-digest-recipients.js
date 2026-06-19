/**
 * Migration: emergencyContacts[] + familyDigestRecipients[] from legacy emergencyContact.
 */

const logger = require('../src/config/logger');

const hasLegacyEmergencyData = (ec) =>
  ec &&
  typeof ec === 'object' &&
  (String(ec.name || '').trim() ||
    String(ec.relationship || '').trim() ||
    String(ec.phone || '').trim() ||
    String(ec.email || '').trim());

module.exports = {
  async up(db) {
    logger.info('[Migration] Starting: client emergencyContacts + familyDigestRecipients');
    const coll = db.collection('clients');
    let cursor;
    try {
      cursor = coll.find({
        $or: [
          { emergencyContacts: { $exists: false } },
          { emergencyContacts: { $size: 0 } },
          { familyDigestRecipients: { $exists: false } },
          { familyDigestRecipients: { $size: 0 } },
        ],
        emergencyContact: { $exists: true, $ne: null },
      });
    } catch (err) {
      if (err.codeName === 'NamespaceNotFound' || (err.message && err.message.includes('does not exist'))) {
        logger.info('[Migration] clients collection missing, skipping');
        return;
      }
      throw err;
    }

    let updated = 0;
    // eslint-disable-next-line no-restricted-syntax
    for await (const doc of cursor) {
      const ec = doc.emergencyContact;
      if (!hasLegacyEmergencyData(ec)) continue;
      const set = {};
      if (!Array.isArray(doc.emergencyContacts) || doc.emergencyContacts.length === 0) {
        set.emergencyContacts = [
          {
            name: ec.name || '',
            relationship: ec.relationship || '',
            phone: ec.phone || '',
            email: ec.email || '',
          },
        ];
      }
      if (!Array.isArray(doc.familyDigestRecipients) || doc.familyDigestRecipients.length === 0) {
        const email = ec.email || '';
        const fd = ec.familyDigestEmail || {};
        const hasDigest =
          String(email).trim() !== '' || fd.enabled === true || fd.verifiedAt || fd.verifiedEmail;
        if (hasDigest) {
          set.familyDigestRecipients = [
            {
              name: ec.name || '',
              relationship: ec.relationship || '',
              email,
              familyDigestEmail: {
                enabled: fd.enabled === true,
                verifiedAt: fd.verifiedAt || null,
                verifiedEmail: fd.verifiedEmail || null,
              },
            },
          ];
        }
      }
      if (Object.keys(set).length === 0) continue;
      await coll.updateOne({ _id: doc._id }, { $set: set });
      updated += 1;
    }
    logger.info(`[Migration] ✅ Migrated emergency/family fields on ${updated} client(s)`);
  },

  async down(db) {
    logger.info('[Migration] Rollback no-op: emergencyContacts/familyDigestRecipients preserved');
    const coll = db.collection('clients');
    try {
      await coll.updateMany({}, { $unset: { emergencyContacts: '', familyDigestRecipients: '' } });
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') throw err;
    }
  },
};
