const Joi = require('joi');
const { objectId } = require('./custom.validation');

const searchCaregivers = {
  query: Joi.object().keys({
    q: Joi.string().trim().min(2).max(200).required(),
    limit: Joi.number().integer().min(1).max(50).default(20),
    page: Joi.number().integer().min(1).default(1),
    sortBy: Joi.string().optional(),
  }),
};

const impersonate = {
  body: Joi.object().keys({
    caregiverId: Joi.string().custom(objectId).required(),
  }),
};

const searchOrgs = {
  query: Joi.object().keys({
    q: Joi.string().trim().min(2).max(200).required(),
    limit: Joi.number().integer().min(1).max(50).default(20),
    page: Joi.number().integer().min(1).default(1),
    sortBy: Joi.string().optional(),
  }),
};

const orgIdParam = {
  params: Joi.object().keys({
    orgId: Joi.string().custom(objectId).required(),
  }),
};

/** Promote to super admin or demote super admin to org admin (super admin only). */
const setCaregiverRole = {
  params: Joi.object().keys({
    caregiverId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    role: Joi.string().valid('superAdmin', 'orgAdmin').required(),
  }),
};

module.exports = {
  searchCaregivers,
  impersonate,
  searchOrgs,
  orgIdParam,
  setCaregiverRole,
};
