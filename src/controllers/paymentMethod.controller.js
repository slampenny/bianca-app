// controllers/paymentMethod.controller.js
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { paymentMethodService } = require('../services');
const PaymentMethodDTO = require('../dtos/paymentMethod.dto');

/**
 * Attach a payment method to an organization
 * @route POST /orgs/:orgId/payment-methods
 */
const attachPaymentMethod = catchAsync(async (req, res) => {
  // The frontend sends the payment method ID created using Stripe.js
  const paymentMethod = await paymentMethodService.attachPaymentMethod(req.params.orgId, req.body.paymentMethodId);
  res.status(httpStatus.CREATED).send(PaymentMethodDTO(paymentMethod));
});

/**
 * Get all payment methods for an organization
 * @route GET /orgs/:orgId/payment-methods
 */
const getOrgPaymentMethods = catchAsync(async (req, res) => {
  const paymentMethods = await paymentMethodService.listPaymentMethods(req.params.orgId);
  res.send(paymentMethods.map(PaymentMethodDTO));
});

/**
 * Get a payment method by ID
 * @route GET /orgs/:orgId/payment-methods/:paymentMethodId
 */
const getPaymentMethod = catchAsync(async (req, res) => {
  const paymentMethod = await paymentMethodService.getPaymentMethod(req.params.paymentMethodId);
  if (!paymentMethod) {
    res.status(httpStatus.NOT_FOUND).send();
    return;
  }
  res.send(PaymentMethodDTO(paymentMethod));
});

/**
 * Set a payment method as default
 * @route PATCH /orgs/:orgId/payment-methods/:paymentMethodId
 */
const setDefaultPaymentMethod = catchAsync(async (req, res) => {
  const paymentMethod = await paymentMethodService.setDefaultPaymentMethod(req.params.orgId, req.params.paymentMethodId);
  res.send(PaymentMethodDTO(paymentMethod));
});

/**
 * Detach a payment method from an organization
 * @route DELETE /orgs/:orgId/payment-methods/:paymentMethodId
 */
const detachPaymentMethod = catchAsync(async (req, res) => {
  await paymentMethodService.detachPaymentMethod(req.params.orgId, req.params.paymentMethodId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  attachPaymentMethod,
  getOrgPaymentMethods,
  getPaymentMethod,
  setDefaultPaymentMethod,
  detachPaymentMethod,
};
