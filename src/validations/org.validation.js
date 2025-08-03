const Joi = require('joi');
const validator = require('validator');
const { objectId } = require('./custom.validation');

const createOrg = {
  body: Joi.object().keys({
    org: Joi.object().keys({
      email: Joi.string().required().email(),
      name: Joi.string().required(),
      phone: Joi.string()
        .required()
        .custom((value, helpers) => {
          if (!validator.isMobilePhone(value)) {
            return helpers.message('Invalid phone number');
          }
          return value;
        }),
      logo: Joi.string().optional(),
      caregivers: Joi.array().items(Joi.string().custom(objectId)).optional(),
      patients: Joi.array().items(Joi.string().custom(objectId)).optional(),
    }),
    caregiver: Joi.object().keys({
      email: Joi.string().required().email(),
      name: Joi.string().required(),
      phone: Joi.string().required(),
      password: Joi.string().required(),
      org: Joi.string().custom(objectId),
      role: Joi.string().required().valid('orgAdmin', 'staff'),
      patients: Joi.array().items(Joi.string().custom(objectId)),
    }),
  }),
};

const getOrgs = {
  query: Joi.object().keys({
    name: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getOrg = {
  params: Joi.object().keys({
    orgId: Joi.string().custom(objectId),
  }),
};

const updateOrg = {
  params: Joi.object().keys({
    orgId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email().optional(),
      name: Joi.string().optional(),
      phone: Joi.string()
        .optional()
        .custom((value, helpers) => {
          if (value && !validator.isMobilePhone(value)) {
            return helpers.message('Invalid phone number');
          }
          return value;
        }),
      logo: Joi.string().optional(),
      caregivers: Joi.array().items(Joi.string().custom(objectId)).optional(),
      patients: Joi.array().items(Joi.string().custom(objectId)).optional(),
    })
    .min(1)
    .unknown(false), // Disallow fields that are not defined in the schema
};

const deleteOrg = {
  params: Joi.object().keys({
    orgId: Joi.string().custom(objectId),
  }),
};

const setRole = {
  params: Joi.object().keys({
    orgId: Joi.required().custom(objectId),
  }),
  body: Joi.object().keys({
    role: Joi.string().required().valid('orgAdmin', 'staff'),
  }),
};

module.exports = {
  createOrg,
  getOrgs,
  getOrg,
  updateOrg,
  deleteOrg,
  setRole,
};
