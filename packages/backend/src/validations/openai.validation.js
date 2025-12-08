const Joi = require('joi');
const { objectId } = require('./custom.validation');

const forceRecovery = {
  params: Joi.object().keys({
    callId: Joi.string().required().description('Call ID to recover'),
  }),
  body: Joi.object().keys({
    reason: Joi.string().optional().description('Reason for recovery'),
  }),
};

const getStatus = {
  params: Joi.object().keys({
    callId: Joi.string().required().description('Call ID to check status'),
  }),
};

module.exports = {
  forceRecovery,
  getStatus,
}; 