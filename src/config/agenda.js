// agenda.js
const Agenda = require('agenda');
const config = require('./config');
const logger = require('./logger');
const Schedule = require('../models/schedule.model');
const { patientService, twilioCallService, alertService } = require('../services');
const moment = require('moment');

const agenda = new Agenda({
  db: {
    address: config.mongoose.url,
    collection: 'agendaJobs', // explicitly set a collection name
  }
});

// Listen for the 'ready' event to ensure the connection is established
agenda.on('ready', () => {
  logger.info('Agenda is connected and ready!');
  
  // Schedule your centralized job to run every hour
  agenda.every('1 hour', 'runSchedules');

  // Start processing jobs only after the connection is ready
  agenda.start();
});

// Centralized job definition with distributed locking settings
agenda.define('runSchedules', { concurrency: 1, lockLifetime: 600000 }, async (job, done) => {
  try {
    await runSchedules();
    done();
  } catch (error) {
    logger.error(`Error in runSchedules job: ${error}`);
    done(error);
  }
});

async function runSchedules() {
  const now = new Date();
  const schedules = await Schedule.find({
    isActive: true,
    nextCallDate: { $lte: now }
  });

  for (const schedule of schedules) {
    const interval = schedule.intervals.find(i => 
      i.day === (schedule.frequency === 'weekly' ? now.getDay() : now.getDate())
    );
    if (!interval) continue;

    logger.info(`Running schedule ${schedule.id}`);

    const patient = await patientService.getPatientById(schedule.patient);
    try {
      await twilioCallService.initiateCall(schedule.patient);
      
      await alertService.createAlert({
        message: `Called ${patient.name} for their scheduled check-in at ${now.toISOString()}`,
        importance: 'low',
        createdBy: schedule.id,
        createdModel: 'Schedule',
        visibility: 'assignedCaregivers',
        relevanceUntil: moment().add(1, 'week').toISOString(),
      });

      schedule.calculateNextCallDate();
      await schedule.save();
    } catch (error) {
      logger.error(`Error running schedule ${schedule.id}: ${error}`);
      await alertService.createAlert({
        message: `Call to ${patient.name} for their scheduled check-in at ${now.toISOString()} generated an error: ${error}`,
        importance: 'high',
        createdBy: schedule.id,
        createdModel: 'Schedule',
        visibility: 'allCaregivers',
        relevanceUntil: moment().add(1, 'week').toISOString(),
      });
    }
  }
}

module.exports = agenda;
