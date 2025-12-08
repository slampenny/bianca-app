// controllers/payments.controller.js
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { paymentService } = require('../services');

const createInvoiceFromConversations = catchAsync(async (req, res) => {
  const invoice = await paymentService.createInvoiceFromConversations(req.params.patientId);
  res.status(httpStatus.CREATED).send(invoice);
});

const listInvoicesByOrg = catchAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    dueDate: req.query.dueDate,
  };
  const invoices = await paymentService.listInvoicesByOrg(req.params.orgId, filters);
  res.send(invoices);
});

const listInvoicesByPatient = catchAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    dueDate: req.query.dueDate,
  };
  const invoices = await paymentService.listInvoicesByPatient(req.params.patientId, filters);
  res.send(invoices);
});

const getUnbilledCostsByOrg = catchAsync(async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const unbilledCosts = await paymentService.getUnbilledCostsByOrg(req.params.orgId, days);
  res.send(unbilledCosts);
});

module.exports = {
  createInvoiceFromConversations,
  listInvoicesByOrg,
  listInvoicesByPatient,
  getUnbilledCostsByOrg,
};
