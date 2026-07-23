const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createDigest = {
  body: Joi.object().keys({
    digestDate: Joi.string().optional().allow('', null),
    sendEmail: Joi.boolean().optional(),
    caregiverId: Joi.string().custom(objectId).optional(),
  }),
};

const listDigests = {
  query: Joi.object().keys({
    caregiverId: Joi.string().custom(objectId).optional(),
    digestDate: Joi.string().optional().allow('', null),
    includeAllVersions: Joi.boolean().optional(),
    /** orgAdmin/superAdmin: latest digest per caregiver for digestDate across the org */
    scope: Joi.string().valid('org').optional(),
    sortBy: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(200),
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
