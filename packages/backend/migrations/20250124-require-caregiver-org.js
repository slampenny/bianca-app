/**
 * Migration: Require Caregiver Org
 * 
 * This migration assigns organizations to caregivers that don't have one.
 * This is required before making the `org` field required in the Caregiver model.
 * 
 * Created: 2025-01-24
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Caregiver, Org } = require('../src/models');
const logger = require('../src/config/logger');

module.exports = {
  /**
   * Up migration: Assign orgs to caregivers without one
   */
  async up(db, client) {
    logger.info('[Migration] Starting: Require Caregiver Org');
    
    // Connect Mongoose to use models (migrate-mongo uses native driver)
    // We'll connect to the same database that migrate-mongo is using
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('[Migration] Connected Mongoose');
    }
    
    // Find all caregivers without an org
    const caregiversWithoutOrg = await Caregiver.find({
      $or: [
        { org: { $exists: false } },
        { org: null },
      ],
    });

    logger.info(`[Migration] Found ${caregiversWithoutOrg.length} caregiver(s) without an org assigned`);

    if (caregiversWithoutOrg.length === 0) {
      logger.info('[Migration] ✅ All caregivers already have orgs assigned');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const caregiversNeedingManualReview = [];

    // Get all orgs to find a default one if needed
    const allOrgs = await Org.find({});
    
    if (allOrgs.length === 0) {
      logger.warn('[Migration] ⚠️  No organizations found in database. Cannot assign orgs to caregivers.');
      logger.warn('[Migration]    These caregivers need manual org assignment:');
      caregiversWithoutOrg.forEach(caregiver => {
        logger.warn(`[Migration]      - ${caregiver.email} (${caregiver.name})`);
      });
      return;
    }

    // Use the first org as default if no other logic can determine the org
    const defaultOrg = allOrgs[0];

    for (const caregiver of caregiversWithoutOrg) {
      try {
        let assignedOrg = null;

        // Strategy 1: Check if caregiver is in any org's caregivers array
        for (const org of allOrgs) {
          if (org.caregivers && org.caregivers.some(c => c.toString() === caregiver._id.toString())) {
            assignedOrg = org;
            break;
          }
        }

        // Strategy 2: If still no org, check if caregiver has clients with orgs
        if (!assignedOrg) {
          const { Client } = require('../src/models');
          const clientsWithOrg = await Client.find({
            caregivers: caregiver._id,
            org: { $exists: true, $ne: null },
          }).limit(1);

          if (clientsWithOrg.length > 0 && clientsWithOrg[0].org) {
            assignedOrg = await Org.findById(clientsWithOrg[0].org);
          }
        }

        // Strategy 3: If still no org, DO NOT assign to random org
        // This caregiver needs manual review - they should not be assigned to a random org
        if (!assignedOrg) {
          logger.error(`[Migration] ❌ Caregiver ${caregiver.email} (${caregiver.name}) has no clear org association. NOT assigning to random org. This caregiver needs manual review.`);
          caregiversNeedingManualReview.push({
            id: caregiver._id,
            email: caregiver.email,
            name: caregiver.name,
          });
          skippedCount++;
          continue; // Skip this caregiver - don't assign to random org
        }

        if (assignedOrg) {
          caregiver.org = assignedOrg._id;
          await caregiver.save();
          
          // Ensure caregiver is in org's caregivers array
          if (!assignedOrg.caregivers.some(c => c.toString() === caregiver._id.toString())) {
            assignedOrg.caregivers.push(caregiver._id);
            await assignedOrg.save();
          }
          
          logger.info(`[Migration] ✅ Updated caregiver=[ID_REDACTED] (${caregiver.name}) with org ${assignedOrg.name}`);
          updatedCount++;
        } else {
          caregiversNeedingManualReview.push({
            id: caregiver._id,
            email: caregiver.email,
            name: caregiver.name,
          });
          skippedCount++;
        }
      } catch (error) {
        logger.error(`[Migration] ❌ Error updating caregiver ${caregiver.email}:`, error);
        errorCount++;
      }
    }

    logger.info('[Migration] 📊 Migration Summary:');
    logger.info(`[Migration]    ✅ Updated: ${updatedCount} caregiver(s)`);
    logger.info(`[Migration]    ⚠️  Skipped (needs manual review): ${skippedCount} caregiver(s)`);
    logger.info(`[Migration]    ❌ Errors: ${errorCount} caregiver(s)`);

    // Check if there are still caregivers without orgs
    const remainingCaregiversWithoutOrg = await Caregiver.find({
      $or: [
        { org: { $exists: false } },
        { org: null },
      ],
    });

    if (remainingCaregiversWithoutOrg.length > 0) {
      logger.warn(`[Migration] ⚠️  Warning: ${remainingCaregiversWithoutOrg.length} caregiver(s) still without org after migration`);
      logger.warn('[Migration]    These caregivers need manual org assignment');
      remainingCaregiversWithoutOrg.forEach(caregiver => {
        logger.warn(`[Migration]      - ${caregiver.email} (${caregiver.name})`);
      });
    }

    logger.info('[Migration] Completed: Require Caregiver Org');
  },

  /**
   * Down migration: Remove org requirement (not recommended, but provided for rollback)
   */
  async down(db, client) {
    logger.warn('[Migration] Down migration: This would remove org requirement from caregivers');
    logger.warn('[Migration] This is not recommended as it violates business rules');
    // No-op: We don't want to remove orgs from caregivers
  },
};

