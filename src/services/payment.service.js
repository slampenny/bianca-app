const stripe = require('../config/stripe');
const httpStatus = require('http-status');
const { Org, Conversation, Invoice, LineItem } = require('../models');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');
const config = require('../config/config');

const createPaymentMethod = async (orgId, paymentMethodId) => {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }

  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: org.stripeCustomerId,
  });

  org.paymentMethods.push(paymentMethod.id);
  await org.save();

  return paymentMethod;
};

const getPaymentMethod = async (paymentMethodId) => {
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  return paymentMethod;
};

const updatePaymentMethod = async (paymentMethodId, updateBody) => {
  const paymentMethod = await stripe.paymentMethods.update(paymentMethodId, updateBody);
  return paymentMethod;
};

const deletePaymentMethod = async (orgId, paymentMethodId) => {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }

  await stripe.paymentMethods.detach(paymentMethodId);

  const index = org.paymentMethods.indexOf(paymentMethodId);
  if (index > -1) {
    org.paymentMethods.splice(index, 1);
  }
  await org.save();

  return paymentMethodId;
};

/**
 * Creates an invoice by aggregating unbilled conversations and embedding line items.
 * This function creates the invoice (which the customer will later pay)
 * and then updates the conversations to reference the created invoice.
 */
const createInvoiceFromConversations = async (patientId) => {
  // Aggregate all unbilled conversations for the given patient.
  const unchargedConversations = await Conversation.aggregateUnchargedConversations(patientId);
  
  if (!unchargedConversations.length) {
    throw new Error('No uncharged conversations found');
  }

  // Build line items and compute the total amount.
  let totalAmount = 0;
  const lineItems = unchargedConversations.map((group) => {
    const { totalDuration } = group;
    const amount = calculateAmount(totalDuration);
    totalAmount += amount;
    return {
      patientId,
      amount,
      description: `Billing for ${totalDuration} seconds of conversation`
    };
  });

  // Create the invoice. Note: No paymentMethod or transactionId is attached,
  // as the invoice represents a bill to be paid by the customer later.
  const invoice = await Invoice.create({
    caregiverId: patientId, // adjust as needed if caregiverId differs from patientId
    date: new Date(),
    status: 'pending',
    lineItems,
    totalAmount
  });

  // Link all conversations to the created invoice.
  // Since line items are embedded and don't have independent _ids,
  // we simply mark the conversations as invoiced by setting their lineItemId to the invoice's _id.
  const conversationIds = unchargedConversations.reduce((acc, group) => {
    return acc.concat(group.conversationIds);
  }, []);

  await Conversation.updateMany(
    { _id: { $in: conversationIds } },
    { $set: { lineItemId: mongoose.Types.ObjectId(invoice._id) } }
  );

  return invoice;
};

const calculateAmount = (totalDuration) => {
  const ratePerMinute = config.billing.ratePerMinute; // Change this to your actual rate
  const totalMinutes = totalDuration / 60;
  return totalMinutes * ratePerMinute;
};

module.exports = {
  createPaymentMethod,
  getPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  createInvoiceFromConversations,
};