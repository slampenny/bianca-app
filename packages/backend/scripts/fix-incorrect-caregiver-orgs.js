/**
 * Script to identify and fix caregivers that were incorrectly assigned to random orgs
 * 
 * This script identifies caregivers that:
 * 1. Are not in their org's caregivers array
 * 2. Have no patients in common with their assigned org
 * 3. Were likely assigned by the migration's "default org" strategy
 * 
 * Run with: node scripts/fix-incorrect-caregiver-orgs.js
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Caregiver, Org, Patient } = require('../src/models');
const logger = require('../src/config/logger');

async function findIncorrectlyAssignedCaregivers() {
  try {
    // Connect to database
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to database');

    // Find all caregivers
    const allCaregivers = await Caregiver.find({});
    logger.info(`Found ${allCaregivers.length} total caregivers`);

    const incorrectlyAssigned = [];
    const correctlyAssigned = [];

    for (const caregiver of allCaregivers) {
      if (!caregiver.org) {
        logger.warn(`Caregiver ${caregiver.email} (${caregiver.name}) has no org assigned`);
        continue;
      }

      const org = await Org.findById(caregiver.org);
      if (!org) {
        logger.error(`Caregiver ${caregiver.email} assigned to non-existent org: ${caregiver.org}`);
        incorrectlyAssigned.push({
          caregiver,
          reason: 'Assigned to non-existent org',
        });
        continue;
      }

      // Check if caregiver is in org's caregivers array
      const isInOrgArray = org.caregivers.some(c => c.toString() === caregiver._id.toString());
      
      // Check if caregiver has patients in this org
      const patientsInOrg = await Patient.find({
        caregivers: caregiver._id,
        org: caregiver.org,
      });

      // Determine if assignment is correct
      if (!isInOrgArray && patientsInOrg.length === 0) {
        // Caregiver is not in org's array and has no patients in this org
        // This suggests they were incorrectly assigned
        incorrectlyAssigned.push({
          caregiver,
          org,
          reason: 'Not in org caregivers array and has no patients in this org',
        });
      } else {
        correctlyAssigned.push({
          caregiver,
          org,
        });
      }
    }

    logger.info('\n=== INCORRECTLY ASSIGNED CAREGIVERS ===');
    logger.info(`Found ${incorrectlyAssigned.length} caregivers that may have been incorrectly assigned:`);
    
    incorrectlyAssigned.forEach(({ caregiver, reason }) => {
      logger.info(`\n- ${caregiver.email} (${caregiver.name})`);
      logger.info(`  Current Org: ${caregiver.org}`);
      logger.info(`  Reason: ${reason}`);
      logger.info(`  ID: ${caregiver._id}`);
    });

    logger.info('\n=== CORRECTLY ASSIGNED CAREGIVERS ===');
    logger.info(`Found ${correctlyAssigned.length} caregivers that appear to be correctly assigned:`);
    
    correctlyAssigned.forEach(({ caregiver, org }) => {
      logger.info(`\n- ${caregiver.email} (${caregiver.name}) -> ${org.name}`);
    });

    logger.info('\n=== SUMMARY ===');
    logger.info(`Total caregivers: ${allCaregivers.length}`);
    logger.info(`Correctly assigned: ${correctlyAssigned.length}`);
    logger.info(`Incorrectly assigned: ${incorrectlyAssigned.length}`);
    logger.info(`\n⚠️  Please manually review the incorrectly assigned caregivers and determine their correct orgs.`);

    await mongoose.disconnect();
    return { incorrectlyAssigned, correctlyAssigned };
  } catch (error) {
    logger.error('Error finding incorrectly assigned caregivers:', error);
    await mongoose.disconnect();
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  findIncorrectlyAssignedCaregivers()
    .then(() => {
      logger.info('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { findIncorrectlyAssignedCaregivers };

