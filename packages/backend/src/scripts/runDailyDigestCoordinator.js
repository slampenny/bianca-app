// src/scripts/runDailyDigestCoordinator.js
const mongoose = require('mongoose');
const config = require('../config/config');
const logger = require('../config/logger');
const { runDailyDigestCoordinatorTick } = require('../services/caregiverDailyDigestScheduler.service');

const parseArgs = (argv) => {
  const args = { dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dryRun') {
      args.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
};

(async () => {
  try {
    const args = parseArgs(process.argv);
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');

    const previousEnabled = config.dailyDigestScheduler.enabled;
    config.dailyDigestScheduler.enabled = true;

    console.log('Running Daily Wellness Digest coordinator tick (manual)...');
    const summary = await runDailyDigestCoordinatorTick({
      dryRun: Boolean(args.dryRun),
    });

    config.dailyDigestScheduler.enabled = previousEnabled;
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error running Daily Wellness Digest coordinator:', error);
    process.exit(1);
  }
})();
