/**
 * Migration: Client facility fields — room, moveInDate, emergencyContact
 *
 * Adds optional fields for facility/resident directory UI. Existing documents
 * are backfilled with empty emergencyContact so shape is consistent; room and
 * moveInDate stay unset until edited (null would also work; we omit them).
 *
 * Down removes these fields from all clients.
 */

const logger = require('../src/config/logger');

module.exports = {
  async up(db) {
    logger.info('[Migration] Starting: client room, moveInDate, emergencyContact');

    const coll = db.collection('clients');
    let backfillEc;
    try {
      backfillEc = await coll.updateMany(
        { $or: [{ emergencyContact: { $exists: false } }, { emergencyContact: null }] },
        {
          $set: {
            emergencyContact: {
              name: '',
              relationship: '',
              phone: '',
            },
          },
        }
      );
    } catch (err) {
      if (err.codeName === 'NamespaceNotFound' || (err.message && err.message.includes('does not exist'))) {
        logger.info('[Migration] clients collection missing, skipping');
        return;
      }
      throw err;
    }
    logger.info(`[Migration] ✅ Backfilled emergencyContact on ${backfillEc.modifiedCount} client(s)`);

    logger.info('[Migration] Completed: client room, moveInDate, emergencyContact');
  },

  async down(db) {
    logger.info('[Migration] Rolling back: client room, moveInDate, emergencyContact');
    const coll = db.collection('clients');
    try {
      const r = await coll.updateMany(
        {},
        { $unset: { room: '', moveInDate: '', emergencyContact: '' } }
      );
      logger.info(`[Migration] ✅ Removed fields from ${r.modifiedCount} client(s)`);
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') {
        throw err;
      }
    }
    logger.info('[Migration] Rollback completed.');
  },
};
