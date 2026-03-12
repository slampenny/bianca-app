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
const { Client, Caregiver, Org, Schedule } = require('../src/models');
const logger = require('../src/config/logger');

async function migratePatientOrgs() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to database');

    // Find all patients without an org
    const patientsWithoutOrg = await Client.find({
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

    for (const client of patientsWithoutOrg) {
      try {
        let orgToAssign = null;

        // Strategy 1: Get org from client's caregivers
        if (client.caregivers && client.caregivers.length > 0) {
          // Populate caregivers if they're not already populated
          const caregivers = client.caregivers.map(cg => 
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

        // Strategy 2: If still no org, try to find org from client's schedules
        if (!orgToAssign && client.schedules && client.schedules.length > 0) {
          const schedule = await Schedule.findById(client.schedules[0])
            .populate('client.org');
          
          if (schedule && schedule.client && schedule.client.org) {
            orgToAssign = schedule.client.org;
          }
        }

        if (orgToAssign) {
          // Verify org exists
          const orgExists = await Org.findById(orgToAssign);
          if (orgExists) {
            client.org = orgToAssign;
            await client.save();
            updatedCount++;
            logger.info(`✅ Updated client ${client._id} (${client.name}) with org ${orgExists.name}`);
          } else {
            logger.warn(`⚠️  Org ${orgToAssign} not found for client ${client._id}`);
            patientsNeedingManualReview.push({
              clientId: client._id,
              clientName: client.name,
              reason: `Org ${orgToAssign} not found in database`,
            });
            errorCount++;
          }
        } else {
          // No org found - needs manual review
          patientsNeedingManualReview.push({
            clientId: client._id,
            clientName: client.name,
            email: client.email,
            caregiversCount: client.caregivers?.length || 0,
            reason: 'No caregivers with orgs found',
          });
          skippedCount++;
          logger.warn(`⚠️  Client ${client._id} (${client.name}) has no org and no caregivers with orgs - needs manual assignment`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`❌ Error processing client ${client._id}: ${error.message}`, error);
        patientsNeedingManualReview.push({
          clientId: client._id,
          clientName: client.name,
          reason: `Error: ${error.message}`,
        });
      }
    }

    // Summary
    logger.info('\n📊 Migration Summary:');
    logger.info(`   ✅ Updated: ${updatedCount} client(s)`);
    logger.info(`   ⚠️  Skipped (needs manual review): ${skippedCount} client(s)`);
    logger.info(`   ❌ Errors: ${errorCount} client(s)`);

    // Report clients needing manual review
    if (patientsNeedingManualReview.length > 0) {
      logger.warn('\n⚠️  Clients requiring manual org assignment:');
      patientsNeedingManualReview.forEach((p) => {
        logger.warn(`   - ${p.clientName} (${p.clientId}): ${p.reason}`);
        if (p.email) {
          logger.warn(`     Email: ${p.email}`);
        }
        if (p.caregiversCount !== undefined) {
          logger.warn(`     Caregivers: ${p.caregiversCount}`);
        }
      });
    }

    // Verify migration
    const remainingPatientsWithoutOrg = await Client.find({
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

