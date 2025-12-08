// src/scripts/runSchedules.js
const mongoose = require('mongoose');
const config = require('../config/config');
const { runSchedules } = require('../config/agenda');
const logger = require('../config/logger');

(async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');

    console.log('Manually running schedules...');
    await runSchedules();
    console.log('Schedules ran successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error running schedules:', error);
    process.exit(1);
  }
})();
