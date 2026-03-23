const Joi = require('joi');
const validator = require('validator');
const { password, objectId } = require('./custom.validation');

const createClient = {
  body: Joi.object().keys({
    org: Joi.string().custom(objectId).optional(),
    email: Joi.string().required().email(),
    avatar: Joi.string().optional(),
    name: Joi.string().required(),
    phone: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!validator.isMobilePhone(value)) {
          return helpers.message('Invalid phone number');
        }
        return value;
      }),
    preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar').optional(),
    consented: Joi.boolean().optional(),
    consentedAt: Joi.date().optional(),
    consentEmailVersion: Joi.string().optional(),
    caregivers: Joi.array().optional(),
    schedules: Joi.array()
      .items(
        Joi.object().keys({
          client: Joi.string().custom(objectId).optional(),
          nextCallDate: Joi.string().optional(),
          frequency: Joi.string().valid('daily', 'weekly', 'monthly'),
          intervals: Joi.array().items(
            Joi.object().keys({
              day: Joi.number().integer().min(0).max(6),
              weeks: Joi.number().integer().optional(),
            })
          ),
          time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
          isActive: Joi.boolean(),
        })
      )
      .optional(),
  }),
};

const getClients = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getClient = {
  params: Joi.object().keys({
    clientId: Joi.string().custom(objectId),
  }),
};

const updateClient = {
  params: Joi.object().keys({
    clientId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      id: Joi.string().custom(objectId).optional(),
      org: Joi.string().custom(objectId).optional(),
      avatar: Joi.string().optional(),
      email: Joi.string().email().optional(),
      name: Joi.string().optional(),
      phone: Joi.string()
        .optional()
        .custom((value, helpers) => {
          if (!validator.isMobilePhone(value)) {
            return helpers.message('Invalid phone number');
          }
          return value;
        }),
      preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar').optional(),
      isEmailVerified: Joi.boolean().optional(),
      consented: Joi.boolean().optional(),
      consentedAt: Joi.date().optional(),
      consentEmailVersion: Joi.string().optional(),
      caregivers: Joi.array().optional(),
      schedules: Joi.array()
        .items(
          Joi.object().keys({
            id: Joi.required().custom(objectId),
            client: Joi.string().custom(objectId).optional(),
            nextCallDate: Joi.string().optional(),
            frequency: Joi.string().valid('daily', 'weekly', 'monthly'),
            intervals: Joi.array().items(
              Joi.object().keys({
                _id: Joi.string().custom(objectId).optional(),
                day: Joi.number().integer().min(0).max(6),
                weeks: Joi.number().integer().optional(),
              })
            ),
            time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
            isActive: Joi.boolean(),
          })
        )
        .optional(),
    })
    .min(1)
    .unknown(false),
};

const uploadClientAvatar = {
  params: Joi.object().keys({
    clientId: Joi.required().custom(objectId),
  }),
};

const deleteClient = {
  params: Joi.object().keys({
    clientId: Joi.string().custom(objectId),
  }),
};

const getConversationsByClient = {
  params: Joi.object().keys({
    clientId: Joi.string().custom(objectId),
  }),
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getCaregivers = {
  params: Joi.object().keys({
    clientId: Joi.string().custom(objectId),
  }),
};

const getUnassignedClients = {
  params: Joi.object().keys({}),
  query: Joi.object().keys({}),
  body: Joi.object().keys({}),
};

const assignUnassignedClients = {
  body: Joi.object().keys({
    caregiverId: Joi.string().required().custom(objectId),
    clientIds: Joi.array().items(Joi.string().custom(objectId)).min(1).required(),
  }),
};

module.exports = {
  createClient,
  getConversationsByClient,
  getClients,
  getClient,
  updateClient,
  uploadClientAvatar,
  deleteClient,
  getCaregivers,
  getUnassignedClients,
  assignUnassignedClients,
};
