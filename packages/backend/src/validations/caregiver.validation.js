const Joi = require('joi');
const { password, objectId } = require('./custom.validation');

const createCaregiver = {
  body: Joi.object().keys({
    orgId: Joi.custom(objectId).optional(),
    email: Joi.string().required().email(),
    avatar: Joi.string().optional(),
    name: Joi.string().required(),
    phone: Joi.string().optional(),
    password: Joi.string().custom(password).optional(),
    role: Joi.string().valid('invited', 'staff', 'orgAdmin', 'superAdmin').optional(),
    active: Joi.boolean().optional(),
    externalId: Joi.string().trim().allow('', null).optional(),
    preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ko', 'ar', 'hu').optional(),
    clients: Joi.array().items(Joi.string().custom(objectId)),
  }),
};

const getCaregivers = {
  query: Joi.object().keys({
    org: Joi.string().custom(objectId),
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getCaregiver = {
  params: Joi.object().keys({
    caregiverId: Joi.string().custom(objectId),
  }),
};

const updateCaregiver = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      id: Joi.required().custom(objectId).optional(),
      org: Joi.required().custom(objectId).optional(),
      email: Joi.string().email().optional(),
      avatar: Joi.string().optional(),
      name: Joi.string().optional(),
      phone: Joi.string().optional(),
      isEmailVerified: Joi.boolean().optional(),
      password: Joi.string().required().custom(password).optional(),
      themePreference: Joi.string().valid('healthcare', 'colorblind').optional(),
      preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ko', 'ar', 'hu').optional(),
      externalId: Joi.string().trim().allow('', null).optional(),
      active: Joi.boolean().optional(),
      clients: Joi.array().items(Joi.string().custom(objectId)),
    })
    .min(1)
    .unknown(false), // Disallow fields that are not defined in the schema
};

const uploadCaregiverAvatar = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
  }),
};

const deleteCaregiver = {
  params: Joi.object().keys({
    caregiverId: Joi.string().custom(objectId),
  }),
};

const addClient = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
    clientId: Joi.required().custom(objectId),
  }),
};

const removeClient = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
    clientId: Joi.required().custom(objectId),
  }),
};

const updateThemePreference = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
  }),
  body: Joi.object().keys({
    themePreference: Joi.string().valid('healthcare', 'colorblind').required(),
  }),
};

const getClients = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
  }),
};

module.exports = {
  createCaregiver,
  getCaregivers,
  getCaregiver,
  updateCaregiver,
  uploadCaregiverAvatar,
  deleteCaregiver,
  addClient,
  removeClient,
  updateThemePreference,
  getClients,
};
