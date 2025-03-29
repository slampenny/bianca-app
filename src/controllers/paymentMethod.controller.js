const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { paymentMethodService } = require('../services');

const createPaymentMethod = catchAsync(async (req, res) => {
  const paymentMethod = await paymentMethodService.createPaymentMethod(
    req.params.orgId,
    req.body.paymentMethodId
  );
  res.status(httpStatus.CREATED).send(paymentMethod);
});

const getOrgPaymentMethods = catchAsync(async (req, res) => {
  const paymentMethods = await paymentMethodService.getOrgPaymentMethods(req.params.orgId);
  res.send(paymentMethods);
});

const getPaymentMethod = catchAsync(async (req, res) => {
  const paymentMethod = await paymentMethodService.getPaymentMethodById(req.params.paymentMethodId);
  if (!paymentMethod) {
    res.status(httpStatus.NOT_FOUND).send();
    return;
  }
  res.send(paymentMethod);
});

const setDefaultPaymentMethod = catchAsync(async (req, res) => {
  const paymentMethod = await paymentMethodService.setDefaultPaymentMethod(
    req.params.orgId,
    req.params.paymentMethodId
  );
  res.send(paymentMethod);
});

const deletePaymentMethod = catchAsync(async (req, res) => {
  await paymentMethodService.deletePaymentMethod(
    req.params.orgId,
    req.params.paymentMethodId
  );
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createPaymentMethod,
  getOrgPaymentMethods,
  getPaymentMethod,
  setDefaultPaymentMethod,
  deletePaymentMethod,
};