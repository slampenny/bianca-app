/**
 * Migration: Copy all documents from `patients` to `clients`
 *
 * The app uses the Client model and the `clients` collection. Other collections
 * (calls, conversations, schedules, etc.) reference the person by ID; 20260307
 * already migrated those references from patientId to clientId. Those IDs point
 * at documents in `patients`. So we copy every patient document into `clients`
 * with the same _id, so existing clientId references continue to resolve.
 *
 * - Idempotent: only inserts patients whose _id is not already in clients.
 * - Safe to run multiple times.
 *
 * Created: 2026-03-10
 */

module.exports = {
  async up(db) {
    const patientsColl = db.collection('patients');
    const clientsColl = db.collection('clients');

    let existingCount;
    try {
      existingCount = await patientsColl.countDocuments();
    } catch (e) {
      if (e.codeName === 'NamespaceNotFound' || (e.message && e.message.includes('does not exist'))) {
        console.log('[Migration] patients collection does not exist; nothing to copy.');
        return;
      }
      throw e;
    }

    if (existingCount === 0) {
      console.log('[Migration] patients collection is empty; nothing to copy.');
      return;
    }

    const patients = await patientsColl.find({}).toArray();
    const existingClientIds = new Set(
      (await clientsColl.find({}, { projection: { _id: 1 } }).toArray()).map((c) => c._id.toString())
    );
    const toInsert = patients.filter((p) => !existingClientIds.has(p._id.toString()));

    if (toInsert.length === 0) {
      console.log('[Migration] All patient documents already exist in clients; nothing to copy.');
      return;
    }

    await clientsColl.insertMany(toInsert);
    console.log(`[Migration] Copied ${toInsert.length} document(s) from patients to clients (${existingCount} total in patients).`);
    console.log('[Migration] copy-patients-to-clients completed.');
  },

  async down(db) {
    console.log('[Migration] Down: copy-patients-to-clients does not remove documents from clients.');
    console.log('[Migration] To undo, restore clients from backup or delete docs that came from patients.');
  },
};
