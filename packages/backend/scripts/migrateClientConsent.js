/**
 * Migrate legacy client `consented` boolean to GDPR per-purpose consent model.
 *
 * Run from packages/backend:
 *   node scripts/migrateClientConsent.js
 *
 * Idempotent — safe to run multiple times.
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Client, Org, ConsentRecord } = require('../src/models');
const logger = require('../src/config/logger');
const { migrateClientConsent } = require('../src/scripts/migrateClientConsent.lib');

async function run() {
  try {
    logger.info('[migrateClientConsent] Connecting to database...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('[migrateClientConsent] Connected');

    const result = await migrateClientConsent({ Client, Org, ConsentRecord, logger });

    if (result.failures.length > 0) {
      logger.warn(`[migrateClientConsent] ${result.failures.length} failure(s):`);
      result.failures.forEach(({ clientId, error }) => {
        logger.warn(`  - ${clientId}: ${error}`);
      });
    }

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    logger.error('[migrateClientConsent] Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('[migrateClientConsent] Database connection closed');
  }
}

if (require.main === module) {
  run();
}

module.exports = { run, migrateClientConsent };
