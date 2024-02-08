const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getConversation = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  getConversation,
};
