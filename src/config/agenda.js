// agenda.js
const Agenda = require('agenda');
const moment = require('moment');
const config = require('./config');
const logger = require('./logger');
const Schedule = require('../models/schedule.model');
const { patientService, twilioCallService, alertService } = require('../services');

const agenda = new Agenda({
  db: {
    address: config.mongoose.url,
    collection: 'agendaJobs', // explicitly set a collection name
  },
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
    nextCallDate: { $lte: now },
  });

  for (const schedule of schedules) {
    // Check if today's day matches the schedule's day
    const interval = schedule.intervals.find(
      (i) => i.day === (schedule.frequency === 'weekly' ? now.getDay() : now.getDate())
    );
    if (!interval) continue;

    // Check if the current time is within 1 hour of the scheduled time
    const [scheduledHour, scheduledMinute] = schedule.time.split(':').map(Number);
    const scheduledTime = new Date(now);
    scheduledTime.setHours(scheduledHour, scheduledMinute, 0, 0);
    
    const timeDiff = Math.abs(now.getTime() - scheduledTime.getTime());
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    if (timeDiff > oneHour) {
      logger.info(`Skipping schedule ${schedule.id} - current time ${now.toLocaleTimeString()} is more than 1 hour from scheduled time ${schedule.time}`);
      continue;
    }

    logger.info(`Running schedule ${schedule.id} for time ${schedule.time} (current time: ${now.toLocaleTimeString()})`);

    // Check that the schedule has a valid patient id
    if (!schedule.patient) {
      logger.error(`Schedule ${schedule.id} has no patient assigned.`);
      continue;
    }

    const patient = await patientService.getPatientById(schedule.patient);
    if (!patient) {
      logger.error(`Patient with ID ${schedule.patient} not found for schedule ${schedule.id}`);
      continue;
    }

    try {
      logger.info(`Initiating call for patient with ID: ${schedule.patient}`);
      await twilioCallService.initiateCall(schedule.patient);

      await alertService.createAlert({
        message: `Called ${patient.name} for their scheduled check-in at ${now.toISOString()}`,
        importance: 'low',
        alertType: 'patient',
        relatedPatient: schedule.patient,
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
        alertType: 'system',
        relatedPatient: schedule.patient,
        createdBy: schedule.id,
        createdModel: 'Schedule',
        visibility: 'allCaregivers',
        relevanceUntil: moment().add(1, 'week').toISOString(),
      });
    }
  }
}

module.exports = {
  agenda,
  runSchedules,
};
