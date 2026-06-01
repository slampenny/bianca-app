// agenda.js
const Agenda = require('agenda');
const moment = require('moment');
const config = require('./config');
const logger = require('./logger');
const { scheduleRecurringJob } = require('../utils/agenda.utils');
const Schedule = require('../models/schedule.model');
const { clientService, alertService, paymentService } = require('../services');
const { Org, Client, Conversation } = require('../models');

const agenda = new Agenda({
  db: {
    address: config.mongoose.url,
    collection: 'agendaJobs', // explicitly set a collection name
  },
});

/** Recurring jobs registered via scheduleRecurringJob on the main agenda instance. */
const MAIN_RECURRING_AGENDA_JOBS = [
  'runSchedules',
  'processUsageReporting',
  'processDataDeletion',
  'checkClientsWithoutSchedules',
  'processDailyDigestCoordinator',
];

// Listen for the 'ready' event to ensure the connection is established
agenda.on('ready', async () => {
  logger.info('Agenda is connected and ready!');
  await registerRecurringAgendaJobs(agenda);
  await agenda.start();
});

/**
 * Register all recurring jobs on the main Agenda instance (restart-safe).
 */
async function registerRecurringAgendaJobs(agendaInstance) {
  await scheduleRecurringJob({
    agenda: agendaInstance,
    jobName: 'runSchedules',
    interval: '15 minutes',
    logger,
  });

  if (config.billing.enableUsageReporting) {
    const [hour, minute] = config.billing.usageReportingTime.split(':');
    await scheduleRecurringJob({
      agenda: agendaInstance,
      jobName: 'processUsageReporting',
      interval: `${minute} ${hour} * * *`,
      logger,
    });
  } else {
    logger.info('[Agenda] Stripe usage reporting is disabled in configuration');
  }

  await scheduleRecurringJob({
    agenda: agendaInstance,
    jobName: 'processDataDeletion',
    interval: '0 2 * * *',
    logger,
  });

  await scheduleRecurringJob({
    agenda: agendaInstance,
    jobName: 'checkClientsWithoutSchedules',
    interval: '30 minutes',
    logger,
  });

  await scheduleDailyDigestCoordinator(agendaInstance);
}

// Centralized job definition with distributed locking settings
agenda.define('runSchedules', { concurrency: 1, lockLifetime: 600000 }, async (job, done) => {
  logger.info('[Agenda] Starting runSchedules job execution');
  try {
    await runSchedules();
    logger.info('[Agenda] Completed runSchedules job execution');
    done();
  } catch (error) {
    logger.error(`Error in runSchedules job: ${error}`);
    done(error);
  }
});

// Stripe usage reporting job definition
agenda.define('processUsageReporting', { concurrency: 1, lockLifetime: 1800000 }, async (job, done) => {
  try {
    await processUsageReporting();
    done();
  } catch (error) {
    logger.error(`Error in processUsageReporting job: ${error}`);
    done(error);
  }
});

// Daily data deletion job definition
// Deletes expired data based on jurisdiction-specific retention rules
agenda.define('processDataDeletion', { concurrency: 1, lockLifetime: 3600000 }, async (job, done) => {
  try {
    const dataDeletionService = require('../services/dataDeletion.service');
    await dataDeletionService.processDataDeletion();
    done();
  } catch (error) {
    logger.error(`Error in processDataDeletion job: ${error}`);
    done(error);
  }
});

// Check clients without schedules job definition
agenda.define('checkClientsWithoutSchedules', { concurrency: 1, lockLifetime: 600000 }, async (job, done) => {
  try {
    await checkClientsWithoutSchedules();
    done();
  } catch (error) {
    logger.error(`Error in checkClientsWithoutSchedules job: ${error}`);
    done(error);
  }
});

function registerDailyDigestAgendaJobs(agendaInstance) {
  if (!config.dailyDigestScheduler?.enabled) {
    return;
  }

  const lockLifetime = config.dailyDigestScheduler.lockLifetimeMs;
  const childConcurrency = config.dailyDigestScheduler.childJobConcurrency;

  agendaInstance.define(
    'processDailyDigestCoordinator',
    { concurrency: 1, lockLifetime },
    async (job, done) => {
      logger.info('[Agenda] Starting processDailyDigestCoordinator job');
      try {
        const scheduler = require('../services/caregiverDailyDigestScheduler.service');
        await scheduler.runDailyDigestCoordinatorTick({
          now: new Date(),
          enqueueCaregiverJob: (runId) => agendaInstance.now('processCaregiverDailyDigest', { runId }),
        });
        logger.info('[Agenda] Completed processDailyDigestCoordinator job');
        done();
      } catch (error) {
        logger.error(`Error in processDailyDigestCoordinator job: ${error}`);
        done(error);
      }
    }
  );

  agendaInstance.define(
    'processCaregiverDailyDigest',
    {
      concurrency: childConcurrency,
      lockLifetime,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
    },
    async (job, done) => {
      const { runId } = job.attrs.data || {};
      if (!runId) {
        return done(new Error('processCaregiverDailyDigest missing runId'));
      }
      try {
        const scheduler = require('../services/caregiverDailyDigestScheduler.service');
        await scheduler.processCaregiverDailyDigestJob({
          runId,
          agendaJobId: job.attrs._id ? String(job.attrs._id) : null,
        });
        done();
      } catch (error) {
        logger.error(`Error in processCaregiverDailyDigest job runId=${runId}: ${error.message}`);
        done(error);
      }
    }
  );
}

registerDailyDigestAgendaJobs(agenda);

/**
 * Schedule (or reschedule) the digest coordinator recurring job.
 * Cancels existing coordinator jobs first to avoid duplicates on restart / blue-green overlap.
 */
async function scheduleDailyDigestCoordinator(agendaInstance) {
  if (!config.dailyDigestScheduler?.enabled) {
    logger.info('[Agenda] Daily digest scheduler is disabled in configuration');
    return;
  }

  const intervalMinutes = config.dailyDigestScheduler.coordinatorIntervalMinutes;
  await scheduleRecurringJob({
    agenda: agendaInstance,
    jobName: 'processDailyDigestCoordinator',
    interval: `${intervalMinutes} minutes`,
    logger,
  });
  logger.info(
    `[Agenda] Daily digest coordinator default send ${config.dailyDigestScheduler.defaultSendTime} org-local`
  );
}

// Retry missed call job definition
agenda.define('retryMissedCall', { concurrency: 1, lockLifetime: 300000 }, async (job, done) => {
  try {
    const { callId, clientId: jobClientId, retryAttempt, originalCallId } = job.attrs.data;
    const clientId = jobClientId;
    
    logger.info(`[Agenda] Executing retry missed call job: callId=${callId}, retryAttempt=${retryAttempt}`);
    
    // Get the original call
    const { Call } = require('../models');
    const originalCall = await Call.findById(originalCallId || callId);
    if (!originalCall) {
      logger.error(`[Agenda] Original call not found: ${originalCallId || callId}`);
      return done(new Error('Original call not found'));
    }
    
    // Get client and org
    const client = await Client.findById(clientId).populate('org');
    if (!client) {
      logger.error(`[Agenda] Client not found: ${clientId}`);
      return done(new Error('Client not found'));
    }
    
    const org = client.org;
    if (!org) {
      logger.error(`[Agenda] Org not found for client: ${clientId}`);
      return done(new Error('Org not found'));
    }
    
    // Check retry settings
    const retrySettings = org.callRetrySettings || {};
    const maxRetries = retrySettings.retryCount || 2;
    
    if (retryAttempt > maxRetries) {
      logger.info(`[Agenda] Retry attempt ${retryAttempt} exceeds max retries ${maxRetries}, not retrying`);
      return done();
    }
    
    // Initiate the retry call (lazy load to avoid circular dependency)
    const { voiceTelephonyService } = require('../services');
    const newCallSid = await voiceTelephonyService.initiateCall(clientId);
    
    // Find the new call record created by initiateCall
    const retryCall = await Call.findOne({ callSid: newCallSid });
    if (retryCall) {
      // Update retry info (callType + onboardingDay come from initiateCall / journey state)
      retryCall.retryAttempt = retryAttempt;
      retryCall.originalCallId = originalCallId || callId;
      retryCall.maxRetries = maxRetries;
      await retryCall.save();
      
      logger.info(`[Agenda] Updated retry call ${retryCall._id} for original call ${originalCallId || callId}`);
    } else {
      logger.warn(`[Agenda] Retry call record not found for callSid: ${newCallSid}`);
    }
    
    done();
  } catch (error) {
    logger.error(`[Agenda] Error in retryMissedCall job: ${error.message}`);
    done(error);
  }
});

async function runSchedules() {
  const now = new Date();
  const nowUTC = new Date(Date.now()); // Ensure we're using UTC
  const schedules = await Schedule.find({
    isActive: true,
    nextCallDate: { $lte: nowUTC },
  });

  for (const schedule of schedules) {
    // Check if today's day matches the schedule's day (using UTC)
    // schedule.time is stored in UTC, so we compare with UTC time
    // For daily schedules, intervals can be empty (runs every day)
    // For weekly/monthly schedules, we need to find a matching interval
    if (schedule.frequency !== 'daily' && schedule.intervals.length > 0) {
      const interval = schedule.intervals.find(
        (i) => i.day === (schedule.frequency === 'weekly' ? nowUTC.getUTCDay() : nowUTC.getUTCDate())
      );
      if (!interval) continue;
    }

    // Check if the current UTC time is within 15 minutes of the scheduled UTC time
    // schedule.time is stored in UTC (HH:mm format)
    const [scheduledHour, scheduledMinute] = schedule.time.split(':').map(Number);
    const scheduledTimeUTC = new Date(Date.UTC(
      nowUTC.getUTCFullYear(),
      nowUTC.getUTCMonth(),
      nowUTC.getUTCDate(),
      scheduledHour,
      scheduledMinute,
      0,
      0
    ));
    
    const timeDiff = Math.abs(nowUTC.getTime() - scheduledTimeUTC.getTime());
    const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
    
    if (timeDiff > fifteenMinutes) {
      logger.info(`Skipping schedule ${schedule.id} - current UTC time ${nowUTC.toISOString()} is more than 15 minutes from scheduled UTC time ${schedule.time}`);
      continue;
    }

    logger.info(`Running schedule ${schedule.id} for UTC time ${schedule.time} (current UTC time: ${nowUTC.toISOString()})`);

    // Check that the schedule has a valid patient id
    if (!schedule.client) {
      logger.error(`Schedule ${schedule.id} has no patient assigned.`);
      continue;
    }

    // Get patient with org populated to check consent requirements
    const client = await Client.findById(schedule.client).populate('org');
    if (!client) {
      logger.error(`Client with ID ${schedule.client} not found for schedule ${schedule.id}`);
      continue;
    }

    if (!client.org) {
      logger.error(`Client ${schedule.client} has no org for schedule ${schedule.id}`);
      continue;
    }

    const org = client.org;
    const hasConsent = await clientService.checkClientConsent(schedule.client);

    // If org requires consent but client hasn't consented, skip the call and alert caregivers
    if (org.requireClientConsent && !hasConsent) {
      logger.warn(`Skipping scheduled call for client ${schedule.client} - consent required but not given`);
      
      await alertService.createAlert({
        message: `Scheduled call to ${client.name} was skipped because client consent is required but has not been obtained. Please obtain consent from the client before the next scheduled call.`,
        importance: 'medium',
        alertType: 'system',
        relatedClient: schedule.client,
        createdBy: schedule.id,
        createdModel: 'Schedule',
        visibility: 'assignedCaregivers',
        relevanceUntil: moment().add(1, 'week').toISOString(),
      });

      // Still update nextCallDate so the schedule doesn't keep trying
      schedule.calculateNextCallDate();
      await schedule.save();
      continue;
    }

    try {
      // Lazy load voiceTelephonyService to avoid circular dependency
      const { voiceTelephonyService } = require('../services');
      logger.info(`Initiating call for client with ID: ${schedule.client}`);
      await voiceTelephonyService.initiateCall(schedule.client);

      await alertService.createAlert({
        message: `Called ${client.name} for their scheduled check-in at ${now.toISOString()}`,
        importance: 'low',
        alertType: 'client',
        relatedClient: schedule.client,
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
        message: `Call to ${client.name} for their scheduled check-in at ${now.toISOString()} generated an error: ${error}`,
        importance: 'high',
        alertType: 'system',
        relatedClient: schedule.client,
        createdBy: schedule.id,
        createdModel: 'Schedule',
        visibility: 'allCaregivers',
        relevanceUntil: moment().add(1, 'week').toISOString(),
      });
    }
  }
}

async function processUsageReporting() {
  const stripeBillingService = require('../services/stripeBilling.service');
  await stripeBillingService.processUsageReporting();
}

async function checkClientsWithoutSchedules() {
  logger.info('[Client Schedule Check] Starting client schedule check...');
  
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const clients = await Client.find({
      createdAt: {
        $gte: sixtyMinutesAgo,
        $lte: thirtyMinutesAgo
      }
    }).populate('org');
    
    logger.info(`[Client Schedule Check] Found ${clients.length} clients created 30-60 minutes ago`);
    
    let clientsChecked = 0;
    let alertsCreated = 0;
    let clientsWithSchedules = 0;
    
    for (const client of clients) {
      clientsChecked++;
      const scheduleCount = await Schedule.countDocuments({ client: client._id });
      
      if (scheduleCount === 0) {
        logger.info(`[Client Schedule Check] Creating alert for client ${client.name} (${client._id}) with no schedule`);
        const alertMessage = `Client ${client.name} has no schedule configured`;
        const relevanceUntil = moment().add(30, 'days').toISOString();
        
        await alertService.createAlert({
          message: alertMessage,
          importance: 'medium',
          alertType: 'client',
          relatedClient: client._id,
          createdBy: client._id,
          createdModel: 'Client',
          visibility: 'assignedCaregivers',
          relevanceUntil
        });
        
        alertsCreated++;
      } else {
        clientsWithSchedules++;
      }
    }
    
    logger.info(`[Client Schedule Check] Completed. Clients checked: ${clientsChecked}, Alerts created: ${alertsCreated}, Clients with schedules: ${clientsWithSchedules}`);
  } catch (error) {
    logger.error(`[Client Schedule Check] Error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  agenda,
  runSchedules,
  processUsageReporting,
  registerDailyDigestAgendaJobs,
  scheduleDailyDigestCoordinator,
  registerRecurringAgendaJobs,
  MAIN_RECURRING_AGENDA_JOBS,
};
