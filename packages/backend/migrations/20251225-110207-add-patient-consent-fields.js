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

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Patient, Org } = require('../src/models');
const logger = require('../src/config/logger');

module.exports = {
  /**
   * Up migration: Add consent fields
   */
  async up(db, client) {
    logger.info('[Migration] Starting: Add Patient Consent Fields');
    
    // Connect Mongoose to use models (migrate-mongo uses native driver)
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('[Migration] Connected Mongoose');
    }
    
    // Step 1: Add requirePatientConsent to all orgs (defaults to false)
    logger.info('[Migration] Adding requirePatientConsent field to organizations...');
    const orgUpdateResult = await db.collection('orgs').updateMany(
      { requirePatientConsent: { $exists: false } },
      { $set: { requirePatientConsent: false } }
    );
    logger.info(`[Migration] ✅ Updated ${orgUpdateResult.modifiedCount} organization(s) with requirePatientConsent: false`);
    
    // Step 2: Add consent fields to all patients
    logger.info('[Migration] Adding consent fields to patients...');
    const patients = await Patient.find({});
    logger.info(`[Migration] Found ${patients.length} patient(s) to update`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const patient of patients) {
      try {
        const updates = {};
        let needsUpdate = false;
        
        // Set consented to true if not already set
        if (patient.consented === undefined) {
          updates.consented = true;
          needsUpdate = true;
        }
        
        // Set consentedAt to createdAt if not already set
        if (!patient.consentedAt && patient.createdAt) {
          updates.consentedAt = patient.createdAt;
          needsUpdate = true;
        } else if (!patient.consentedAt) {
          // If no createdAt, use current date
          updates.consentedAt = new Date();
          needsUpdate = true;
        }
        
        // Set consentEmailVersion to '1.0' if not already set
        if (!patient.consentEmailVersion) {
          updates.consentEmailVersion = '1.0';
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await Patient.updateOne(
            { _id: patient._id },
            { $set: updates }
          );
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        logger.error(`[Migration] ❌ Error processing patient ${patient._id}: ${error.message}`, error);
      }
    }
    
    // Summary
    logger.info('[Migration] 📊 Migration Summary:');
    logger.info(`[Migration]    ✅ Updated: ${updatedCount} patient(s)`);
    logger.info(`[Migration]    ⏭️  Skipped (already had fields): ${skippedCount} patient(s)`);
    logger.info(`[Migration]    ❌ Errors: ${errorCount} patient(s)`);
    
    // Step 3: Remove unique index on patient email if it exists
    try {
      const indexes = await db.collection('patients').indexes();
      const emailIndex = indexes.find(idx => 
        idx.key && idx.key.email === 1 && idx.unique === true
      );
      
      if (emailIndex) {
        logger.info('[Migration] Removing unique index on patient email...');
        await db.collection('patients').dropIndex(emailIndex.name);
        logger.info('[Migration] ✅ Removed unique index on patient email');
      } else {
        logger.info('[Migration] No unique email index found on patients collection');
      }
    } catch (error) {
      // Index might not exist or might have a different name
      logger.warn(`[Migration] ⚠️  Could not remove email index (may not exist): ${error.message}`);
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
    
    // Connect Mongoose if needed
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('[Migration] Connected Mongoose');
    }
    
    // Remove requirePatientConsent from orgs
    logger.info('[Migration] Removing requirePatientConsent field from organizations...');
    const orgUpdateResult = await db.collection('orgs').updateMany(
      { requirePatientConsent: { $exists: true } },
      { $unset: { requirePatientConsent: '' } }
    );
    logger.info(`[Migration] ✅ Removed requirePatientConsent from ${orgUpdateResult.modifiedCount} organization(s)`);
    
    // Remove consent fields from patients
    logger.info('[Migration] Removing consent fields from patients...');
    const patientUpdateResult = await db.collection('patients').updateMany(
      {},
      { $unset: { consented: '', consentedAt: '', consentEmailVersion: '' } }
    );
    logger.info(`[Migration] ✅ Removed consent fields from ${patientUpdateResult.modifiedCount} patient(s)`);
    
    logger.info('[Migration] Note: Unique email index was not restored. To fully rollback, revert the Patient model changes.');
    logger.info('[Migration] Rollback completed.');
  },
};












