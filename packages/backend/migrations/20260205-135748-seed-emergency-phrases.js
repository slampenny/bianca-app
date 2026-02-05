/**
 * Migration: Seed Emergency Phrases
 * 
 * This migration seeds/updates emergency phrases on every deployment.
 * Emergency phrases should be dropped and recreated to allow adding new phrases.
 * 
 * This migration runs idempotently - it can be run multiple times safely.
 * It will always update the emergency phrases to the latest version from the seeder.
 * 
 * Created: 2026-02-05
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { EmergencyPhrase } = require('../src/models');
const emergencyPhrasesSeeder = require('../src/scripts/seeders/emergencyPhrases.seeder');
const logger = require('../src/config/logger');

module.exports = {
  /**
   * Up migration: Seed emergency phrases
   * This runs on every deployment to ensure phrases are up-to-date
   */
  async up(db, client) {
    logger.info('[Migration] Starting: Seed Emergency Phrases');
    
    // Connect Mongoose to use models (migrate-mongo uses native driver)
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('[Migration] Connected Mongoose');
    }
    
    try {
      // Check existing count
      const existingCount = await EmergencyPhrase.countDocuments();
      logger.info(`[Migration] Found ${existingCount} existing emergency phrases`);

      // Delete existing phrases to allow re-seeding with latest version
      if (existingCount > 0) {
        logger.info('[Migration] Deleting existing emergency phrases...');
        await EmergencyPhrase.deleteMany({});
        logger.info('[Migration] ✅ Deleted existing phrases');
      }

      // Seed emergency phrases using the seeder
      logger.info('[Migration] Seeding emergency phrases...');
      await emergencyPhrasesSeeder.seedEmergencyPhrases();

      // Verify the seed
      const newCount = await EmergencyPhrase.countDocuments();
      logger.info(`[Migration] ✅ Seeded ${newCount} emergency phrases`);

      // Show breakdown by language
      const byLanguage = await EmergencyPhrase.aggregate([
        {
          $group: {
            _id: '$language',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      logger.info('[Migration] 📋 Breakdown by language:');
      byLanguage.forEach(({ _id: lang, count }) => {
        logger.info(`[Migration]    - ${lang}: ${count} phrases`);
      });

      // Show breakdown by severity
      const bySeverity = await EmergencyPhrase.aggregate([
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      logger.info('[Migration] 📋 Breakdown by severity:');
      bySeverity.forEach(({ _id: severity, count }) => {
        logger.info(`[Migration]    - ${severity}: ${count} phrases`);
      });

      logger.info('[Migration] Completed: Seed Emergency Phrases');
    } catch (error) {
      logger.error('[Migration] ❌ Error seeding emergency phrases:', error);
      throw error; // Re-throw to mark migration as failed
    }
  },

  /**
   * Down migration: Remove emergency phrases
   * This is provided for rollback, but note that emergency phrases are critical
   * for the emergency detection system to work.
   */
  async down(db, client) {
    logger.warn('[Migration] Down migration: Removing emergency phrases');
    logger.warn('[Migration] ⚠️  WARNING: This will disable emergency detection until phrases are re-seeded!');
    
    // Connect Mongoose to use models
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('[Migration] Connected Mongoose');
    }
    
    // Delete all emergency phrases
    const deleteResult = await EmergencyPhrase.deleteMany({});
    logger.info(`[Migration] Deleted ${deleteResult.deletedCount} emergency phrases`);
    logger.warn('[Migration] ⚠️  Emergency detection is now DISABLED until phrases are re-seeded!');
  },
};
