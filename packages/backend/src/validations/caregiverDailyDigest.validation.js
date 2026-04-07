const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createDigest = {
  body: Joi.object().keys({
    digestDate: Joi.string().optional().allow('', null),
    sendEmail: Joi.boolean().optional(),
  }),
};

const listDigests = {
  query: Joi.object().keys({
    caregiverId: Joi.string().custom(objectId).optional(),
    digestDate: Joi.string().optional().allow('', null),
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
  createDigest,
  listDigests,
  digestIdParam,
};
