/**
 * Script to check a specific caregiver's org assignment
 * 
 * Usage: node scripts/check-caregiver-org.js <email>
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Caregiver, Org, Patient } = require('../src/models');
const logger = require('../src/config/logger');

async function checkCaregiverOrg(email) {
  try {
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to database');

    const caregiver = await Caregiver.findOne({ email });
    if (!caregiver) {
      logger.error(`Caregiver with email ${email} not found`);
      await mongoose.disconnect();
      return;
    }

    logger.info(`\n=== CAREGIVER INFO ===`);
    logger.info(`Name: ${caregiver.name}`);
    logger.info(`Email: ${caregiver.email}`);
    logger.info(`Role: ${caregiver.role}`);
    logger.info(`SSO Provider: ${caregiver.ssoProvider || 'None'}`);
    logger.info(`Created At: ${caregiver.createdAt}`);

    if (!caregiver.org) {
      logger.error(`\n❌ This caregiver has NO org assigned!`);
      await mongoose.disconnect();
      return;
    }

    const org = await Org.findById(caregiver.org);
    if (!org) {
      logger.error(`\n❌ Caregiver assigned to non-existent org: ${caregiver.org}`);
      await mongoose.disconnect();
      return;
    }

    logger.info(`\n=== ASSIGNED ORG ===`);
    logger.info(`Org Name: ${org.name}`);
    logger.info(`Org Email: ${org.email}`);
    logger.info(`Org ID: ${org._id}`);
    logger.info(`Created At: ${org.createdAt}`);

    // Check if caregiver is in org's caregivers array
    const isInOrgArray = org.caregivers.some(c => c.toString() === caregiver._id.toString());
    logger.info(`\n=== VERIFICATION ===`);
    logger.info(`Is in org.caregivers array: ${isInOrgArray ? '✅ YES' : '❌ NO'}`);

    // Check if caregiver has patients in this org
    const patientsInOrg = await Patient.find({
      caregivers: caregiver._id,
      org: caregiver.org,
    });
    logger.info(`Patients in this org: ${patientsInOrg.length}`);

    // Check if org was created around the same time as caregiver (suggests SSO creation)
    const timeDiff = Math.abs(caregiver.createdAt - org.createdAt);
    const timeDiffMinutes = Math.floor(timeDiff / 1000 / 60);
    logger.info(`Time difference between caregiver and org creation: ${timeDiffMinutes} minutes`);

    if (timeDiffMinutes < 5 && caregiver.ssoProvider) {
      logger.info(`\n✅ This looks like an SSO-created caregiver (org created ${timeDiffMinutes} minutes ${caregiver.createdAt > org.createdAt ? 'after' : 'before'} caregiver)`);
    }

    // Check if org name matches caregiver name pattern (SSO creates "{name}'s Organization")
    if (org.name.includes(caregiver.name) && caregiver.ssoProvider) {
      logger.info(`\n✅ Org name matches SSO pattern: "${org.name}" contains "${caregiver.name}"`);
    }

    logger.info(`\n=== CONCLUSION ===`);
    if (isInOrgArray && timeDiffMinutes < 5) {
      logger.info(`✅ This caregiver appears to be correctly assigned to their org`);
    } else if (!isInOrgArray) {
      logger.warn(`⚠️  WARNING: Caregiver is NOT in org's caregivers array - may have been incorrectly assigned`);
    } else if (timeDiffMinutes >= 5) {
      logger.warn(`⚠️  WARNING: Org was created ${timeDiffMinutes} minutes ${caregiver.createdAt > org.createdAt ? 'after' : 'before'} caregiver - may not be the original org`);
    }

    await mongoose.disconnect();
  } catch (error) {
    logger.error('Error checking caregiver org:', error);
    await mongoose.disconnect();
    throw error;
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  logger.error('Usage: node scripts/check-caregiver-org.js <email>');
  process.exit(1);
}

checkCaregiverOrg(email)
  .then(() => {
    logger.info('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });









