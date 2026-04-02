const Joi = require('joi');
const { objectId } = require('./custom.validation');

const callCompletionLogQuery = {
  query: Joi.object().keys({
    dateFrom: Joi.string().optional().allow(''),
    dateTo: Joi.string().optional().allow(''),
    clientId: Joi.string().custom(objectId).optional(),
    orgId: Joi.string().custom(objectId).optional(),
  }),
};

const alertAuditTrailQuery = {
  query: Joi.object().keys({
    dateFrom: Joi.string().optional().allow(''),
    dateTo: Joi.string().optional().allow(''),
    orgId: Joi.string().custom(objectId).optional(),
  }),
};

module.exports = {
  callCompletionLogQuery,
  alertAuditTrailQuery,
};
