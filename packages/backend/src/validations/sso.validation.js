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

const exchangeCode = {
  body: Joi.object().keys({
    provider: Joi.string().valid('google', 'microsoft').required(),
    code: Joi.string().required(),
    redirectUri: Joi.string().uri().required(),
    codeVerifier: Joi.string().optional(),
  }),
};

module.exports = {
  login,
  verify,
  exchangeCode,
};
