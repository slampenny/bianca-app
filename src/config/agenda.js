// agenda.js
const Agenda = require('agenda');
const config = require('./config');
const logger = require('./logger');
const Schedule = require('../models/schedule.model');
const { twilioCallService } = require('../services');

const agenda = new Agenda({db: {address: config.mongoose.url}});

// Define your centralized job
agenda.define('runSchedules', async (job, done) => {
  // Get the current date
  const now = new Date();

  // Get all active schedules that need to be run
  const schedules = await Schedule.find({
    isActive: true,
    nextCallDate: { $lte: now }
  });

  for (const schedule of schedules) {
    // Check if the schedule should run based on the intervals field
    const interval = schedule.intervals.find(i => i.day === (schedule.frequency === 'weekly' ? now.getDay() : now.getDate()));
    if (!interval) {
      continue;
    }

    // Run each schedule
    // This could be a function call, a request to another service, etc.
    logger.info(`Running schedule ${schedule.id}`);

    // Update the nextCallDate based on the frequency and interval
    schedule.calculateNextCallDate();

    //TODO: initiate a call here
    twilioCallService.initiateCall(schedule.userId);

    // Save the updated schedule
    await schedule.save();
  }

  done();
});

// Schedule your centralized job to run every hour
agenda.every('1 hour', 'runSchedules');

// Start the Agenda instance
agenda.start();

module.exports = agenda;