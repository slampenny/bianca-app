/**
 * Migration script to backfill callRetrySettings for existing orgs
 * 
 * This script ensures all existing orgs have the default retry settings:
 * - retryCount: 2
 * - retryIntervalMinutes: 15
 * - alertOnAllMissedCalls: true
 * 
 * Run with: node scripts/migrate-org-retry-settings.js
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Org } = require('../src/models');
const logger = require('../src/config/logger');

const defaultRetrySettings = {
  retryCount: 2,
  retryIntervalMinutes: 15,
  alertOnAllMissedCalls: true,
};

async function migrateOrgRetrySettings() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to database');

    // Find all orgs that need migration
    const orgs = await Org.find({
      $or: [
        { callRetrySettings: { $exists: false } },
        { 'callRetrySettings.retryCount': { $exists: false } },
        { 'callRetrySettings.retryIntervalMinutes': { $exists: false } },
        { 'callRetrySettings.alertOnAllMissedCalls': { $exists: false } },
      ],
    });

    logger.info(`Found ${orgs.length} org(s) that need retry settings migration`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const org of orgs) {
      let needsUpdate = false;
      const currentSettings = org.callRetrySettings || {};

      // Check and set retryCount
      if (currentSettings.retryCount === undefined || currentSettings.retryCount === null) {
        org.callRetrySettings = org.callRetrySettings || {};
        org.callRetrySettings.retryCount = defaultRetrySettings.retryCount;
        needsUpdate = true;
      }

      // Check and set retryIntervalMinutes
      if (currentSettings.retryIntervalMinutes === undefined || currentSettings.retryIntervalMinutes === null) {
        org.callRetrySettings = org.callRetrySettings || {};
        org.callRetrySettings.retryIntervalMinutes = defaultRetrySettings.retryIntervalMinutes;
        needsUpdate = true;
      }

      // Check and set alertOnAllMissedCalls
      if (currentSettings.alertOnAllMissedCalls === undefined || currentSettings.alertOnAllMissedCalls === null) {
        org.callRetrySettings = org.callRetrySettings || {};
        org.callRetrySettings.alertOnAllMissedCalls = defaultRetrySettings.alertOnAllMissedCalls;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await org.save();
        updatedCount++;
        logger.info(`Updated org ${org._id} (${org.name}) with default retry settings`);
      } else {
        skippedCount++;
        logger.info(`Skipped org ${org._id} (${org.name}) - already has all settings`);
      }
    }

    logger.info(`Migration complete: ${updatedCount} org(s) updated, ${skippedCount} org(s) skipped`);

    // Verify migration
    const orgsWithoutSettings = await Org.find({
      $or: [
        { callRetrySettings: { $exists: false } },
        { 'callRetrySettings.retryCount': { $exists: false } },
        { 'callRetrySettings.retryIntervalMinutes': { $exists: false } },
        { 'callRetrySettings.alertOnAllMissedCalls': { $exists: false } },
      ],
    });

    if (orgsWithoutSettings.length > 0) {
      logger.warn(`Warning: ${orgsWithoutSettings.length} org(s) still missing retry settings after migration`);
    } else {
      logger.info('✅ All orgs now have retry settings configured');
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
migrateOrgRetrySettings();

