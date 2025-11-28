const stripe = require('../config/stripe');
const logger = require('../config/logger');
const stripeSyncService = require('./stripeSync.service');
const { Org } = require('../models');

/**
 * Stripe Webhook Service
 * Handles Stripe webhook events for billing and subscription management
 */

/**
 * Handle Stripe webhook event
 * @param {Object} event - Stripe webhook event
 * @returns {Promise<void>}
 */
const handleWebhookEvent = async (event) => {
  logger.info(`Processing Stripe webhook: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'invoice.finalized':
        await handleInvoiceFinalized(event.data.object);
        break;
      case 'invoice.created':
        await handleInvoiceCreated(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        logger.debug(`Unhandled webhook event type: ${event.type}`);
    }
  } catch (error) {
    logger.error(`Error handling webhook event ${event.type}:`, error);
    throw error; // Re-throw to let Stripe retry
  }
};

/**
 * Handle invoice.paid event
 * @param {Object} stripeInvoice - Stripe invoice object
 */
const handleInvoicePaid = async (stripeInvoice) => {
  try {
    const orgId = stripeInvoice.metadata?.orgId;
    if (!orgId) {
      logger.warn(`Invoice ${stripeInvoice.id} missing orgId metadata`);
      return;
    }

    // Sync invoice to local database
    const localInvoice = await stripeSyncService.syncStripeInvoice(stripeInvoice.id, orgId);
    
    // Link conversations to invoice
    await stripeSyncService.linkConversationsToInvoice(stripeInvoice.id, localInvoice);

    logger.info(`Invoice ${stripeInvoice.id} paid and synced for org ${orgId}`);
  } catch (error) {
    logger.error(`Error handling invoice.paid:`, error);
    throw error;
  }
};

/**
 * Handle invoice.payment_failed event
 * @param {Object} stripeInvoice - Stripe invoice object
 */
const handleInvoicePaymentFailed = async (stripeInvoice) => {
  try {
    const orgId = stripeInvoice.metadata?.orgId;
    if (!orgId) {
      logger.warn(`Invoice ${stripeInvoice.id} missing orgId metadata`);
      return;
    }

    // Sync invoice to local database
    await stripeSyncService.syncStripeInvoice(stripeInvoice.id, orgId);

    // TODO: Create alert for payment failure
    logger.warn(`Invoice ${stripeInvoice.id} payment failed for org ${orgId}`);
  } catch (error) {
    logger.error(`Error handling invoice.payment_failed:`, error);
    throw error;
  }
};

/**
 * Handle invoice.finalized event
 * @param {Object} stripeInvoice - Stripe invoice object
 */
const handleInvoiceFinalized = async (stripeInvoice) => {
  try {
    const orgId = stripeInvoice.metadata?.orgId;
    if (!orgId) {
      logger.warn(`Invoice ${stripeInvoice.id} missing orgId metadata`);
      return;
    }

    // Sync invoice to local database
    await stripeSyncService.syncStripeInvoice(stripeInvoice.id, orgId);

    logger.info(`Invoice ${stripeInvoice.id} finalized for org ${orgId}`);
  } catch (error) {
    logger.error(`Error handling invoice.finalized:`, error);
    throw error;
  }
};

/**
 * Handle invoice.created event
 * @param {Object} stripeInvoice - Stripe invoice object
 */
const handleInvoiceCreated = async (stripeInvoice) => {
  try {
    const orgId = stripeInvoice.metadata?.orgId;
    if (!orgId) {
      logger.warn(`Invoice ${stripeInvoice.id} missing orgId metadata`);
      return;
    }

    // Sync invoice to local database
    await stripeSyncService.syncStripeInvoice(stripeInvoice.id, orgId);

    logger.info(`Invoice ${stripeInvoice.id} created for org ${orgId}`);
  } catch (error) {
    logger.error(`Error handling invoice.created:`, error);
    throw error;
  }
};

/**
 * Handle customer.subscription.created event
 * @param {Object} subscription - Stripe subscription object
 */
const handleSubscriptionCreated = async (subscription) => {
  try {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) {
      logger.warn(`Subscription ${subscription.id} missing orgId metadata`);
      return;
    }

    const org = await Org.findById(orgId);
    if (org) {
      org.stripeSubscriptionId = subscription.id;
      if (subscription.items.data[0]) {
        org.stripeSubscriptionItemId = subscription.items.data[0].id;
      }
      await org.save();
      logger.info(`Subscription ${subscription.id} created for org ${orgId}`);
    }
  } catch (error) {
    logger.error(`Error handling subscription.created:`, error);
    throw error;
  }
};

/**
 * Handle customer.subscription.updated event
 * @param {Object} subscription - Stripe subscription object
 */
const handleSubscriptionUpdated = async (subscription) => {
  try {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) {
      logger.warn(`Subscription ${subscription.id} missing orgId metadata`);
      return;
    }

    const org = await Org.findById(orgId);
    if (org) {
      org.stripeSubscriptionId = subscription.id;
      if (subscription.items.data[0]) {
        org.stripeSubscriptionItemId = subscription.items.data[0].id;
      }
      await org.save();
      logger.info(`Subscription ${subscription.id} updated for org ${orgId}`);
    }
  } catch (error) {
    logger.error(`Error handling subscription.updated:`, error);
    throw error;
  }
};

/**
 * Handle customer.subscription.deleted event
 * @param {Object} subscription - Stripe subscription object
 */
const handleSubscriptionDeleted = async (subscription) => {
  try {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) {
      logger.warn(`Subscription ${subscription.id} missing orgId metadata`);
      return;
    }

    const org = await Org.findById(orgId);
    if (org) {
      org.stripeSubscriptionId = undefined;
      org.stripeSubscriptionItemId = undefined;
      await org.save();
      logger.info(`Subscription ${subscription.id} deleted for org ${orgId}`);
    }
  } catch (error) {
    logger.error(`Error handling subscription.deleted:`, error);
    throw error;
  }
};

module.exports = {
  handleWebhookEvent,
};

