const Joi = require('joi');
const { objectId } = require('./custom.validation');

const initiate = {
  body: Joi.object().keys({
    clientId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  initiate,
};
