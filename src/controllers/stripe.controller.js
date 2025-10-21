// controllers/stripe.controller.js
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');

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

module.exports = {
  getPublishableKey,
};

