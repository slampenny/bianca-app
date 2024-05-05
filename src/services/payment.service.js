const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const httpStatus = require('http-status');
const { Org, Conversation, Invoice, LineItem } = require('../models');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');

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

const createLineItemsAndLinkConversations = async (patientId, invoiceId) => {
  const unchargedConversations = await aggregateUnchargedConversations(patientId);

  for (const patientConversations of unchargedConversations) {
    const { patientId, totalDuration, conversationIds } = patientConversations;
    
    // Create a new line item for this patient's conversations
    const lineItem = await LineItem.create({
      invoiceId: invoiceId,
      patientId: patientId,
      amount: calculateAmount(totalDuration), // You need to define how to calculate the amount based on duration
      description: `Billing for ${totalDuration} seconds of conversation`
    });

    // Link conversations to the newly created lineItem
    await linkConversationsToLineItem(conversationIds, lineItem._id);
  }
};

const aggregateUnchargedConversations = async (caregiverId) => {
  // This function remains largely unchanged, ensure it selects conversations with lineItemId: null
};

const linkConversationsToLineItem = async (conversationIds, lineItemId) => {
  await Conversation.updateMany(
    { _id: { $in: conversationIds } },
    { $set: { lineItemId: mongoose.Types.ObjectId(lineItemId) } }
  );
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
  createLineItemsAndLinkConversations,
};