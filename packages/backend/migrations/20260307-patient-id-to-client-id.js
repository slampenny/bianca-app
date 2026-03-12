/**
 * Migration: patient_id / patientId → client_id / clientId (and related renames)
 *
 * Ensures production data is migrated from legacy patient* fields to client* fields
 * so that no data is lost when the application uses client_id everywhere.
 *
 * Run once per environment (e.g. production). Safe to run multiple times:
 * only updates documents that still have the legacy field.
 *
 * Created: 2026-03-07
 */

module.exports = {
  async up(db, client) {
    // Note: No transaction - standalone MongoDB (e.g. local, some test envs) does not support
    // transactions. Migration is idempotent and only touches docs with legacy fields.
    try {
      // 1. calls: patientId → clientId
      const callsResult = await db.collection('calls').updateMany(
        { patientId: { $exists: true }, $or: [{ clientId: { $exists: false } }, { clientId: null }] },
        [
          { $set: { clientId: '$patientId' } },
          { $unset: 'patientId' },
        ]
      );
        if (callsResult.modifiedCount > 0) {
          console.log(`[Migration] calls: migrated ${callsResult.modifiedCount} document(s) patientId → clientId`);
        }

      // 2. conversations: patientId → clientId
      const convResult = await db.collection('conversations').updateMany(
        { patientId: { $exists: true }, $or: [{ clientId: { $exists: false } }, { clientId: null }] },
        [
          { $set: { clientId: '$patientId' } },
          { $unset: 'patientId' },
        ]
      );
        if (convResult.modifiedCount > 0) {
          console.log(`[Migration] conversations: migrated ${convResult.modifiedCount} document(s) patientId → clientId`);
        }

      // 3. schedules: patient → client (and patientId → client if needed)
      const schedWithPatient = await db.collection('schedules').updateMany(
        { patient: { $exists: true }, $or: [{ client: { $exists: false } }, { client: null }] },
        [
          { $set: { client: '$patient' } },
          { $unset: 'patient' },
        ]
      );
      if (schedWithPatient.modifiedCount > 0) {
        console.log(`[Migration] schedules: migrated ${schedWithPatient.modifiedCount} document(s) patient → client`);
      }
      const schedWithPatientId = await db.collection('schedules').updateMany(
        { patientId: { $exists: true }, $or: [{ client: { $exists: false } }, { client: null }] },
        [
          { $set: { client: '$patientId' } },
          { $unset: 'patientId' },
        ]
      );
      if (schedWithPatientId.modifiedCount > 0) {
        console.log(`[Migration] schedules: migrated ${schedWithPatientId.modifiedCount} document(s) patientId → client`);
      }

      // 4. alerts: relatedPatient → relatedClient
      const alertsResult = await db.collection('alerts').updateMany(
        { relatedPatient: { $exists: true }, $or: [{ relatedClient: { $exists: false } }, { relatedClient: null }] },
        [
          { $set: { relatedClient: '$relatedPatient' } },
          { $unset: 'relatedPatient' },
        ]
      );
      if (alertsResult.modifiedCount > 0) {
        console.log(`[Migration] alerts: migrated ${alertsResult.modifiedCount} document(s) relatedPatient → relatedClient`);
      }

      // 5. tokens: patient → client
      const tokensResult = await db.collection('tokens').updateMany(
        { patient: { $exists: true }, $or: [{ client: { $exists: false } }, { client: null }] },
        [
          { $set: { client: '$patient' } },
          { $unset: 'patient' },
        ]
      );
      if (tokensResult.modifiedCount > 0) {
        console.log(`[Migration] tokens: migrated ${tokensResult.modifiedCount} document(s) patient → client`);
      }

      // 6. caregivers: patients → clients (set clients = patients when clients missing/empty, then remove patients)
      const caregiversResult = await db.collection('caregivers').updateMany(
        { patients: { $exists: true } },
        [
          {
            $set: {
              clients: {
                $cond: {
                  if: { $or: [{ $eq: ['$clients', null] }, { $eq: ['$clients', []] }] },
                  then: '$patients',
                  else: '$clients',
                },
              },
            },
          },
          { $unset: 'patients' },
        ]
      );
      if (caregiversResult.modifiedCount > 0) {
        console.log(`[Migration] caregivers: migrated ${caregiversResult.modifiedCount} document(s) patients → clients`);
      }

      // 7. medicalanalyses: patientId → clientId
      const medResult = await db.collection('medicalanalyses').updateMany(
        { patientId: { $exists: true }, $or: [{ clientId: { $exists: false } }, { clientId: null }] },
        [
          { $set: { clientId: '$patientId' } },
          { $unset: 'patientId' },
        ]
      );
      if (medResult.modifiedCount > 0) {
        console.log(`[Migration] medicalanalyses: migrated ${medResult.modifiedCount} document(s) patientId → clientId`);
      }

      // 8. medicalbaselines: patientId → clientId
      const baseResult = await db.collection('medicalbaselines').updateMany(
        { patientId: { $exists: true }, $or: [{ clientId: { $exists: false } }, { clientId: null }] },
        [
          { $set: { clientId: '$patientId' } },
          { $unset: 'patientId' },
        ]
      );
      if (baseResult.modifiedCount > 0) {
        console.log(`[Migration] medicalbaselines: migrated ${baseResult.modifiedCount} document(s) patientId → clientId`);
      }

      // 9. fraudabuseanalyses: patientId → clientId
      const fraudResult = await db.collection('fraudabuseanalyses').updateMany(
        { patientId: { $exists: true }, $or: [{ clientId: { $exists: false } }, { clientId: null }] },
        [
          { $set: { clientId: '$patientId' } },
          { $unset: 'patientId' },
        ]
      );
      if (fraudResult.modifiedCount > 0) {
        console.log(`[Migration] fraudabuseanalyses: migrated ${fraudResult.modifiedCount} document(s) patientId → clientId`);
      }

      // 10. lineitems: patientId → clientId (Mongoose model LineItem → collection 'lineitems')
      const lineResult = await db.collection('lineitems').updateMany(
        { patientId: { $exists: true }, $or: [{ clientId: { $exists: false } }, { clientId: null }] },
        [
          { $set: { clientId: '$patientId' } },
          { $unset: 'patientId' },
        ]
      );
      if (lineResult.modifiedCount > 0) {
        console.log(`[Migration] lineitems: migrated ${lineResult.modifiedCount} document(s) patientId → clientId`);
      }

      // 11. reports: patientId → clientId (if collection exists and has patientId)
      try {
        const reportResult = await db.collection('reports').updateMany(
          { patientId: { $exists: true }, $or: [{ clientId: { $exists: false } }, { clientId: null }] },
          [
            { $set: { clientId: '$patientId' } },
            { $unset: 'patientId' },
          ]
        );
        if (reportResult.modifiedCount > 0) {
          console.log(`[Migration] reports: migrated ${reportResult.modifiedCount} document(s) patientId → clientId`);
        }
      } catch (e) {
        // Collection might not exist
      }

      console.log('[Migration] patient_id → client_id migration completed.');
    } catch (err) {
      console.error('[Migration] patient_id → client_id failed:', err);
      throw err;
    }
  },

  async down(db, client) {
    // Rollback: clientId → patientId (and client → patient, etc.) for documents that have clientId
    // We do not run this by default so we don't overwrite data; document for manual rollback if needed.
    console.log('[Migration] Down: patient_id migration does not auto-rollback to avoid data loss.');
    console.log('[Migration] To restore legacy fields, restore from backup or run a custom script.');
  },
};
