// src/scripts/runDailyBilling.js
const mongoose = require('mongoose');
const config = require('../config/config');
const { processDailyBilling } = require('../config/agenda');
const logger = require('../config/logger');

(async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');

    console.log('Manually running daily billing process...');
    await processDailyBilling();
    console.log('Daily billing process completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error running daily billing:', error);
    process.exit(1);
  }
})();
