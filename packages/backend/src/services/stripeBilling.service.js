const logger = require('../config/logger');
const { Org, Patient, Call, Conversation } = require('../models');
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
 * Report call usage to Stripe and maintain local tracking
 * @param {string} orgId - Organization ID
 * @param {Object} call - Call object (Call model tracks billing, not Conversation)
 * @returns {Promise<void>}
 */
const reportConversationUsage = async (orgId, call) => {
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
      call,
      billingConfig
    );

    // Note: We don't mark call as billed yet
    // Stripe will create invoices on billing cycle, and webhooks will sync them
    // The call.lineItemId will be set when the invoice is synced

    logger.debug(
      `Reported call ${call._id} usage to Stripe for org ${orgId}`
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

    // Get unbilled calls from the last 24 hours (Call model tracks billing, not Conversation)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const unbilledCalls = await Call.find({
      patientId: { $in: patients.map((p) => p._id) },
      lineItemId: null, // Not yet billed
      endTime: { $gte: yesterday }, // From last 24 hours
      cost: { $gt: 0 }, // Has a cost
    }).populate('patientId');

    if (unbilledCalls.length === 0) {
      logger.info(`No unbilled calls found for org ${org.name}`);
      return;
    }

    logger.info(
      `Found ${unbilledCalls.length} unbilled calls for org ${org.name}`
    );

    // Ensure subscription exists
    await stripeSubscriptionService.getOrCreateSubscription(orgId);

    // Report each call to Stripe
    // Stripe will aggregate and bill on the billing cycle
    for (const call of unbilledCalls) {
      try {
        await reportConversationUsage(orgId, call);
      } catch (error) {
        logger.error(
          `Failed to report call ${call._id} usage:`,
          error
        );
        // Continue with other calls
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

    // Get unbilled calls (reported to Stripe but not yet in an invoice)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const patients = await Patient.find({ org: orgId });
    const unbilledCalls = await Call.find({
      patientId: { $in: patients.map((p) => p._id) },
      lineItemId: null, // Not yet linked to an invoice
      endTime: { $gte: startDate },
      cost: { $gt: 0 },
    }).populate('patientId');

    // Group by patient
    const patientCosts = {};
    let totalUnbilledCost = 0;

    for (const call of unbilledCalls) {
      const patientId = call.patientId._id.toString();
      const patientName = call.patientId.name;

      if (!patientCosts[patientId]) {
        patientCosts[patientId] = {
          patientId,
          patientName,
          callCount: 0,
          totalCost: 0,
          calls: [],
        };
      }

      patientCosts[patientId].callCount++;
      patientCosts[patientId].totalCost += call.cost;
      patientCosts[patientId].calls.push({
        callId: call._id,
        startTime: call.startTime,
        duration: call.duration,
        cost: call.cost,
        status: call.status,
      });

      totalUnbilledCost += call.cost;
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

