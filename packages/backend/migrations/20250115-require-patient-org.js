/**
 * Migration: Require Patient Org
 * 
 * This migration assigns organizations to patients that don't have one.
 * This is required before making the `org` field required in the Patient model.
 * 
 * Created: 2025-01-15
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Patient, Caregiver, Org, Schedule } = require('../src/models');
const logger = require('../src/config/logger');

module.exports = {
  /**
   * Up migration: Assign orgs to patients without one
   */
  async up(db, client) {
    logger.info('[Migration] Starting: Require Patient Org');
    
    // Connect Mongoose to use models (migrate-mongo uses native driver)
    // We'll connect to the same database that migrate-mongo is using
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('[Migration] Connected Mongoose');
    }
    
    // Find all patients without an org
    const patientsWithoutOrg = await Patient.find({
      $or: [
        { org: { $exists: false } },
        { org: null },
      ],
    }).populate('caregivers');

    logger.info(`[Migration] Found ${patientsWithoutOrg.length} patient(s) without an org assigned`);

    if (patientsWithoutOrg.length === 0) {
      logger.info('[Migration] ✅ All patients already have orgs assigned');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const patientsNeedingManualReview = [];

    for (const patient of patientsWithoutOrg) {
      try {
        let orgToAssign = null;

        // Strategy 1: Get org from patient's caregivers
        if (patient.caregivers && patient.caregivers.length > 0) {
          // Populate caregivers if they're not already populated
          const caregivers = patient.caregivers.map(cg => 
            cg._id ? cg : null
          ).filter(Boolean);

          if (caregivers.length > 0) {
            // Fetch caregivers with org info
            const caregiverDocs = await Caregiver.find({
              _id: { $in: caregivers.map(cg => cg._id || cg) }
            }).select('org');

            // Find first caregiver with an org
            for (const caregiver of caregiverDocs) {
              if (caregiver.org) {
                orgToAssign = caregiver.org;
                break;
              }
            }
          }
        }

        // Strategy 2: If still no org, try to find org from patient's schedules
        if (!orgToAssign && patient.schedules && patient.schedules.length > 0) {
          const schedule = await Schedule.findById(patient.schedules[0])
            .populate('patient.org');
          
          if (schedule && schedule.patient && schedule.patient.org) {
            orgToAssign = schedule.patient.org;
          }
        }

        if (orgToAssign) {
          // Verify org exists
          const orgExists = await Org.findById(orgToAssign);
          if (orgExists) {
            patient.org = orgToAssign;
            await patient.save();
            updatedCount++;
            logger.info(`[Migration] ✅ Updated patient ${patient._id} (${patient.name}) with org ${orgExists.name}`);
          } else {
            logger.warn(`[Migration] ⚠️  Org ${orgToAssign} not found for patient ${patient._id}`);
            patientsNeedingManualReview.push({
              patientId: patient._id,
              patientName: patient.name,
              reason: `Org ${orgToAssign} not found in database`,
            });
            errorCount++;
          }
        } else {
          // No org found - needs manual review
          patientsNeedingManualReview.push({
            patientId: patient._id,
            patientName: patient.name,
            email: patient.email,
            caregiversCount: patient.caregivers?.length || 0,
            reason: 'No caregivers with orgs found',
          });
          skippedCount++;
          logger.warn(`[Migration] ⚠️  Patient ${patient._id} (${patient.name}) has no org and no caregivers with orgs - needs manual assignment`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`[Migration] ❌ Error processing patient ${patient._id}: ${error.message}`, error);
        patientsNeedingManualReview.push({
          patientId: patient._id,
          patientName: patient.name,
          reason: `Error: ${error.message}`,
        });
      }
    }

    // Summary
    logger.info('[Migration] 📊 Migration Summary:');
    logger.info(`[Migration]    ✅ Updated: ${updatedCount} patient(s)`);
    logger.info(`[Migration]    ⚠️  Skipped (needs manual review): ${skippedCount} patient(s)`);
    logger.info(`[Migration]    ❌ Errors: ${errorCount} patient(s)`);

    // Report patients needing manual review
    if (patientsNeedingManualReview.length > 0) {
      logger.warn('[Migration] ⚠️  Patients requiring manual org assignment:');
      patientsNeedingManualReview.forEach((p) => {
        logger.warn(`[Migration]    - ${p.patientName} (${p.patientId}): ${p.reason}`);
        if (p.email) {
          logger.warn(`[Migration]      Email: ${p.email}`);
        }
        if (p.caregiversCount !== undefined) {
          logger.warn(`[Migration]      Caregivers: ${p.caregiversCount}`);
        }
      });
    }

    // Verify migration
    const remainingPatientsWithoutOrg = await Patient.find({
      $or: [
        { org: { $exists: false } },
        { org: null },
      ],
    });

    if (remainingPatientsWithoutOrg.length > 0) {
      logger.warn(`[Migration] ⚠️  Warning: ${remainingPatientsWithoutOrg.length} patient(s) still without org after migration`);
      logger.warn('[Migration]    These patients need manual org assignment');
      // Don't throw - allow migration to complete, but log warning
    } else {
      logger.info('[Migration] ✅ All patients now have orgs assigned');
    }

    logger.info('[Migration] Completed: Require Patient Org');
    
    // Note: We don't disconnect Mongoose here as it may be used by other migrations
    // or the migrate-mongo process itself
  },

  /**
   * Down migration: Make org optional again (for rollback)
   * 
   * Note: This doesn't remove orgs from patients, just allows the field to be optional.
   * The actual model change needs to be reverted in code.
   */
  async down(db, client) {
    logger.info('[Migration] Rolling back: Require Patient Org');
    
    // Connect Mongoose if needed
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('[Migration] Connected Mongoose');
    }
    
    logger.info('[Migration] Note: This migration does not remove orgs from patients.');
    logger.info('[Migration] To fully rollback, revert the Patient model changes (make org optional).');
    logger.info('[Migration] Rollback completed.');
  },
};

