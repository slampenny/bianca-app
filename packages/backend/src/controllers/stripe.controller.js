// controllers/stripe.controller.js
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');
const stripe = require('../config/stripe');
const stripeWebhookService = require('../services/stripeWebhook.service');
const logger = require('../config/logger');

/**
 * Get Stripe publishable key
 * @route GET /stripe/publishable-key
 */
const getPublishableKey = catchAsync(async (req, res) => {
  if (!config.stripe.publishableKey) {
    return res.status(httpStatus.SERVICE_UNAVAILABLE).json({
      error: 'Stripe configuration not available'
    });
  }

  res.json({
    publishableKey: config.stripe.publishableKey,
    mode: config.stripe.mode
  });
});

/**
 * Handle Stripe webhook events
 * @route POST /stripe/webhook
 */
const handleWebhook = catchAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = config.stripe.webhookSecret;

  if (!webhookSecret) {
    logger.error('Stripe webhook secret not configured');
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Webhook secret not configured'
    });
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(httpStatus.BAD_REQUEST).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    await stripeWebhookService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (error) {
    logger.error(`Error processing webhook:`, error);
    // Return 200 to prevent Stripe from retrying immediately
    // Stripe will retry based on its own retry logic
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
});

module.exports = {
  getPublishableKey,
  handleWebhook,
};








