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
const { Client, Caregiver, Org, Schedule } = require('../src/models');
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
    const patientsWithoutOrg = await Client.find({
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
            logger.info(`[Migration] ✅ Updated client ${client._id} (${client.name}) with org ${orgExists.name}`);
          } else {
            logger.warn(`[Migration] ⚠️  Org ${orgToAssign} not found for client ${client._id}`);
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
          logger.warn(`[Migration] ⚠️  Client ${client._id} (${client.name}) has no org and no caregivers with orgs - needs manual assignment`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`[Migration] ❌ Error processing client ${client._id}: ${error.message}`, error);
        patientsNeedingManualReview.push({
          clientId: client._id,
          clientName: client.name,
          reason: `Error: ${error.message}`,
        });
      }
    }

    // Summary
    logger.info('[Migration] 📊 Migration Summary:');
    logger.info(`[Migration]    ✅ Updated: ${updatedCount} client(s)`);
    logger.info(`[Migration]    ⚠️  Skipped (needs manual review): ${skippedCount} client(s)`);
    logger.info(`[Migration]    ❌ Errors: ${errorCount} client(s)`);

    // Report clients needing manual review
    if (patientsNeedingManualReview.length > 0) {
      logger.warn('[Migration] ⚠️  Clients requiring manual org assignment:');
      patientsNeedingManualReview.forEach((p) => {
        logger.warn(`[Migration]    - ${p.clientName} (${p.clientId}): ${p.reason}`);
        if (p.email) {
          logger.warn(`[Migration]      Email: ${p.email}`);
        }
        if (p.caregiversCount !== undefined) {
          logger.warn(`[Migration]      Caregivers: ${p.caregiversCount}`);
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

