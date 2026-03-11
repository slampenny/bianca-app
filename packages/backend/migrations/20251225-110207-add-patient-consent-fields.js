/**
 * Migration: Add Patient Consent Fields
 * 
 * This migration:
 * 1. Adds `requirePatientConsent` field to all organizations (defaults to false)
 * 2. Adds `consented`, `consentedAt`, and `consentEmailVersion` fields to all patients
 * 3. Sets existing patients to consented: true with appropriate timestamps
 * 
 * Created: 2025-12-25
 */

const logger = require('../src/config/logger');

// Use native driver only (no Mongoose models) so this runs regardless of Patient/Client in app

module.exports = {
  /**
   * Up migration: Add consent fields
   */
  async up(db, client) {
    logger.info('[Migration] Starting: Add Patient Consent Fields');
    
    // Step 1: Add requirePatientConsent to all orgs (defaults to false)
    logger.info('[Migration] Adding requirePatientConsent field to organizations...');
    const orgUpdateResult = await db.collection('orgs').updateMany(
      { requirePatientConsent: { $exists: false } },
      { $set: { requirePatientConsent: false } }
    );
    logger.info(`[Migration] ✅ Updated ${orgUpdateResult.modifiedCount} organization(s) with requirePatientConsent: false`);
    
    // Step 2: Add consent fields using native driver (patients and clients collections)
    const collections = ['patients', 'clients'];
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const collName of collections) {
      const coll = db.collection(collName);
      try {
        const cursor = coll.find({});
        const docs = await cursor.toArray();
        logger.info(`[Migration] Adding consent fields to ${collName}: ${docs.length} document(s)`);
        for (const doc of docs) {
          try {
            const updates = {};
            let needsUpdate = false;
            if (doc.consented === undefined) {
              updates.consented = true;
              needsUpdate = true;
            }
            if (!doc.consentedAt && doc.createdAt) {
              updates.consentedAt = doc.createdAt;
              needsUpdate = true;
            } else if (!doc.consentedAt) {
              updates.consentedAt = new Date();
              needsUpdate = true;
            }
            if (!doc.consentEmailVersion) {
              updates.consentEmailVersion = '1.0';
              needsUpdate = true;
            }
            if (needsUpdate) {
              await coll.updateOne({ _id: doc._id }, { $set: updates });
              totalUpdated++;
            } else {
              totalSkipped++;
            }
          } catch (error) {
            totalErrors++;
            logger.error(`[Migration] ❌ Error processing ${collName} ${doc._id}: ${error.message}`, error);
          }
        }
      } catch (err) {
        if (err.codeName === 'NamespaceNotFound' || err.message && err.message.includes('does not exist')) {
          logger.info(`[Migration] Collection ${collName} does not exist, skipping`);
        } else {
          throw err;
        }
      }
    }
    
    logger.info('[Migration] 📊 Migration Summary:');
    logger.info(`[Migration]    ✅ Updated: ${totalUpdated}`);
    logger.info(`[Migration]    ⏭️  Skipped (already had fields): ${totalSkipped}`);
    logger.info(`[Migration]    ❌ Errors: ${totalErrors}`);
    
    // Step 3: Remove unique index on email if it exists (patients or clients)
    for (const collName of ['patients', 'clients']) {
      try {
        const indexes = await db.collection(collName).indexes();
        const emailIndex = indexes.find(idx =>
          idx.key && idx.key.email === 1 && idx.unique === true
        );
        if (emailIndex) {
          logger.info(`[Migration] Removing unique index on ${collName} email...`);
          await db.collection(collName).dropIndex(emailIndex.name);
          logger.info(`[Migration] ✅ Removed unique index on ${collName} email`);
        }
      } catch (error) {
        if (error.codeName === 'NamespaceNotFound' || (error.message && error.message.includes('does not exist'))) {
          // collection doesn't exist
        } else {
          logger.warn(`[Migration] ⚠️  Could not remove email index on ${collName} (may not exist): ${error.message}`);
        }
      }
    }
    
    logger.info('[Migration] Completed: Add Patient Consent Fields');
  },

  /**
   * Down migration: Remove consent fields (for rollback)
   * 
   * Note: This removes the fields but doesn't restore the unique email constraint.
   * The actual model changes need to be reverted in code.
   */
  async down(db, client) {
    logger.info('[Migration] Rolling back: Add Patient Consent Fields');
    
    const orgUpdateResult = await db.collection('orgs').updateMany(
      { requirePatientConsent: { $exists: true } },
      { $unset: { requirePatientConsent: '' } }
    );
    logger.info(`[Migration] ✅ Removed requirePatientConsent from ${orgUpdateResult.modifiedCount} organization(s)`);
    
    for (const collName of ['patients', 'clients']) {
      try {
        const r = await db.collection(collName).updateMany(
          {},
          { $unset: { consented: '', consentedAt: '', consentEmailVersion: '' } }
        );
        logger.info(`[Migration] ✅ Removed consent fields from ${r.modifiedCount} ${collName}`);
      } catch (err) {
        if (err.codeName !== 'NamespaceNotFound') logger.warn(`[Migration] ${collName}: ${err.message}`);
      }
    }
    logger.info('[Migration] Rollback completed.');
  },
};


















