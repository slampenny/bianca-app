const stripe = require('../config/stripe');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');
const { Org } = require('../models');
const stripeMeterService = require('./stripeMeter.service');

/**
 * Stripe Subscriptions Service
 * Handles creation and management of Stripe subscriptions with metered billing
 */

/**
 * Create or retrieve a subscription for an organization
 * @param {string} orgId - Organization ID
 * @param {Object} options - Subscription options
 * @returns {Promise<Object>} Stripe subscription object
 */
const getOrCreateSubscription = async (orgId, options = {}) => {
  try {
    const org = await Org.findById(orgId);
    if (!org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
    }

    // Ensure org has Stripe customer ID
    if (!org.stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        email: org.email,
        metadata: {
          orgId: org.id.toString(),
        },
      });
      org.stripeCustomerId = customer.id;
      await org.save();
      logger.info(`Created Stripe customer for org: ${org.name} (${org.id})`);
    }

    // Check if subscription already exists
    if (org.stripeSubscriptionId) {
      try {
        const existingSubscription = await stripe.subscriptions.retrieve(
          org.stripeSubscriptionId
        );
        logger.info(`Using existing subscription: ${org.stripeSubscriptionId}`);
        return existingSubscription;
      } catch (error) {
        // Subscription might have been deleted, clear it
        if (error.code === 'resource_missing') {
          org.stripeSubscriptionId = undefined;
          await org.save();
        } else {
          throw error;
        }
      }
    }

    // Get or create meter
    const meter = await stripeMeterService.getOrCreateMeter();

    // Create price for metered billing with the meter
    // Note: In production, you might want to create prices upfront and reuse them
    const price = await stripe.prices.create({
      currency: 'usd',
      billing_scheme: 'per_unit',
      recurring: {
        interval: 'month', // Monthly billing cycle
        usage_type: 'metered',
        meter: meter.id, // Link to the meter for usage tracking
      },
      product_data: {
        name: 'API Usage',
        description: 'Usage-based billing for API requests',
      },
    });

    // Create subscription with metered pricing
    const subscription = await stripe.subscriptions.create({
      customer: org.stripeCustomerId,
      items: [
        {
          price: price.id,
          billing_thresholds: {
            usage_gte: 0, // Bill from first usage
          },
        },
      ],
      collection_method: 'charge_automatically',
      payment_behavior: 'default_incomplete',
      metadata: {
        orgId: org.id.toString(),
      },
    });

    // Update org with subscription ID and subscription item ID
    org.stripeSubscriptionId = subscription.id;
    if (subscription.items.data[0]) {
      org.stripeSubscriptionItemId = subscription.items.data[0].id;
    }
    await org.save();

    logger.info(`Created Stripe subscription ${subscription.id} for org: ${org.name}`);
    return subscription;
  } catch (error) {
    logger.error(`Error creating/retrieving subscription for org ${orgId}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create/retrieve subscription: ${error.message}`
    );
  }
};

/**
 * Get subscription by ID
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Stripe subscription object
 */
const getSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    logger.error(`Error retrieving subscription ${subscriptionId}:`, error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to retrieve subscription: ${error.message}`
    );
  }
};

/**
 * Cancel a subscription
 * @param {string} orgId - Organization ID
 * @param {boolean} immediately - Cancel immediately or at period end
 * @returns {Promise<Object>} Cancelled subscription
 */
const cancelSubscription = async (orgId, immediately = false) => {
  try {
    const org = await Org.findById(orgId);
    if (!org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
    }

    if (!org.stripeSubscriptionId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No subscription found for organization');
    }

    const subscription = await stripe.subscriptions.update(org.stripeSubscriptionId, {
      cancel_at_period_end: !immediately,
    });

    if (immediately) {
      await stripe.subscriptions.cancel(org.stripeSubscriptionId);
    }

    logger.info(`Cancelled subscription ${org.stripeSubscriptionId} for org: ${org.name}`);
    return subscription;
  } catch (error) {
    logger.error(`Error cancelling subscription for org ${orgId}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to cancel subscription: ${error.message}`
    );
  }
};

/**
 * Update subscription payment method
 * @param {string} orgId - Organization ID
 * @param {string} paymentMethodId - Stripe payment method ID
 * @returns {Promise<Object>} Updated subscription
 */
const updateSubscriptionPaymentMethod = async (orgId, paymentMethodId) => {
  try {
    const org = await Org.findById(orgId);
    if (!org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
    }

    if (!org.stripeSubscriptionId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No subscription found for organization');
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: org.stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(org.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update subscription default payment method
    const subscription = await stripe.subscriptions.update(org.stripeSubscriptionId, {
      default_payment_method: paymentMethodId,
    });

    logger.info(`Updated payment method for subscription ${org.stripeSubscriptionId}`);
    return subscription;
  } catch (error) {
    logger.error(`Error updating subscription payment method for org ${orgId}:`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to update payment method: ${error.message}`
    );
  }
};

module.exports = {
  getOrCreateSubscription,
  getSubscription,
  cancelSubscription,
  updateSubscriptionPaymentMethod,
};

