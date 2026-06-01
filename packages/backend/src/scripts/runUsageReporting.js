// src/scripts/runUsageReporting.js
const mongoose = require('mongoose');
const config = require('../config/config');
const { processUsageReporting } = require('../config/agenda');
const logger = require('../config/logger');

(async () => {
  try {
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');

    console.log('Manually running Stripe usage reporting...');
    await processUsageReporting();
    console.log('Stripe usage reporting completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error running Stripe usage reporting:', error);
    process.exit(1);
  }
})();
