const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const httpStatus = require('http-status');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

const createPaymentMethod = async (userId, paymentMethodId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: user.stripeCustomerId,
  });

  user.paymentMethods.push(paymentMethod.id);
  await user.save();

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

const deletePaymentMethod = async (userId, paymentMethodId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  await stripe.paymentMethods.detach(paymentMethodId);

  const index = user.paymentMethods.indexOf(paymentMethodId);
  if (index > -1) {
    user.paymentMethods.splice(index, 1);
  }
  await user.save();

  return paymentMethodId;
};

const mongoose = require('mongoose');
const { Conversation } = require('./path-to-your-models');
const Invoice = require('./path-to-your-invoice-model'); // Assuming you have this model
const LineItem = require('./path-to-your-lineItem-model'); // Assuming you have this model

const createLineItemsAndLinkConversations = async (caregiverId, invoiceId) => {
  const unchargedConversations = await aggregateUnchargedConversations(caregiverId);

  for (const userConversations of unchargedConversations) {
    const { userId, totalDuration, conversationIds } = userConversations;
    
    // Create a new line item for this user's conversations
    const lineItem = await LineItem.create({
      invoiceId: invoiceId,
      userId: userId,
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
  // Define how you calculate billing amount based on the conversation duration
};

module.exports = {
  createPaymentMethod,
  getPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  createLineItemsAndLinkConversations,
};