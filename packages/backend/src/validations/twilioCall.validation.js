const Joi = require('joi');
const { objectId } = require('./custom.validation');

const initiate = {
  params: Joi.object().keys({
    clientId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  initiate,
};
