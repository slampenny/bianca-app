const Joi = require('joi');
const { objectId } = require('./custom.validation');

const initiateCall = {
  body: Joi.object().keys({
    patientId: Joi.string().custom(objectId).required(),
    callNotes: Joi.string().max(500).optional(),
  }),
};

const updateCallStatus = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    status: Joi.string()
      .valid('initiating', 'ringing', 'answered', 'connected', 'ended', 'failed', 'busy', 'no_answer')
      .required(),
    outcome: Joi.string()
      .valid('answered', 'no_answer', 'busy', 'failed', 'voicemail')
      .optional(),
    notes: Joi.string().max(500).optional(),
  }),
};

const endCall = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    outcome: Joi.string()
      .valid('answered', 'no_answer', 'busy', 'failed', 'voicemail')
      .required(),
    notes: Joi.string().max(500).optional(),
  }),
};

const getCallStatus = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId).required(),
  }),
};

const getConversationWithCallDetails = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  initiateCall,
  updateCallStatus,
  endCall,
  getCallStatus,
  getConversationWithCallDetails,
};
