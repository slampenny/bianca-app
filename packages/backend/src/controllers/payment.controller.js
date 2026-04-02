// controllers/payments.controller.js
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { paymentService } = require('../services');
const { clientService } = require('../services');
const { assertCaregiverOrgAccess } = require('../utils/accessControl');

const createInvoiceFromConversations = catchAsync(async (req, res) => {
  const client = await clientService.getClientById(req.params.clientId);
  if (!client) {
    return res.status(httpStatus.NOT_FOUND).send({ message: 'Client not found' });
  }
  assertCaregiverOrgAccess(req.caregiver, client.org, 'You do not have access to this client');
  const invoice = await paymentService.createInvoiceFromConversations(req.params.clientId);
  res.status(httpStatus.CREATED).send(invoice);
});

const listInvoicesByOrg = catchAsync(async (req, res) => {
  assertCaregiverOrgAccess(req.caregiver, req.params.orgId, 'You do not have access to this organization');
  const filters = {
    status: req.query.status,
    dueDate: req.query.dueDate,
  };
  const invoices = await paymentService.listInvoicesByOrg(req.params.orgId, filters);
  res.send(invoices);
});

const listInvoicesByClient = catchAsync(async (req, res) => {
  const client = await clientService.getClientById(req.params.clientId);
  if (!client) {
    return res.status(httpStatus.NOT_FOUND).send({ message: 'Client not found' });
  }
  assertCaregiverOrgAccess(req.caregiver, client.org, 'You do not have access to this client');
  const filters = {
    status: req.query.status,
    dueDate: req.query.dueDate,
  };
  const invoices = await paymentService.listInvoicesByClient(req.params.clientId, filters);
  res.send(invoices);
});

const getUnbilledCostsByOrg = catchAsync(async (req, res) => {
  assertCaregiverOrgAccess(req.caregiver, req.params.orgId, 'You do not have access to this organization');
  const days = parseInt(req.query.days, 10) || 7;
  const unbilledCosts = await paymentService.getUnbilledCostsByOrg(req.params.orgId, days);
  res.send(unbilledCosts);
});

module.exports = {
  createInvoiceFromConversations,
  listInvoicesByOrg,
  listInvoicesByClient,
  getUnbilledCostsByOrg,
};
