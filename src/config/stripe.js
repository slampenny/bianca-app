// config/stripe.js
const Stripe = require('stripe');
const config = require('./config');
const logger = require('./logger');

// Initialize Stripe with the secret key
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16', // Lock in a specific Stripe API version
});

// Log Stripe mode on initialization
logger.info(`Stripe initialized in ${config.stripe.mode} mode`);

// Add test helpers in development and test environments
if (config.env !== 'production') {
  /**
   * Get test card details for testing Stripe integration
   * @returns {Object} Object containing various test card information
   */
  stripe.getTestCards = () => {
    return {
      visa: {
        number: '4242424242424242', // Always succeeds
        exp_month: 12,
        exp_year: new Date().getFullYear() + 1,
        cvc: '123',
      },
      visaDebit: {
        number: '4000056655665556', // For debit card testing
        exp_month: 12,
        exp_year: new Date().getFullYear() + 1,
        cvc: '123',
      },
      visaDecline: {
        number: '4000000000000002', // Always declined
        exp_month: 12,
        exp_year: new Date().getFullYear() + 1,
        cvc: '123',
      },
      visaInsufficientFunds: {
        number: '4000000000009995', // Insufficient funds failure
        exp_month: 12,
        exp_year: new Date().getFullYear() + 1,
        cvc: '123',
      },
      mastercard: {
        number: '5555555555554444',
        exp_month: 12,
        exp_year: new Date().getFullYear() + 1,
        cvc: '123',
      },
      amex: {
        number: '378282246310005',
        exp_month: 12,
        exp_year: new Date().getFullYear() + 1,
        cvc: '1234',
      },
    };
  };

  /**
   * Create a test payment method for testing
   * @param {string} type - The payment method type (card, bank_account)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} A Stripe payment method object
   */
  stripe.createTestPaymentMethod = async (type = 'card', options = {}) => {
    // Default to a test Visa card if not specified
    const defaultCard = stripe.getTestCards().visa;

    const paymentMethodData = {
      type,
      [type]:
        type === 'card'
          ? {
              number: options.number || defaultCard.number,
              exp_month: options.exp_month || defaultCard.exp_month,
              exp_year: options.exp_year || defaultCard.exp_year,
              cvc: options.cvc || defaultCard.cvc,
            }
          : {},
      billing_details: options.billing_details || {
        name: 'Test User',
        email: 'test@example.com',
        address: {
          line1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          postal_code: '94111',
          country: 'US',
        },
      },
    };

    return stripe.paymentMethods.create(paymentMethodData);
  };
}

module.exports = stripe;
