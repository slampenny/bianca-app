/**
 * Optional email on emergency contact — used for scoped family communications (e.g. weekly call digest).
 */

const logger = require('../src/config/logger');

module.exports = {
  async up(db) {
    logger.info('[Migration] Starting: emergencyContact.email on clients');
    const coll = db.collection('clients');
    try {
      const r = await coll.updateMany(
        {
          emergencyContact: { $type: 'object' },
          'emergencyContact.email': { $exists: false },
        },
        { $set: { 'emergencyContact.email': '' } }
      );
      logger.info(`[Migration] ✅ Added emergencyContact.email on ${r.modifiedCount} client(s)`);
    } catch (err) {
      if (err.codeName === 'NamespaceNotFound' || (err.message && err.message.includes('does not exist'))) {
        logger.info('[Migration] clients collection missing, skipping');
        return;
      }
      throw err;
    }
    logger.info('[Migration] Completed: emergencyContact.email');
  },

  async down(db) {
    logger.info('[Migration] Rolling back: emergencyContact.email');
    const coll = db.collection('clients');
    try {
      await coll.updateMany({}, { $unset: { 'emergencyContact.email': '' } });
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') {
        throw err;
      }
    }
  },
};
