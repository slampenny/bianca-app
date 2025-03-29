const httpStatus = require('http-status');
const { Org, Patient, Conversation, Invoice, LineItem } = require('../models');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');
const config = require('../config/config');

const createInvoiceFromConversations = async (patientId) => {
  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }
  
  const orgId = patient.org;
  
  const unchargedConversations = await Conversation.aggregateUnchargedConversations(patientId);
  if (!unchargedConversations.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No uncharged conversations found');
  }
  
  const { totalDuration, conversationIds, startDate, endDate } = unchargedConversations[0];
  
  const lastInvoice = await Invoice.findOne({}, {}, { sort: { createdAt: -1 } });
  const nextNum = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split('-')[1]) + 1 : 1;
  const invoiceNumber = `INV-${nextNum.toString().padStart(6, '0')}`;
  
  const invoice = await Invoice.create({
    org: orgId,
    invoiceNumber,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'pending',
    totalAmount: 0
  });
  
  const amount = calculateAmount(totalDuration);
  const lineItem = await LineItem.create({
    patientId,
    invoiceId: invoice._id,
    amount,
    description: `Billing for ${totalDuration} seconds of conversation`,
    periodStart: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    periodEnd: endDate || new Date(),
    quantity: totalDuration / 60,
    unitPrice: config.billing.ratePerMinute
  });
  
  invoice.totalAmount = amount;
  await invoice.save();
  
  await Conversation.updateMany(
    { _id: { $in: conversationIds } },
    { $set: { lineItemId: lineItem._id } }
  );
  
  return await Invoice.findById(invoice._id).populate('lineItems');
};

const calculateAmount = (totalDuration) => {
  const totalMinutes = totalDuration / 60;
  return totalMinutes * config.billing.ratePerMinute;
};

module.exports = {
  createInvoiceFromConversations,
};
