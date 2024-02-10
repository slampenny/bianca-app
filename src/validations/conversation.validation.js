const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getConversation = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

const createConversationForUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

const addMessageToConversation = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId),
  }),
  body: Joi.object().keys({
    role: Joi.string().required().valid('user', 'assistant', 'admin', 'system'),
    content: Joi.string().required(),
  }),
};

module.exports = {
  getConversation,
  addMessageToConversation,
  createConversationForUser
};
