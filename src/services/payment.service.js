const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Org, Patient, Conversation, Invoice, LineItem } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');

const createInvoiceFromConversations = async (patientId) => {
  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  const orgId = patient.org;

  // Use direct query instead of aggregation for better test compatibility
  const unchargedConversations = await Conversation.find({ 
    patientId: new mongoose.Types.ObjectId(patientId),
    lineItemId: null 
  });
  
  if (!unchargedConversations.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No uncharged conversations found');
  }

  const totalDuration = unchargedConversations.reduce((sum, conv) => sum + conv.duration, 0);
  const conversationIds = unchargedConversations.map(conv => conv._id);
  
  // Check if there are any conversations to bill (even if total duration is 0)
  if (!conversationIds || conversationIds.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No uncharged conversations found');
  }

  const lastInvoice = await Invoice.findOne({}, {}, { sort: { createdAt: -1 } });
  const nextNum = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split('-')[1]) + 1 : 1;
  const invoiceNumber = `INV-${nextNum.toString().padStart(6, '0')}`;

  const invoice = await Invoice.create({
    org: orgId,
    invoiceNumber,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'pending',
    totalAmount: 0,
  });

  const amount = calculateAmount(totalDuration);
  const lineItem = await LineItem.create({
    patientId,
    invoiceId: invoice._id,
    amount,
    description: `Billing for ${totalDuration} seconds of conversation`,
    periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to 30 days ago
    periodEnd: new Date(), // Default to now
    quantity: totalDuration / 60,
    unitPrice: config.billing.ratePerMinute,
  });

  invoice.totalAmount = amount;
  await invoice.save();

  await Conversation.updateMany({ _id: { $in: conversationIds } }, { $set: { lineItemId: lineItem._id } });

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
  // Get organization info
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  // Get all patients for this organization
  const patients = await Patient.find({ org: orgId });
  
  // Calculate date range
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get unbilled conversations from the specified period
  const unbilledConversations = await Conversation.find({
    patientId: { $in: patients.map(p => p._id) },
    lineItemId: null, // Not yet billed
    endTime: { $gte: startDate }, // From the specified period
    cost: { $gt: 0 } // Has a cost
  }).populate('patientId');
  
  // Group conversations by patient
  const patientCosts = {};
  let totalUnbilledCost = 0;
  
  for (const conversation of unbilledConversations) {
    const patientId = conversation.patientId._id.toString();
    const patientName = conversation.patientId.name;
    
    if (!patientCosts[patientId]) {
      patientCosts[patientId] = {
        patientId,
        patientName,
        conversationCount: 0,
        totalCost: 0,
        conversations: []
      };
    }
    
    patientCosts[patientId].conversationCount++;
    patientCosts[patientId].totalCost += conversation.cost;
    patientCosts[patientId].conversations.push({
      conversationId: conversation._id,
      startTime: conversation.startTime,
      duration: conversation.duration,
      cost: conversation.cost,
      status: conversation.status
    });
    
    totalUnbilledCost += conversation.cost;
  }
  
  // Convert to array and sort by total cost (highest first)
  const patientCostsArray = Object.values(patientCosts).sort((a, b) => b.totalCost - a.totalCost);
  
  return {
    orgId: org._id,
    orgName: org.name,
    totalUnbilledCost,
    patientCosts: patientCostsArray,
    period: {
      days,
      startDate,
      endDate: new Date()
    }
  };
};

module.exports = {
  createInvoiceFromConversations,
  listInvoicesByOrg,
  listInvoicesByPatient,
  calculateAmount,
  getUnbilledCostsByOrg,
};
