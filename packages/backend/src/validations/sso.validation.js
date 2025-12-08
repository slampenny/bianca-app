const Joi = require('joi');

const login = {
  body: Joi.object().keys({
    provider: Joi.string().valid('google', 'microsoft').required(),
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    id: Joi.string().required(),
    picture: Joi.string().uri().optional(),
  }),
};

const verify = {
  body: Joi.object().keys({
    provider: Joi.string().valid('google', 'microsoft').required(),
    token: Joi.string().required(),
  }),
};

module.exports = {
  login,
  verify,
};
