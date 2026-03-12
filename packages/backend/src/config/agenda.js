// agenda.js
const Agenda = require('agenda');
const moment = require('moment');
const config = require('./config');
const logger = require('./logger');
const Schedule = require('../models/schedule.model');
const { clientService, alertService, paymentService } = require('../services');
const { Org, Client, Conversation } = require('../models');

const agenda = new Agenda({
  db: {
    address: config.mongoose.url,
    collection: 'agendaJobs', // explicitly set a collection name
  },
});

// Listen for the 'ready' event to ensure the connection is established
agenda.on('ready', () => {
  logger.info('Agenda is connected and ready!');

  // Schedule your centralized job to run every 15 minutes to support 15-minute schedule increments
  agenda.every('15 minutes', 'runSchedules');
  logger.info('[Agenda] Schedule runner job scheduled to run every 15 minutes');
  
  // Schedule daily billing job based on configuration
  if (config.billing.enableDailyBilling) {
    const [hour, minute] = config.billing.billingTime.split(':');
    agenda.every(`${minute} ${hour} * * *`, 'processDailyBilling');
    logger.info(`[Agenda] Daily billing scheduled for ${config.billing.billingTime} daily`);
  } else {
    logger.info('[Agenda] Daily billing is disabled in configuration');
  }

  // Schedule daily data deletion job (runs at 2 AM daily)
  // Only deletes data for PIPEDA jurisdictions (HIPAA requires retention)
  agenda.every('0 2 * * *', 'processDataDeletion');
  logger.info('[Agenda] Daily data deletion scheduled for 2:00 AM daily');

  // Schedule patient schedule check job (runs every 30 minutes)
  // Checks for patients created more than 30 minutes ago without schedules
  agenda.every('30 minutes', 'checkClientsWithoutSchedules');
  logger.info('[Agenda] Client schedule check scheduled to run every 30 minutes');

  // Start processing jobs only after the connection is ready
  agenda.start();
});

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

// Daily billing job definition
agenda.define('processDailyBilling', { concurrency: 1, lockLifetime: 1800000 }, async (job, done) => {
  try {
    await processDailyBilling();
    done();
  } catch (error) {
    logger.error(`Error in processDailyBilling job: ${error}`);
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

// Client schedule check job definition
agenda.define('checkClientsWithoutSchedules', { concurrency: 1, lockLifetime: 600000 }, async (job, done) => {
  try {
    await checkClientsWithoutSchedules();
    done();
  } catch (error) {
    logger.error(`Error in checkClientsWithoutSchedules job: ${error}`);
    done(error);
  }
});

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
    const { twilioCallService } = require('../services');
    const newCallSid = await twilioCallService.initiateCall(clientId);
    
    // Find the new call record created by initiateCall
    const retryCall = await Call.findOne({ callSid: newCallSid });
    if (retryCall) {
      // Update retry info
      retryCall.retryAttempt = retryAttempt;
      retryCall.originalCallId = originalCallId || callId;
      retryCall.maxRetries = maxRetries;
      retryCall.callType = originalCall.callType || 'wellness-check';
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
      // Lazy load twilioCallService to avoid circular dependency
      const { twilioCallService } = require('../services');
      logger.info(`Initiating call for client with ID: ${schedule.client}`);
      await twilioCallService.initiateCall(schedule.client);

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

async function processDailyBilling() {
  logger.info('[Daily Billing] Starting daily billing process...');
  
  try {
    // Get all organizations
    const orgs = await Org.find({});
    logger.info(`[Daily Billing] Processing billing for ${orgs.length} organizations`);
    
    for (const org of orgs) {
      try {
        await processOrgBilling(org);
      } catch (error) {
        logger.error(`[Daily Billing] Error processing billing for org ${org._id}: ${error.message}`);
        // Continue with other orgs even if one fails
      }
    }
    
    logger.info('[Daily Billing] Daily billing process completed');
  } catch (error) {
    logger.error(`[Daily Billing] Error in daily billing process: ${error.message}`);
    throw error;
  }
}

async function processOrgBilling(org) {
  logger.info(`[Daily Billing] Processing billing for organization: ${org.name} (${org._id})`);
  
  // Get all clients for this organization
  const clients = await Client.find({ org: org._id });
  logger.info(`[Daily Billing] Found ${clients.length} clients for org ${org.name}`);
  
  if (clients.length === 0) {
    logger.info(`[Daily Billing] No clients found for org ${org.name}, skipping billing`);
    return;
  }
  
  // Get unbilled calls from the last 24 hours (Call model tracks billing, not Conversation)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { Call } = require('../models');
  const mongoose = require('mongoose');
  
  // Use a temporary marker to claim these calls atomically
  // This prevents race conditions when multiple billing processes run concurrently
  const billingSessionId = new mongoose.Types.ObjectId();
  
  // Atomically claim unbilled calls by setting a temporary marker
  // Only calls with lineItemId: null will be updated, ensuring no duplicates
  const updateResult = await Call.updateMany(
    {
      clientId: { $in: clients.map((c) => c._id) },
      lineItemId: null, // Not yet billed
      endTime: { $gte: yesterday }, // From last 24 hours
      cost: { $gt: 0 }, // Has a cost
      $or: [
        { billingSessionId: null }, // Not already claimed
        { billingSessionId: { $exists: false } } // Field doesn't exist (older records)
      ]
    },
    {
      $set: { billingSessionId: billingSessionId }
    }
  );
  
  if (updateResult.modifiedCount === 0) {
    logger.info(`[Daily Billing] No unbilled calls found for org ${org.name}`);
    return;
  }
  
  logger.info(`[Daily Billing] Claimed ${updateResult.modifiedCount} unbilled calls for org ${org.name}`);
  
  // Now fetch the calls we just claimed
  const unbilledCalls = await Call.find({
    billingSessionId: billingSessionId
  }).populate('clientId');
  
  // Group calls by client for itemized billing
  const clientBilling = {};
  let totalCost = 0;
  
  for (const call of unbilledCalls) {
    const clientId = call.clientId._id.toString();
    if (!clientBilling[clientId]) {
      clientBilling[clientId] = {
        client: call.clientId,
        calls: [],
        totalCost: 0
      };
    }
    
    clientBilling[clientId].calls.push(call);
    clientBilling[clientId].totalCost += call.cost;
    totalCost += call.cost;
  }
  
  if (totalCost === 0) {
    logger.info(`[Daily Billing] Total cost is $0 for org ${org.name}, skipping invoice creation`);
    // Clear the session markers since we're not billing
    await Call.updateMany(
      { billingSessionId: billingSessionId },
      { $unset: { billingSessionId: 1 } }
    );
    return;
  }
  
  try {
    // Create invoice for the organization
    const invoice = await createOrgInvoice(org, clientBilling, totalCost);
    
    // Create a mapping of clientId to lineItemId
    const clientToLineItem = {};
    for (const lineItem of invoice.lineItems) {
      clientToLineItem[lineItem.clientId.toString()] = lineItem._id;
    }
    
    // Update each call with its client's line item ID and clear session marker
    for (const call of unbilledCalls) {
      const clientId = call.clientId._id.toString();
      const lineItemId = clientToLineItem[clientId];
      
      if (lineItemId) {
        await Call.updateOne(
          { _id: call._id },
          { 
            $set: { lineItemId: lineItemId },
            $unset: { billingSessionId: 1 }
          }
        );
      }
    }
    
    logger.info(`[Daily Billing] Successfully marked ${unbilledCalls.length} calls as billed for org ${org.name}`);
    
    if (invoice) {
      logger.info(`[Daily Billing] Created invoice ${invoice.invoiceNumber} for org ${org.name} with total cost $${totalCost.toFixed(2)}`);
    }
    
    // Attempt to charge the payment method
    if (org.paymentMethod) {
      try {
        await chargePaymentMethod(org, invoice);
      } catch (error) {
        logger.error(`[Daily Billing] Failed to charge payment method for org ${org.name}: ${error.message}`);
        // Create alert for failed payment
        await alertService.createAlert({
          message: `Failed to charge payment method for daily billing. Invoice ${invoice.invoiceNumber} created but not paid.`,
          importance: 'high',
          alertType: 'system',
          createdBy: org._id,
          createdModel: 'Org',
          visibility: 'orgAdmin',
          relevanceUntil: moment().add(7, 'days').toISOString(),
        });
      }
    } else {
      const msg = `[Daily Billing] No payment method found for org ${org.name}, invoice created but not charged`;
      if (process.env.NODE_ENV === 'test') {
        logger.debug(msg);
      } else {
        logger.warn(msg);
      }
      // Create alert for missing payment method
      await alertService.createAlert({
        message: `No payment method configured for daily billing. Invoice ${invoice.invoiceNumber} created but not charged.`,
        importance: 'medium',
        alertType: 'system',
        createdBy: org._id,
        createdModel: 'Org',
        visibility: 'orgAdmin',
        relevanceUntil: moment().add(7, 'days').toISOString(),
      });
    }
  } catch (error) {
    // If invoice creation or updates fail, clear the session markers so calls can be retried
    logger.error(`[Daily Billing] Error processing billing for org ${org.name}: ${error.message}`);
    await Call.updateMany(
      { billingSessionId: billingSessionId },
      { $unset: { billingSessionId: 1 } }
    );
    throw error;
  }
}

/**
 * Get next invoice number atomically to avoid E11000 duplicate key when processDailyBilling runs concurrently.
 */
async function getNextInvoiceNumber() {
  const mongoose = require('mongoose');
  const db = mongoose.connection?.db;
  if (!db) {
    // Fallback when no connection (e.g. some tests): use timestamp-based to avoid duplicates
    return `INV-${Date.now().toString().slice(-9)}`;
  }
  const result = await db.collection('counters').findOneAndUpdate(
    { _id: 'invoiceNumber' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const nextNum = result?.value ?? 1;
  return `INV-${nextNum.toString().padStart(6, '0')}`;
}

async function createOrgInvoice(org, clientBilling, totalCost) {
  const invoiceNumber = await getNextInvoiceNumber();

  // Create invoice
  const invoice = await require('../models').Invoice.create({
    org: org._id,
    invoiceNumber,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    status: 'pending',
    totalAmount: totalCost,
    notes: `Daily billing for ${Object.keys(clientBilling).length} clients`
  });
  
  // Create line items for each client
  const lineItemData = [];
  for (const [clientId, billing] of Object.entries(clientBilling)) {
    lineItemData.push({
      clientId: billing.client._id,
      invoiceId: invoice._id,
      amount: billing.totalCost,
      description: `Daily billing - ${billing.calls.length} call(s)`,
      periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      periodEnd: new Date(), // Now
      quantity: billing.calls.length,
      unitPrice: billing.totalCost / billing.calls.length
    });
  }
  
  const lineItems = await require('../models').LineItem.create(lineItemData);
  
  // Add lineItems to invoice object for caller to use
  invoice.lineItems = lineItems;
  
  // Return invoice with lineItems attached
  return invoice;
}

async function chargePaymentMethod(org, invoice) {
  // This would integrate with your payment processing system (Stripe, etc.)
  // For now, we'll just log that we would charge the payment method
  logger.info(`[Daily Billing] Would charge payment method for org ${org.name}, invoice ${invoice.invoiceNumber}, amount $${invoice.totalAmount}`);
  
  // TODO: Implement actual payment processing
  // Example:
  // const paymentResult = await stripeService.chargePaymentMethod(org.paymentMethod, invoice.totalAmount);
  // if (paymentResult.success) {
  //   invoice.status = 'paid';
  //   invoice.paidAt = new Date();
  //   await invoice.save();
  // }
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
  processDailyBilling,
};
