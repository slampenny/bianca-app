// controllers/payments.controller.js
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { paymentsService } = require('../services');

const createInvoiceFromConversations = catchAsync(async (req, res) => {
  const invoice = await paymentsService.createInvoiceFromConversations(req.params.patientId);
  res.status(httpStatus.CREATED).send(invoice);
});

const listInvoicesByOrg = catchAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    dueDate: req.query.dueDate,
  };
  const invoices = await paymentsService.listInvoicesByOrg(req.params.orgId, filters);
  res.send(invoices);
});

const listInvoicesByPatient = catchAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    dueDate: req.query.dueDate,
  };
  const invoices = await paymentsService.listInvoicesByPatient(req.params.patientId, filters);
  res.send(invoices);
});

module.exports = {
  createInvoiceFromConversations,
  listInvoicesByOrg,
  listInvoicesByPatient,
};
