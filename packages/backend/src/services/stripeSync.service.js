const stripe = require('../config/stripe');
const logger = require('../config/logger');
const { Invoice, LineItem, Conversation, Org, Patient } = require('../models');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');

/**
 * Stripe Sync Service
 * Maintains synchronization between local Invoice/LineItem models and Stripe invoices
 * This preserves patient-level tracking while using Stripe for billing
 */

/**
 * Sync Stripe invoice to local Invoice model
 * @param {string} stripeInvoiceId - Stripe invoice ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Local invoice object
 */
const syncStripeInvoice = async (stripeInvoiceId, orgId) => {
  try {
    // Retrieve invoice from Stripe with line items
    const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId, {
      expand: ['lines.data.price.product', 'subscription'],
    });

    const org = await Org.findById(orgId);
    if (!org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
    }

    // Check if local invoice already exists
    let localInvoice = await Invoice.findOne({ stripeInvoiceId });

    if (localInvoice) {
      // Update existing invoice
      localInvoice.status = mapStripeInvoiceStatus(stripeInvoice.status);
      localInvoice.totalAmount = stripeInvoice.amount_paid / 100; // Convert from cents
      localInvoice.issueDate = new Date(stripeInvoice.created * 1000);
      localInvoice.dueDate = stripeInvoice.due_date
        ? new Date(stripeInvoice.due_date * 1000)
        : new Date(stripeInvoice.created * 1000 + 30 * 24 * 60 * 60 * 1000);
      localInvoice.paidAt = stripeInvoice.status_transitions?.paid_at
        ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
        : null;
      localInvoice.stripeSynced = true;
      localInvoice.stripeSyncedAt = new Date();
      await localInvoice.save();
    } else {
      // Create new local invoice
      // Generate invoice number from Stripe invoice number or create custom one
      const invoiceNumber = stripeInvoice.number || `INV-${stripeInvoice.id.slice(-6)}`;

      localInvoice = await Invoice.create({
        org: orgId,
        invoiceNumber,
        issueDate: new Date(stripeInvoice.created * 1000),
        dueDate: stripeInvoice.due_date
          ? new Date(stripeInvoice.due_date * 1000)
          : new Date(stripeInvoice.created * 1000 + 30 * 24 * 60 * 60 * 1000),
        status: mapStripeInvoiceStatus(stripeInvoice.status),
        totalAmount: stripeInvoice.amount_paid / 100,
        stripeInvoiceId,
        stripeSubscriptionId: stripeInvoice.subscription,
        stripeSynced: true,
        stripeSyncedAt: new Date(),
        paidAt: stripeInvoice.status_transitions?.paid_at
          ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
          : null,
      });
    }

    // Sync line items
    // Note: Stripe line items don't have patient-level granularity
    // We'll create line items based on metadata or maintain separate tracking
    await syncStripeInvoiceLineItems(stripeInvoice, localInvoice);

    logger.info(`Synced Stripe invoice ${stripeInvoiceId} to local invoice ${localInvoice._id}`);
    return localInvoice;
  } catch (error) {
    logger.error(`Error syncing Stripe invoice ${stripeInvoiceId}:`, error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to sync Stripe invoice: ${error.message}`
    );
  }
};

/**
 * Sync Stripe invoice line items to local LineItem models
 * @param {Object} stripeInvoice - Stripe invoice object
 * @param {Object} localInvoice - Local invoice object
 */
const syncStripeInvoiceLineItems = async (stripeInvoice, localInvoice) => {
  try {
    // Extract patient information from Stripe line item metadata
    // This assumes we're storing patientId in metadata when reporting usage
    for (const stripeLineItem of stripeInvoice.lines.data) {
      const metadata = stripeLineItem.metadata || {};
      const patientId = metadata.patientId;

      if (patientId) {
        // Check if line item already exists
        let localLineItem = await LineItem.findOne({
          invoiceId: localInvoice._id,
          patientId,
          stripeInvoiceItemId: stripeLineItem.id,
        });

        if (!localLineItem) {
          // Create new line item
          localLineItem = await LineItem.create({
            patientId,
            invoiceId: localInvoice._id,
            amount: stripeLineItem.amount / 100, // Convert from cents
            description: stripeLineItem.description || 'Usage-based billing',
            periodStart: stripeInvoice.period_start
              ? new Date(stripeInvoice.period_start * 1000)
              : new Date(),
            periodEnd: stripeInvoice.period_end
              ? new Date(stripeInvoice.period_end * 1000)
              : new Date(),
            quantity: stripeLineItem.quantity || 1,
            unitPrice: stripeLineItem.price?.unit_amount
              ? stripeLineItem.price.unit_amount / 100
              : stripeLineItem.amount / 100,
            stripeInvoiceItemId: stripeLineItem.id,
            stripeSynced: true,
            stripeSyncedAt: new Date(),
          });
        } else {
          // Update existing line item
          localLineItem.amount = stripeLineItem.amount / 100;
          localLineItem.quantity = stripeLineItem.quantity || 1;
          localLineItem.stripeSynced = true;
          localLineItem.stripeSyncedAt = new Date();
          await localLineItem.save();
        }
      }
    }
  } catch (error) {
    logger.error(`Error syncing Stripe invoice line items:`, error);
    // Don't throw - allow invoice sync to complete even if line items fail
  }
};

/**
 * Map Stripe invoice status to local invoice status
 * @param {string} stripeStatus - Stripe invoice status
 * @returns {string} Local invoice status
 */
const mapStripeInvoiceStatus = (stripeStatus) => {
  const statusMap = {
    draft: 'draft',
    open: 'pending',
    paid: 'paid',
    uncollectible: 'overdue',
    void: 'void',
  };
  return statusMap[stripeStatus] || 'pending';
};

/**
 * Link conversations to Stripe invoice based on usage metadata
 * This maintains the conversation-to-line-item linkage
 * @param {string} stripeInvoiceId - Stripe invoice ID
 * @param {Object} localInvoice - Local invoice object
 */
const linkConversationsToInvoice = async (stripeInvoiceId, localInvoice) => {
  try {
    const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId, {
      expand: ['lines.data'],
    });

    // Extract conversation IDs from line item metadata
    const conversationIds = [];
    for (const lineItem of stripeInvoice.lines.data) {
      const metadata = lineItem.metadata || {};
      if (metadata.conversationId) {
        conversationIds.push(metadata.conversationId);
      }
    }

    if (conversationIds.length > 0) {
      // Find corresponding line items and link conversations
      const lineItems = await LineItem.find({ invoiceId: localInvoice._id });

      for (const lineItem of lineItems) {
        // Find conversations for this patient in the billing period
        const conversations = await Conversation.find({
          patientId: lineItem.patientId,
          lineItemId: null, // Not yet linked
          endTime: {
            $gte: lineItem.periodStart,
            $lte: lineItem.periodEnd,
          },
        });

        // Link conversations to line item
        await Conversation.updateMany(
          { _id: { $in: conversations.map((c) => c._id) } },
          { $set: { lineItemId: lineItem._id } }
        );
      }
    }
  } catch (error) {
    logger.error(`Error linking conversations to invoice:`, error);
    // Don't throw - this is a best-effort operation
  }
};

/**
 * Sync all pending Stripe invoices for an organization
 * @param {string} orgId - Organization ID
 */
const syncOrgInvoices = async (orgId) => {
  try {
    const org = await Org.findById(orgId);
    if (!org || !org.stripeCustomerId) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Organization or Stripe customer not found');
    }

    // Get all invoices from Stripe
    const stripeInvoices = await stripe.invoices.list({
      customer: org.stripeCustomerId,
      limit: 100,
    });

    // Sync each invoice
    for (const stripeInvoice of stripeInvoices.data) {
      await syncStripeInvoice(stripeInvoice.id, orgId);
    }

    logger.info(`Synced ${stripeInvoices.data.length} invoices for org ${orgId}`);
  } catch (error) {
    logger.error(`Error syncing org invoices:`, error);
    throw error;
  }
};

module.exports = {
  syncStripeInvoice,
  syncStripeInvoiceLineItems,
  linkConversationsToInvoice,
  syncOrgInvoices,
  mapStripeInvoiceStatus,
};

