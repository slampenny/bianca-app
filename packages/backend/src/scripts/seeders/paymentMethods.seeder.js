const { PaymentMethod } = require('../../models');
const paymentMethodFixture = require('../../../tests/fixtures/paymentMethod.fixture');

/**
 * Seed payment methods for an organization
 * Creates multiple payment methods with different states for testing:
 * - At least 2 payment methods (one default, one non-default)
 * - Multiple payment methods to test removal safely
 * @param {Object} org - Organization to seed payment methods for
 * @returns {Promise<Array>} Array of created payment methods
 */
async function seedPaymentMethods(org) {
  console.log('Seeding PaymentMethods for org:', org._id);
  
  const { paymentMethodOne, paymentMethodTwo, insertPaymentMethods } = paymentMethodFixture;
  
  // Create payment methods with different states
  const paymentMethodsToSeed = [
    {
      ...paymentMethodOne,
      isDefault: true, // First one is default
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: new Date().getFullYear() + 2,
    },
    {
      ...paymentMethodTwo,
      isDefault: false, // Second one is NOT default (so we can test setting it as default)
      brand: 'mastercard',
      last4: '5555',
      expMonth: 6,
      expYear: new Date().getFullYear() + 3,
    },
    // Add a third payment method for safe removal testing
    {
      stripePaymentMethodId: `pm_test_seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'card',
      isDefault: false,
      brand: 'amex',
      last4: '0005',
      expMonth: 3,
      expYear: new Date().getFullYear() + 1,
      billingDetails: {
        name: 'Test User',
        email: 'test@example.com',
      },
    },
  ];

  // Insert payment methods
  const paymentMethods = await insertPaymentMethods(org, paymentMethodsToSeed);
  console.log(`Seeded ${paymentMethods.length} PaymentMethods`);
  
  return paymentMethods;
}

/**
 * Clear all payment methods for an organization (useful for testing empty state)
 * @param {Object} org - Organization to clear payment methods for
 * @returns {Promise<void>}
 */
async function clearPaymentMethods(org) {
  await PaymentMethod.deleteMany({ org: org._id });
  console.log('Cleared payment methods for org:', org._id);
}

module.exports = {
  seedPaymentMethods,
  clearPaymentMethods,
};

