const httpStatus = require('http-status');
const stripe = require('../config/stripe');
const { Org, PaymentMethod } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Attach a payment method to an organization
 * @param {string} orgId - The organization ID
 * @param {string} paymentMethodId - The Stripe payment method ID (created client-side)
 * @returns {Promise<Object>} The attached payment method
 */
const attachPaymentMethod = async (orgId, paymentMethodId) => {
  // Find the organization
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  try {
    // Ensure the org has a Stripe customer ID
    if (!org.stripeCustomerId) {
      // Create a customer in Stripe if needed
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: {
          orgId: org.id,
        },
      });
      org.stripeCustomerId = customer.id;
      await org.save();
      logger.info(`Created Stripe customer for org: ${org.name} (${org.id})`);
    }

    // Attach the payment method to the customer in Stripe
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: org.stripeCustomerId,
    });

    // Retrieve full payment method details
    const paymentMethodDetails = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Create a record in our database
    const paymentMethodData = {
      stripePaymentMethodId: paymentMethodDetails.id,
      org: orgId,
      type: paymentMethodDetails.type,
    };

    // Extract payment method details based on type
    if (paymentMethodDetails.type === 'card') {
      const { card } = paymentMethodDetails;
      paymentMethodData.brand = card.brand;
      paymentMethodData.last4 = card.last4;
      paymentMethodData.expMonth = card.exp_month;
      paymentMethodData.expYear = card.exp_year;
    } else if (paymentMethodDetails.type === 'us_bank_account' || paymentMethodDetails.type === 'bank_account') {
      const bankAccount = paymentMethodDetails.us_bank_account || paymentMethodDetails.bank_account;
      paymentMethodData.bankName = bankAccount.bank_name;
      paymentMethodData.last4 = bankAccount.last4;
      paymentMethodData.accountType = bankAccount.account_type;
    } else {
      // Handle unknown payment method types - keep the original type
      // Don't override the type, let it pass through
    }

    // Add billing details if available
    if (paymentMethodDetails.billing_details && 
        (paymentMethodDetails.billing_details.name || 
         paymentMethodDetails.billing_details.email || 
         paymentMethodDetails.billing_details.phone)) {
      paymentMethodData.billingDetails = {
        name: paymentMethodDetails.billing_details.name,
        email: paymentMethodDetails.billing_details.email,
        phone: paymentMethodDetails.billing_details.phone,
      };

      if (paymentMethodDetails.billing_details.address) {
        paymentMethodData.billingDetails.address = {
          line1: paymentMethodDetails.billing_details.address.line1,
          line2: paymentMethodDetails.billing_details.address.line2,
          city: paymentMethodDetails.billing_details.address.city,
          state: paymentMethodDetails.billing_details.address.state,
          postal_code: paymentMethodDetails.billing_details.address.postal_code,
          country: paymentMethodDetails.billing_details.address.country,
        };
      }
    }
    // Note: billingDetails will be undefined if not provided, which is the expected behavior
    // Explicitly set to undefined if no billing details to prevent Mongoose from creating empty object
    if (!paymentMethodData.billingDetails) {
      paymentMethodData.billingDetails = undefined;
    }

    // Check if this is the first payment method for the org
    const existingMethods = await PaymentMethod.countDocuments({ org: orgId });
    if (existingMethods === 0) {
      paymentMethodData.isDefault = true;
    } else {
      paymentMethodData.isDefault = false;
    }

    // Create the payment method in our database
    const dbPaymentMethod = await PaymentMethod.create(paymentMethodData);

    // Update the org with the payment method reference
    if (!org.paymentMethods) {
      org.paymentMethods = [];
    }
    org.paymentMethods.push(dbPaymentMethod.id);
    await org.save();

    return dbPaymentMethod;
  } catch (error) {
    logger.error(`Error attaching payment method to org ${orgId}:`, error);

    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      throw new ApiError(httpStatus.BAD_REQUEST, `Card error: ${error.message}`);
    } else if (error.type === 'StripeInvalidRequestError') {
      throw new ApiError(httpStatus.BAD_REQUEST, `Invalid request: ${error.message}`);
    }

    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error creating payment method');
  }
};

/**
 * Get a payment method by ID
 * @param {string} paymentMethodId - The payment method ID
 * @returns {Promise<Object>} The payment method
 */
const getPaymentMethod = async (paymentMethodId) => {
  // Check our database for the payment method
  const dbPaymentMethod = await PaymentMethod.findById(paymentMethodId);

  if (!dbPaymentMethod) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment method not found');
  }

  return dbPaymentMethod;
};

/**
 * List all payment methods for an organization
 * @param {string} orgId - The organization ID
 * @returns {Promise<Array>} List of payment methods
 */
const listPaymentMethods = async (orgId) => {
  const org = await Org.findById(orgId);
  if (!org) {
    return []; // Return empty array instead of throwing error
  }

  // Return payment methods from our database
  return PaymentMethod.find({ org: orgId }).sort({ isDefault: -1, createdAt: -1 });
};

/**
 * Update a payment method
 * @param {string} paymentMethodId - The payment method ID
 * @param {Object} updateBody - The update data
 * @returns {Promise<Object>} The updated payment method
 */
const updatePaymentMethod = async (paymentMethodId, updateBody) => {
  // First update in Stripe
  try {
    const dbPaymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!dbPaymentMethod) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Payment method not found');
    }

    // Determine what can be updated in Stripe
    const stripeUpdateData = {};

    if (updateBody.billingDetails) {
      stripeUpdateData.billing_details = {
        name: updateBody.billingDetails.name,
        email: updateBody.billingDetails.email,
        phone: updateBody.billingDetails.phone,
      };

      if (updateBody.billingDetails.address) {
        stripeUpdateData.billing_details.address = {
          line1: updateBody.billingDetails.address.line1,
          line2: updateBody.billingDetails.address.line2,
          city: updateBody.billingDetails.address.city,
          state: updateBody.billingDetails.address.state,
          postal_code: updateBody.billingDetails.address.postal_code,
          country: updateBody.billingDetails.address.country,
        };
      }
    }

    // Update in Stripe if there are valid fields to update
    if (Object.keys(stripeUpdateData).length > 0) {
      await stripe.paymentMethods.update(dbPaymentMethod.stripePaymentMethodId, stripeUpdateData);
    }

    // Then update in our database
    Object.assign(dbPaymentMethod, updateBody);
    await dbPaymentMethod.save();

    return dbPaymentMethod;
  } catch (error) {
    logger.error(`Error updating payment method ${paymentMethodId}:`, error);

    if (error.type === 'StripeInvalidRequestError') {
      throw new ApiError(httpStatus.BAD_REQUEST, `Invalid request: ${error.message}`);
    }

    // Re-throw the original error if it's already an ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error updating payment method');
  }
};

/**
 * Set a payment method as the default
 * @param {string} orgId - The organization ID
 * @param {string} paymentMethodId - The payment method ID
 * @returns {Promise<Object>} The updated payment method
 */
const setDefaultPaymentMethod = async (orgId, paymentMethodId) => {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  const paymentMethod = await PaymentMethod.findOne({
    _id: paymentMethodId,
    org: orgId,
  });

  if (!paymentMethod) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment method not found');
  }

  try {
    // First set as default in Stripe
    await stripe.customers.update(org.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethod.stripePaymentMethodId,
      },
    });

    // Then update in our database
    await PaymentMethod.updateMany({ org: orgId }, { $set: { isDefault: false } });

    paymentMethod.isDefault = true;
    await paymentMethod.save();

    return paymentMethod;
  } catch (error) {
    logger.error(`Error setting default payment method for org ${orgId}:`, error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error setting default payment method');
  }
};

/**
 * Detach a payment method from an organization
 * @param {string} orgId - The organization ID
 * @param {string} paymentMethodId - The payment method ID
 * @returns {Promise<string>} The detached payment method ID
 */
const detachPaymentMethod = async (orgId, paymentMethodId) => {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  const paymentMethod = await PaymentMethod.findOne({
    _id: paymentMethodId,
    org: orgId,
  });

  if (!paymentMethod) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment method not found');
  }

  // Check if it's the default payment method
  if (paymentMethod.isDefault) {
    // Find another payment method to set as default
    const otherPaymentMethod = await PaymentMethod.findOne({
      _id: { $ne: paymentMethodId },
      org: orgId,
    });

    if (otherPaymentMethod) {
      // Set the other payment method as default
      await setDefaultPaymentMethod(orgId, otherPaymentMethod._id);
    } else {
      // No other payment methods exist, so we can't delete the default
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot detach the default payment method. Set another payment method as default first.'
      );
    }
  }

  try {
    try {
      // First detach from Stripe
      await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);

      // Then delete from our database
      await PaymentMethod.deleteOne({ _id: paymentMethodId });

      // Remove reference from the org
      const index = org.paymentMethods.indexOf(paymentMethodId);
      if (index > -1) {
        org.paymentMethods.splice(index, 1);
        await org.save();
      }

      return paymentMethodId;
    } catch (stripeError) {
      // If the error is that the payment method isn't attached, we can proceed
      // with deleting it from our database anyway
      if (stripeError.message && stripeError.message.includes('not attached to a customer')) {
        logger.warn(`Payment method ${paymentMethodId} not found in Stripe, proceeding with local deletion`);
      } else {
        // For other Stripe errors, re-throw
        throw stripeError;
      }

      // Proceed with deleting from database and updating org
      await PaymentMethod.deleteOne({ _id: paymentMethodId });
    }
  } catch (error) {
    logger.error(`Error detaching payment method ${paymentMethodId}:`, error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error deleting payment method');
  }
};

/**
 * Create a payment method (alias for attachPaymentMethod)
 * @param {string} orgId - The organization ID
 * @param {string} paymentMethodId - The Stripe payment method ID
 * @returns {Promise<Object>} The created payment method
 */
const createPaymentMethod = async (orgId, paymentMethodId) => {
  return attachPaymentMethod(orgId, paymentMethodId);
};

/**
 * Get payment methods by organization (alias for listPaymentMethods)
 * @param {string} orgId - The organization ID
 * @returns {Promise<Array>} List of payment methods
 */
const getPaymentMethodsByOrg = async (orgId) => {
  return listPaymentMethods(orgId);
};

/**
 * Get payment method by ID (alias for getPaymentMethod)
 * @param {string} paymentMethodId - The payment method ID
 * @returns {Promise<Object>} The payment method
 */
const getPaymentMethodById = async (paymentMethodId) => {
  return getPaymentMethod(paymentMethodId);
};

/**
 * Delete a payment method (alias for detachPaymentMethod)
 * @param {string} paymentMethodId - The payment method ID
 * @returns {Promise<string>} The deleted payment method ID
 */
const deletePaymentMethod = async (paymentMethodId) => {
  const paymentMethod = await PaymentMethod.findById(paymentMethodId);
  if (!paymentMethod) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment method not found');
  }
  return detachPaymentMethod(paymentMethod.org, paymentMethodId);
};

/**
 * Get the default payment method for an organization
 * @param {string} orgId - The organization ID
 * @returns {Promise<Object|null>} The default payment method or null
 */
const getDefaultPaymentMethod = async (orgId) => {
  const org = await Org.findById(orgId);
  if (!org) {
    return null;
  }
  
  return PaymentMethod.findOne({ org: orgId, isDefault: true });
};

module.exports = {
  attachPaymentMethod,
  createPaymentMethod,
  getPaymentMethod,
  getPaymentMethodById,
  listPaymentMethods,
  getPaymentMethodsByOrg,
  updatePaymentMethod,
  setDefaultPaymentMethod,
  detachPaymentMethod,
  deletePaymentMethod,
  getDefaultPaymentMethod,
};
