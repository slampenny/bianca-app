const stripe = require('../config/stripe');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');
const stripeMeterService = require('./stripeMeter.service');

/**
 * Stripe Usage Event Service
 * Handles reporting usage events to Stripe for metered billing
 */

/**
 * Report usage event to Stripe
 * @param {string} subscriptionItemId - Stripe subscription item ID
 * @param {number} value - Usage value (e.g., number of API requests, minutes, etc.)
 * @param {Object} metadata - Additional metadata (e.g., patientId, conversationId)
 * @param {number} timestamp - Event timestamp in Unix seconds (defaults to now)
 * @returns {Promise<Object>} Stripe usage record
 */
const reportUsage = async (subscriptionItemId, value, metadata = {}, timestamp = null) => {
  try {
    const meter = await stripeMeterService.getOrCreateMeter();
    const eventTimestamp = timestamp || Math.floor(Date.now() / 1000);

    // When using Stripe Meters, report usage via meter events
    // Stripe automatically applies these to the subscription
    const meterEvent = await stripe.billing.meterEvents.create({
      event_name: stripeMeterService.METER_CONFIG.EVENT_NAME,
      identifier: subscriptionItemId, // Use subscription item ID as identifier
      value: value,
      payload: {
        value: value,
        ...metadata,
      },
      timestamp: eventTimestamp,
    });

    logger.debug(`Reported usage: ${value} for subscription item ${subscriptionItemId} via meter event`);

    return meterEvent;
  } catch (error) {
    logger.error(`Error reporting usage for subscription item ${subscriptionItemId}:`, error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to report usage: ${error.message}`
    );
  }
};

/**
 * Report usage for a conversation (converts duration to billable units)
 * @param {string} subscriptionItemId - Stripe subscription item ID
 * @param {Object} conversation - Conversation object
 * @param {Object} config - Billing configuration
 * @returns {Promise<Object>} Usage record
 */
const reportConversationUsage = async (subscriptionItemId, conversation, config = {}) => {
  try {
    const minimumBillableDuration = config.minimumBillableDuration || 30; // seconds
    const ratePerMinute = config.ratePerMinute || 0.1; // $0.10 per minute

    // Calculate billable duration
    const billableDuration = Math.max(conversation.duration || 0, minimumBillableDuration);
    const billableMinutes = billableDuration / 60;

    // Report usage (in minutes)
    const metadata = {
      conversationId: conversation._id?.toString() || conversation.id,
      patientId: conversation.patientId?.toString() || conversation.patientId,
      duration: conversation.duration,
      billableDuration: billableDuration,
    };

    return await reportUsage(subscriptionItemId, billableMinutes, metadata);
  } catch (error) {
    logger.error(`Error reporting conversation usage:`, error);
    throw error;
  }
};

/**
 * Get usage summary for a subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Usage summary
 */
const getUsageSummary = async (subscriptionId, options = {}) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    });
    const subscriptionItem = subscription.items.data[0];

    if (!subscriptionItem) {
      throw new ApiError(httpStatus.NOT_FOUND, 'No subscription items found');
    }

    // Get usage records for current period
    const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(
      subscriptionItem.id,
      {
        limit: options.limit || 100,
      }
    );

    return {
      subscriptionId,
      subscriptionItemId: subscriptionItem.id,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      usageRecords: usageRecords.data,
      totalUsage: usageRecords.data.reduce((sum, record) => sum + (record.total_usage || 0), 0),
    };
  } catch (error) {
    logger.error(`Error getting usage summary for subscription ${subscriptionId}:`, error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to get usage summary: ${error.message}`
    );
  }
};

module.exports = {
  reportUsage,
  reportConversationUsage,
  getUsageSummary,
};

