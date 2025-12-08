const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getConversation = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId),
  }),
};

const createConversationForPatient = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId),
  }),
};

const addMessageToConversation = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId),
  }),
  body: Joi.object().keys({
    role: Joi.string().required().valid('patient', 'assistant', 'system', 'debug-user'),
    content: Joi.string().required(),
  }),
};

module.exports = {
  getConversation,
  addMessageToConversation,
  createConversationForPatient,
};
