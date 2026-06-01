const logger = require('../config/logger');
const { Org, Client, Call } = require('../models');
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

    await Call.updateOne({ _id: call._id }, { stripeUsageReportedAt: new Date() });

    logger.debug(
      `Reported call ${call._id} usage to Stripe for org ${orgId}`
    );
  } catch (error) {
    logger.error(`Error reporting conversation usage:`, error);
    throw error;
  }
};

/**
 * Process usage reporting for an organization.
 * Reports unreported call usage to Stripe; Stripe invoices monthly.
 * @param {string} orgId - Organization ID
 * @returns {Promise<void>}
 */
const processOrgBilling = async (orgId) => {
  try {
    const org = await Org.findById(orgId);
    if (!org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
    }

    logger.info(`[Stripe Billing] Processing usage for organization: ${org.name} (${orgId})`);

    const clients = await Client.find({ org: orgId });
    if (clients.length === 0) {
      logger.info(`[Stripe Billing] No clients found for org ${org.name}, skipping`);
      return;
    }

    const unbilledCalls = await Call.find({
      clientId: { $in: clients.map((c) => c._id) },
      lineItemId: null,
      stripeUsageReportedAt: null,
      cost: { $gt: 0 },
    }).populate('clientId');

    if (unbilledCalls.length === 0) {
      logger.info(`[Stripe Billing] No unreported calls found for org ${org.name}`);
      return;
    }

    logger.info(
      `[Stripe Billing] Found ${unbilledCalls.length} unreported calls for org ${org.name}`
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

    logger.info(`[Stripe Billing] Completed usage reporting for org ${org.name}`);
  } catch (error) {
    logger.error(`[Stripe Billing] Error processing usage for org ${orgId}:`, error);
    throw error;
  }
};

/**
 * Report pending call usage to Stripe for all organizations.
 * Stripe creates and charges invoices on the monthly billing cycle.
 * @returns {Promise<void>}
 */
const processUsageReporting = async () => {
  logger.info('[Stripe Billing] Starting usage reporting process...');

  try {
    const orgs = await Org.find({});
    logger.info(`[Stripe Billing] Processing usage for ${orgs.length} organizations`);

    for (const org of orgs) {
      try {
        await processOrgBilling(org._id);
      } catch (error) {
        logger.error(
          `[Stripe Billing] Error processing usage for org ${org._id}: ${error.message}`
        );
      }
    }

    logger.info('[Stripe Billing] Usage reporting process completed');
  } catch (error) {
    logger.error(`[Stripe Billing] Error in usage reporting process: ${error.message}`);
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
        clientCosts: [],
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

    const clients = await Client.find({ org: orgId });
    const unbilledCalls = await Call.find({
      clientId: { $in: clients.map((c) => c._id) },
      lineItemId: null, // Not yet linked to an invoice
      endTime: { $gte: startDate },
      cost: { $gt: 0 },
    }).populate('clientId');

    // Group by client
    const clientCosts = {};
    let totalUnbilledCost = 0;

    for (const call of unbilledCalls) {
      const clientId = call.clientId._id.toString();
      const clientName = call.clientId.name;

      if (!clientCosts[clientId]) {
        clientCosts[clientId] = {
          clientId,
          clientName,
          callCount: 0,
          totalCost: 0,
          calls: [],
        };
      }

      clientCosts[clientId].callCount++;
      clientCosts[clientId].totalCost += call.cost;
      clientCosts[clientId].calls.push({
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
      clientCosts: Object.values(clientCosts).sort(
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
  processUsageReporting,
  getUnbilledCosts,
};

