/**
 * Migration script to assign orgs to patients that don't have one
 * 
 * This script:
 * 1. Finds all patients without an org assigned
 * 2. Attempts to assign org from their caregivers (if they have any)
 * 3. Reports patients that cannot be assigned (no caregivers or caregivers without orgs)
 * 
 * Run with: node scripts/migrate-patient-orgs.js
 * 
 * For staging/production:
 *   NODE_ENV=staging node scripts/migrate-patient-orgs.js
 *   NODE_ENV=production node scripts/migrate-patient-orgs.js
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Patient, Caregiver, Org, Schedule } = require('../src/models');
const logger = require('../src/config/logger');

async function migratePatientOrgs() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to database');

    // Find all patients without an org
    const patientsWithoutOrg = await Patient.find({
      $or: [
        { org: { $exists: false } },
        { org: null },
      ],
    }).populate('caregivers');

    logger.info(`Found ${patientsWithoutOrg.length} patient(s) without an org assigned`);

    if (patientsWithoutOrg.length === 0) {
      logger.info('✅ All patients already have orgs assigned');
      process.exit(0);
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
            logger.info(`✅ Updated patient ${patient._id} (${patient.name}) with org ${orgExists.name}`);
          } else {
            logger.warn(`⚠️  Org ${orgToAssign} not found for patient ${patient._id}`);
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
          logger.warn(`⚠️  Patient ${patient._id} (${patient.name}) has no org and no caregivers with orgs - needs manual assignment`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`❌ Error processing patient ${patient._id}: ${error.message}`, error);
        patientsNeedingManualReview.push({
          patientId: patient._id,
          patientName: patient.name,
          reason: `Error: ${error.message}`,
        });
      }
    }

    // Summary
    logger.info('\n📊 Migration Summary:');
    logger.info(`   ✅ Updated: ${updatedCount} patient(s)`);
    logger.info(`   ⚠️  Skipped (needs manual review): ${skippedCount} patient(s)`);
    logger.info(`   ❌ Errors: ${errorCount} patient(s)`);

    // Report patients needing manual review
    if (patientsNeedingManualReview.length > 0) {
      logger.warn('\n⚠️  Patients requiring manual org assignment:');
      patientsNeedingManualReview.forEach((p) => {
        logger.warn(`   - ${p.patientName} (${p.patientId}): ${p.reason}`);
        if (p.email) {
          logger.warn(`     Email: ${p.email}`);
        }
        if (p.caregiversCount !== undefined) {
          logger.warn(`     Caregivers: ${p.caregiversCount}`);
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
      logger.warn(`\n⚠️  Warning: ${remainingPatientsWithoutOrg.length} patient(s) still without org after migration`);
      logger.warn('   These patients need manual org assignment');
    } else {
      logger.info('\n✅ All patients now have orgs assigned');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error during migration:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Database connection closed');
  }
}

// Run migration
migratePatientOrgs();

