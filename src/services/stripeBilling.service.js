const logger = require('../config/logger');
const { Org, Patient, Conversation } = require('../models');
const stripeSubscriptionService = require('./stripeSubscription.service');
const stripeUsageService = require('./stripeUsage.service');
const stripeSyncService = require('./stripeSync.service');
const config = require('../config/config');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');

/**
 * Stripe Billing Service
 * Hybrid billing system that uses Stripe Meters while maintaining patient-level tracking
 */

/**
 * Report conversation usage to Stripe and maintain local tracking
 * @param {string} orgId - Organization ID
 * @param {Object} conversation - Conversation object
 * @returns {Promise<void>}
 */
const reportConversationUsage = async (orgId, conversation) => {
  try {
    const org = await Org.findById(orgId);
    if (!org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
    }

    // Ensure subscription exists
    const subscription = await stripeSubscriptionService.getOrCreateSubscription(orgId);
    
    // Update org with subscription item ID if not set
    if (!org.stripeSubscriptionItemId && subscription.items.data[0]) {
      org.stripeSubscriptionItemId = subscription.items.data[0].id;
      await org.save();
    }

    if (!org.stripeSubscriptionItemId) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Subscription item ID not found'
      );
    }

    // Report usage to Stripe with patient metadata
    const billingConfig = {
      minimumBillableDuration: config.billing?.minimumBillableDuration || 30,
      ratePerMinute: config.billing?.ratePerMinute || 0.1,
    };

    await stripeUsageService.reportConversationUsage(
      org.stripeSubscriptionItemId,
      conversation,
      billingConfig
    );

    // Note: We don't mark conversation as billed yet
    // Stripe will create invoices on billing cycle, and webhooks will sync them
    // The conversation.lineItemId will be set when the invoice is synced

    logger.debug(
      `Reported conversation ${conversation._id} usage to Stripe for org ${orgId}`
    );
  } catch (error) {
    logger.error(`Error reporting conversation usage:`, error);
    throw error;
  }
};

/**
 * Process billing for an organization
 * This maintains backward compatibility with existing billing logic
 * while using Stripe for actual billing
 * @param {string} orgId - Organization ID
 * @returns {Promise<void>}
 */
const processOrgBilling = async (orgId) => {
  try {
    const org = await Org.findById(orgId);
    if (!org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
    }

    logger.info(`Processing billing for organization: ${org.name} (${orgId})`);

    // Get all patients for this organization
    const patients = await Patient.find({ org: orgId });
    if (patients.length === 0) {
      logger.info(`No patients found for org ${org.name}, skipping billing`);
      return;
    }

    // Get unbilled conversations from the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const unbilledConversations = await Conversation.find({
      patientId: { $in: patients.map((p) => p._id) },
      lineItemId: null, // Not yet billed
      endTime: { $gte: yesterday }, // From last 24 hours
      cost: { $gt: 0 }, // Has a cost
    }).populate('patientId');

    if (unbilledConversations.length === 0) {
      logger.info(`No unbilled conversations found for org ${org.name}`);
      return;
    }

    logger.info(
      `Found ${unbilledConversations.length} unbilled conversations for org ${org.name}`
    );

    // Ensure subscription exists
    await stripeSubscriptionService.getOrCreateSubscription(orgId);

    // Report each conversation to Stripe
    // Stripe will aggregate and bill on the billing cycle
    for (const conversation of unbilledConversations) {
      try {
        await reportConversationUsage(orgId, conversation);
      } catch (error) {
        logger.error(
          `Failed to report conversation ${conversation._id} usage:`,
          error
        );
        // Continue with other conversations
      }
    }

    // Sync any pending Stripe invoices to local database
    // This ensures local invoices are up to date
    try {
      await stripeSyncService.syncOrgInvoices(orgId);
    } catch (error) {
      logger.warn(`Failed to sync invoices for org ${orgId}:`, error);
      // Don't fail the entire process if sync fails
    }

    logger.info(`Completed billing processing for org ${org.name}`);
  } catch (error) {
    logger.error(`Error processing billing for org ${orgId}:`, error);
    throw error;
  }
};

/**
 * Get unbilled costs for an organization
 * This shows costs that have been reported to Stripe but not yet invoiced
 * @param {string} orgId - Organization ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Unbilled costs summary
 */
const getUnbilledCosts = async (orgId, days = 7) => {
  try {
    const org = await Org.findById(orgId);
    if (!org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
    }

    if (!org.stripeSubscriptionId) {
      // No subscription, return empty result
      return {
        orgId: org._id,
        orgName: org.name,
        totalUnbilledCost: 0,
        patientCosts: [],
        period: {
          days,
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        },
      };
    }

    // Get usage summary from Stripe
    const usageSummary = await stripeUsageService.getUsageSummary(
      org.stripeSubscriptionId
    );

    // Get unbilled conversations (reported to Stripe but not yet in an invoice)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const patients = await Patient.find({ org: orgId });
    const unbilledConversations = await Conversation.find({
      patientId: { $in: patients.map((p) => p._id) },
      lineItemId: null, // Not yet linked to an invoice
      endTime: { $gte: startDate },
      cost: { $gt: 0 },
    }).populate('patientId');

    // Group by patient
    const patientCosts = {};
    let totalUnbilledCost = 0;

    for (const conversation of unbilledConversations) {
      const patientId = conversation.patientId._id.toString();
      const patientName = conversation.patientId.name;

      if (!patientCosts[patientId]) {
        patientCosts[patientId] = {
          patientId,
          patientName,
          conversationCount: 0,
          totalCost: 0,
          conversations: [],
        };
      }

      patientCosts[patientId].conversationCount++;
      patientCosts[patientId].totalCost += conversation.cost;
      patientCosts[patientId].conversations.push({
        conversationId: conversation._id,
        startTime: conversation.startTime,
        duration: conversation.duration,
        cost: conversation.cost,
        status: conversation.status,
      });

      totalUnbilledCost += conversation.cost;
    }

    return {
      orgId: org._id,
      orgName: org.name,
      totalUnbilledCost,
      patientCosts: Object.values(patientCosts).sort(
        (a, b) => b.totalCost - a.totalCost
      ),
      period: {
        days,
        startDate,
        endDate: new Date(),
      },
      stripeUsage: {
        totalUsage: usageSummary.totalUsage,
        currentPeriodStart: new Date(usageSummary.currentPeriodStart * 1000),
        currentPeriodEnd: new Date(usageSummary.currentPeriodEnd * 1000),
      },
    };
  } catch (error) {
    logger.error(`Error getting unbilled costs for org ${orgId}:`, error);
    throw error;
  }
};

module.exports = {
  reportConversationUsage,
  processOrgBilling,
  getUnbilledCosts,
};

