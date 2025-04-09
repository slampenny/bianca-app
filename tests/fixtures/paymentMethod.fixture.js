const mongoose = require('mongoose');
const faker = require('faker');
const { PaymentMethod } = require('../../src/models');

const paymentMethodOne = {
  stripePaymentMethodId: 'pm_test_' + faker.datatype.uuid().replace(/-/g, ''),
  type: 'card',
  isDefault: false,
  brand: 'visa',
  last4: '4242',
  expMonth: 12,
  expYear: new Date().getFullYear() + 2,
  billingDetails: {
    name: faker.name.findName(),
    email: faker.internet.email(),
    phone: faker.phone.phoneNumber(),
    address: {
      line1: faker.address.streetAddress(),
      city: faker.address.city(),
      state: faker.address.stateAbbr(),
      postal_code: faker.address.zipCode(),
      country: 'US'
    }
  }
};

const paymentMethodTwo = {
  stripePaymentMethodId: 'pm_test_' + faker.datatype.uuid().replace(/-/g, ''),
  type: 'card',
  isDefault: false,
  brand: 'mastercard',
  last4: '8210',
  expMonth: 6,
  expYear: new Date().getFullYear() + 3,
  billingDetails: {
    name: faker.name.findName(),
    email: faker.internet.email(),
    phone: faker.phone.phoneNumber()
  }
};

/**
 * Create payment methods for an organization
 * @param {Organization} org - Organization to add payment methods to
 * @param {Array} paymentMethodsArray - Array of payment method objects
 * @returns {Promise<Array>} - Array of created payment methods
 */
const insertPaymentMethods = async (org, paymentMethodsArray) => {
  const paymentMethods = paymentMethodsArray.map((paymentMethod) => ({
    ...paymentMethod,
    org: org._id,
  }));
  
  return PaymentMethod.insertMany(paymentMethods);
};

module.exports = {
  paymentMethodOne,
  paymentMethodTwo,
  insertPaymentMethods,
};