// agenda.js
const Agenda = require('agenda');
const moment = require('moment');
const config = require('./config');
const logger = require('./logger');
const Schedule = require('../models/schedule.model');
const { patientService, twilioCallService, alertService, paymentService } = require('../services');
const { Org, Patient, Conversation } = require('../models');

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
  
  // Schedule daily billing job based on configuration
  if (config.billing.enableDailyBilling) {
    const [hour, minute] = config.billing.billingTime.split(':');
    agenda.every(`${minute} ${hour} * * *`, 'processDailyBilling');
    logger.info(`[Agenda] Daily billing scheduled for ${config.billing.billingTime} daily`);
  } else {
    logger.info('[Agenda] Daily billing is disabled in configuration');
  }

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
  
  // Get all patients for this organization
  const patients = await Patient.find({ org: org._id });
  logger.info(`[Daily Billing] Found ${patients.length} patients for org ${org.name}`);
  
  if (patients.length === 0) {
    logger.info(`[Daily Billing] No patients found for org ${org.name}, skipping billing`);
    return;
  }
  
  // Get unbilled conversations from the last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const unbilledConversations = await Conversation.find({
    patientId: { $in: patients.map(p => p._id) },
    lineItemId: null, // Not yet billed
    endTime: { $gte: yesterday }, // From last 24 hours
    cost: { $gt: 0 } // Has a cost
  }).populate('patientId');
  
  if (unbilledConversations.length === 0) {
    logger.info(`[Daily Billing] No unbilled conversations found for org ${org.name}`);
    return;
  }
  
  logger.info(`[Daily Billing] Found ${unbilledConversations.length} unbilled conversations for org ${org.name}`);
  
  // Group conversations by patient for itemized billing
  const patientBilling = {};
  let totalCost = 0;
  
  for (const conversation of unbilledConversations) {
    const patientId = conversation.patientId._id.toString();
    if (!patientBilling[patientId]) {
      patientBilling[patientId] = {
        patient: conversation.patientId,
        conversations: [],
        totalCost: 0
      };
    }
    
    patientBilling[patientId].conversations.push(conversation);
    patientBilling[patientId].totalCost += conversation.cost;
    totalCost += conversation.cost;
  }
  
  if (totalCost === 0) {
    logger.info(`[Daily Billing] Total cost is $0 for org ${org.name}, skipping invoice creation`);
    return;
  }
  
  // Double-check that conversations are still unbilled (race condition protection)
  const stillUnbilledConversations = await Conversation.find({
    _id: { $in: unbilledConversations.map(c => c._id) },
    lineItemId: null
  });
  
  if (stillUnbilledConversations.length !== unbilledConversations.length) {
    logger.warn(`[Daily Billing] Some conversations were already billed for org ${org.name}, skipping`);
    return;
  }
  
  // Create invoice for the organization
  const invoice = await createOrgInvoice(org, patientBilling, totalCost);
  
  // Update conversations with their respective line item references
  const conversationIds = stillUnbilledConversations.map(c => c._id);
  
  // Create a mapping of patientId to lineItemId
  const patientToLineItem = {};
  for (const lineItem of invoice.lineItems) {
    patientToLineItem[lineItem.patientId.toString()] = lineItem._id;
  }
  
  // Update each conversation with its patient's line item ID
  for (const conversation of stillUnbilledConversations) {
    const patientId = conversation.patientId.toString();
    const lineItemId = patientToLineItem[patientId];
    
    if (lineItemId) {
      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { lineItemId: lineItemId } }
      );
    }
  }
  
  logger.info(`[Daily Billing] Successfully marked ${conversationIds.length} conversations as billed for org ${org.name}`);
  
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
    logger.warn(`[Daily Billing] No payment method found for org ${org.name}, invoice created but not charged`);
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
}

async function createOrgInvoice(org, patientBilling, totalCost) {
  // Generate invoice number
  const lastInvoice = await require('../models').Invoice.findOne({}, {}, { sort: { createdAt: -1 } });
  let nextNum = 1;
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const parts = lastInvoice.invoiceNumber.split('-');
    if (parts.length >= 2) {
      const parsed = parseInt(parts[1]);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }
  }
  const invoiceNumber = `INV-${nextNum.toString().padStart(6, '0')}`;
  
  // Create invoice
  const invoice = await require('../models').Invoice.create({
    org: org._id,
    invoiceNumber,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    status: 'pending',
    totalAmount: totalCost,
    notes: `Daily billing for ${Object.keys(patientBilling).length} patients`
  });
  
  // Create line items for each patient
  const lineItemData = [];
  for (const [patientId, billing] of Object.entries(patientBilling)) {
    lineItemData.push({
      patientId: billing.patient._id,
      invoiceId: invoice._id,
      amount: billing.totalCost,
      description: `Daily billing - ${billing.conversations.length} conversation(s)`,
      periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      periodEnd: new Date(), // Now
      quantity: billing.conversations.length,
      unitPrice: billing.totalCost / billing.conversations.length
    });
  }
  
  const lineItems = await require('../models').LineItem.create(lineItemData);
  
  // Populate line items and return
  return await require('../models').Invoice.findById(invoice._id).populate('lineItems');
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

module.exports = {
  agenda,
  runSchedules,
  processDailyBilling,
};
