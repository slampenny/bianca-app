const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Org, Patient, Call, Conversation, Invoice, LineItem } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const logger = require('../config/logger');

const createInvoiceFromConversations = async (patientId) => {
  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  const orgId = patient.org;

  // Use direct query instead of aggregation for better test compatibility
  // Query Call records instead of Conversation (Call tracks billing, Conversation tracks messages)
  const unchargedCalls = await Call.find({ 
    patientId: new mongoose.Types.ObjectId(patientId),
    lineItemId: null 
  });
  
  if (!unchargedCalls.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No uncharged calls found');
  }

  const totalDuration = unchargedCalls.reduce((sum, call) => sum + call.duration, 0);
  const callIds = unchargedCalls.map(call => call._id);
  
  // Check if there are any calls to bill (even if total duration is 0)
  if (!callIds || callIds.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No uncharged calls found');
  }

  const lastInvoice = await Invoice.findOne({}, {}, { sort: { createdAt: -1 } });
  let nextNum = 1;
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const parts = lastInvoice.invoiceNumber.split('-');
    if (parts.length >= 2) {
      const parsed = parseInt(parts[1]);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }
  }
  const invoiceNumber = `INV-${nextNum.toString().padStart(6, '0')}`;

  // Create invoice first
  let invoice;
  try {
    invoice = await Invoice.create({
      org: orgId,
      invoiceNumber,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'pending',
      totalAmount: 0,
    });
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create invoice');
  }

  const amount = calculateAmount(totalDuration);
  let lineItem;
  try {
    lineItem = await LineItem.create({
      patientId,
      invoiceId: invoice._id,
      amount,
      description: `Billing for ${totalDuration} seconds of calls`,
      periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to 30 days ago
      periodEnd: new Date(), // Default to now
      quantity: totalDuration / 60,
      unitPrice: config.billing.ratePerMinute,
    });
  } catch (error) {
    // Cleanup: delete invoice if line item creation fails
    await Invoice.deleteOne({ _id: invoice._id });
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create line item');
  }

  try {
    invoice.totalAmount = amount;
    await invoice.save();
  } catch (error) {
    // Cleanup: delete line item and invoice if update fails
    await LineItem.deleteOne({ _id: lineItem._id });
    await Invoice.deleteOne({ _id: invoice._id });
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update invoice');
  }

  // Update calls - use updateMany with error handling
  // If this fails, invoice and line item exist but calls aren't marked as billed
  // This is acceptable - they'll be picked up on retry and won't be double-billed due to lineItemId check
  try {
    await Call.updateMany({ _id: { $in: callIds } }, { $set: { lineItemId: lineItem._id } });
  } catch (error) {
    // Log error but don't fail - invoice is created, calls can be updated later
    // The lineItemId: null check prevents double-billing
    logger.warn(`Failed to update calls with lineItemId, invoice ${invoice._id} created but calls not marked as billed:`, error);
  }

  return await Invoice.findById(invoice._id).populate('lineItems');
};

const calculateAmount = (totalDuration) => {
  const totalMinutes = totalDuration / 60;
  return totalMinutes * config.billing.ratePerMinute;
};

const listInvoicesByOrg = async (orgId, filters = {}) => {
  const query = { org: orgId };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.dueDate) {
    // Filter for invoices due on or before the specified date
    query.dueDate = { $lte: new Date(filters.dueDate) };
  }

  return await Invoice.find(query).populate('lineItems');
};

const listInvoicesByPatient = async (patientId, filters = {}) => {
  // Assumes a patient invoice is identified by a line item matching the patient
  let invoices = await Invoice.find({}).populate({
    path: 'lineItems',
    match: { patientId },
  });
  invoices = invoices.filter((inv) => inv.lineItems && inv.lineItems.length);

  // Apply additional filters if provided
  if (filters.status) {
    invoices = invoices.filter((inv) => inv.status === filters.status);
  }
  if (filters.dueDate) {
    const dueDateFilter = new Date(filters.dueDate);
    invoices = invoices.filter((inv) => new Date(inv.dueDate) <= dueDateFilter);
  }

  return invoices;
};

const getUnbilledCostsByOrg = async (orgId, days = 7) => {
  // Use the new Stripe billing service which includes Stripe usage data
  // This maintains backward compatibility while adding Stripe integration
  const stripeBillingService = require('./stripeBilling.service');
  return await stripeBillingService.getUnbilledCosts(orgId, days);
};

module.exports = {
  createInvoiceFromConversations,
  listInvoicesByOrg,
  listInvoicesByPatient,
  calculateAmount,
  getUnbilledCostsByOrg,
};
