const Joi = require('joi');
const { objectId } = require('./custom.validation');

const previewDigest = {
  body: Joi.object().keys({
    clientId: Joi.string().required().custom(objectId),
    weekStart: Joi.string().optional().allow('', null),
  }),
};

const createDigest = {
  body: Joi.object().keys({
    clientId: Joi.string().required().custom(objectId),
    weekStart: Joi.string().optional().allow('', null),
  }),
};

const listDigests = {
  query: Joi.object().keys({
    clientId: Joi.string().custom(objectId).optional(),
    sortBy: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
  }),
};

const digestIdParam = {
  params: Joi.object().keys({
    digestId: Joi.string().required().custom(objectId),
  }),
};

module.exports = {
  previewDigest,
  createDigest,
  listDigests,
  digestIdParam,
};
