// agenda.js
const Agenda = require('agenda');
const config = require('./config');
const logger = require('./logger');
const Schedule = require('../models/schedule.model');
const { patientService, twilioCallService, alertService } = require('../services');
const { moment } = require('moment');

const agenda = new Agenda({db: {address: config.mongoose.url}});

async function runSchedules() {
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
  
      const patient = await patientService.getPatientById(schedule.patient);
      try {
          twilioCallService.initiateCall(schedule.patient);
          
          await alertService.createAlert({
            message: `Called ${patient.name} for their scheduled check-in at ${now.toISOString()}`,
            importance: 'low', // Set importance to 'low'
            createdBy: schedule.id,
            createdModel: 'Schedule',
            visibility: 'assignedCaregivers',
            relevanceUntil: moment().add(1, 'week').toISOString(),
          });
  
          // Update the nextCallDate based on the frequency and interval
          schedule.calculateNextCallDate();
  
          // Save the updated schedule
          await schedule.save();
      } catch (error) {
        logger.error(`Error running schedule ${schedule.id}: ${error}`);
  
        const alert = await alertService.createAlert({
          message: `Call to ${patient.name} for their scheduled check-in at ${now.toISOString()} generated an error: ${error}`,
          importance: 'high', // Set importance to 'low'
          createdBy: schedule.id,
          createdModel: 'Schedule',
          visibility: 'allCaregivers',
          relevanceUntil: moment().add(1, 'week'),
        });
      }
    }
  
}

// Define your centralized job
agenda.define('runSchedules', { concurrency: 1, lockLifetime: 600000 }, async (job, done) => {
  await runSchedules();
  done();
});

// Schedule your centralized job to run every hour
agenda.every('1 hour', 'runSchedules');

// Start the Agenda instance
agenda.start();

module.exports = agenda;