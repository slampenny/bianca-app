const Joi = require('joi');
const { objectId } = require('./custom.validation');

const attachPaymentMethod = {
  params: Joi.object().keys({
    orgId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    paymentMethodId: Joi.string().required(),
  }),
};

const getOrgPaymentMethods = {
  params: Joi.object().keys({
    orgId: Joi.string().required().custom(objectId),
  }),
};

const getPaymentMethod = {
  params: Joi.object().keys({
    orgId: Joi.string().required().custom(objectId),
    paymentMethodId: Joi.string().required().custom(objectId),
  }),
};

const setDefaultPaymentMethod = {
  params: Joi.object().keys({
    orgId: Joi.string().required().custom(objectId),
    paymentMethodId: Joi.string().required().custom(objectId),
  }),
};

const detachPaymentMethod = {
  params: Joi.object().keys({
    orgId: Joi.string().required().custom(objectId),
    paymentMethodId: Joi.string().required().custom(objectId),
  }),
};

module.exports = {
  attachPaymentMethod,
  getOrgPaymentMethods,
  getPaymentMethod,
  setDefaultPaymentMethod,
  detachPaymentMethod,
};
