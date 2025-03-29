const httpStatus = require('http-status');
const stripe = require('../config/stripe');
const PaymentMethod = require('../models/paymentMethod.model');
const Org = require('../models/org.model');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Create and attach a payment method to organization
 * @param {ObjectId} orgId - The organization id
 * @param {string} paymentMethodId - The Stripe payment method id
 * @returns {Promise<PaymentMethod>}
 */
const createPaymentMethod = async (orgId, paymentMethodId) => {
  // Find the organization
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  // Make sure the org has a Stripe customer ID
  if (!org.stripeCustomerId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Organization has no Stripe customer ID');
  }

  try {
    // Attach the payment method to the customer in Stripe
    const stripePaymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: org.stripeCustomerId,
    });

    // Get payment method details
    const paymentMethodData = {
      stripePaymentMethodId: stripePaymentMethod.id,
      org: orgId,
      type: stripePaymentMethod.type,
    };

    // Parse details based on payment method type
    if (stripePaymentMethod.type === 'card') {
      const { card } = stripePaymentMethod;
      paymentMethodData.brand = card.brand;
      paymentMethodData.last4 = card.last4;
      paymentMethodData.expMonth = card.exp_month;
      paymentMethodData.expYear = card.exp_year;
    } else if (stripePaymentMethod.type === 'us_bank_account' || stripePaymentMethod.type === 'bank_account') {
      const bankAccount = stripePaymentMethod.us_bank_account || stripePaymentMethod.bank_account;
      paymentMethodData.bankName = bankAccount.bank_name;
      paymentMethodData.last4 = bankAccount.last4;
      paymentMethodData.accountType = bankAccount.account_type;
    }

    // Add billing details if available
    if (stripePaymentMethod.billing_details) {
      paymentMethodData.billingDetails = {
        name: stripePaymentMethod.billing_details.name,
        email: stripePaymentMethod.billing_details.email,
        phone: stripePaymentMethod.billing_details.phone,
      };

      if (stripePaymentMethod.billing_details.address) {
        paymentMethodData.billingDetails.address = {
          line1: stripePaymentMethod.billing_details.address.line1,
          line2: stripePaymentMethod.billing_details.address.line2,
          city: stripePaymentMethod.billing_details.address.city,
          state: stripePaymentMethod.billing_details.address.state,
          postal_code: stripePaymentMethod.billing_details.address.postal_code,
          country: stripePaymentMethod.billing_details.address.country,
        };
      }
    }

    // Check if this is the first payment method for the org
    const existingMethods = await PaymentMethod.countDocuments({ org: orgId });
    if (existingMethods === 0) {
      paymentMethodData.isDefault = true;
    }

    // Create the payment method in the database
    const paymentMethod = await PaymentMethod.create(paymentMethodData);

    // Add the payment method to the org's list if not already there
    if (!org.paymentMethods) {
      org.paymentMethods = [];
    }
    
    if (!org.paymentMethods.includes(paymentMethod.id)) {
      org.paymentMethods.push(paymentMethod.id);
      await org.save();
    }

    return paymentMethod;
  } catch (error) {
    logger.error('Error creating payment method:', error);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      error.message || 'Error creating payment method'
    );
  }
};

/**
 * Get payment method by id
 * @param {ObjectId} id - The payment method id
 * @returns {Promise<PaymentMethod>}
 */
const getPaymentMethodById = async (id) => {
  return PaymentMethod.findById(id);
};

/**
 * Get all payment methods for an organization
 * @param {ObjectId} orgId - The organization id
 * @returns {Promise<PaymentMethod[]>}
 */
const getOrgPaymentMethods = async (orgId) => {
  return PaymentMethod.find({ org: orgId }).sort({ isDefault: -1, createdAt: -1 });
};

/**
 * Set a payment method as default
 * @param {ObjectId} orgId - The organization id
 * @param {ObjectId} paymentMethodId - The payment method id
 * @returns {Promise<PaymentMethod>}
 */
const setDefaultPaymentMethod = async (orgId, paymentMethodId) => {
  // Find the payment method
  const paymentMethod = await PaymentMethod.findOne({
    _id: paymentMethodId,
    org: orgId,
  });

  if (!paymentMethod) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment method not found');
  }

  // Update all payment methods to not be default
  await PaymentMethod.updateMany(
    { org: orgId },
    { $set: { isDefault: false } }
  );

  // Set this one as default
  paymentMethod.isDefault = true;
  await paymentMethod.save();

  // Also set as default in Stripe
  const org = await Org.findById(orgId);
  if (org && org.stripeCustomerId) {
    await stripe.customers.update(org.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethod.stripePaymentMethodId,
      },
    });
  }

  return paymentMethod;
};

/**
 * Delete a payment method
 * @param {ObjectId} orgId - The organization id
 * @param {ObjectId} paymentMethodId - The payment method id
 * @returns {Promise<void>}
 */
const deletePaymentMethod = async (orgId, paymentMethodId) => {
  // Find the payment method
  const paymentMethod = await PaymentMethod.findOne({
    _id: paymentMethodId,
    org: orgId,
  });

  if (!paymentMethod) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment method not found');
  }

  // Check if it's the default payment method
  if (paymentMethod.isDefault) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot delete the default payment method. Set another payment method as default first.'
    );
  }

  // Detach from Stripe
  await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);

  // Remove from org
  await Org.findByIdAndUpdate(orgId, {
    $pull: { paymentMethods: paymentMethodId },
  });

  // Delete from database
  await PaymentMethod.deleteOne({ _id: paymentMethodId });
};

module.exports = {
  createPaymentMethod,
  getPaymentMethodById,
  getOrgPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
};