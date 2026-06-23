const Joi = require('joi');
const validator = require('validator');
const { password, objectId } = require('./custom.validation');

const emergencyContactEntry = Joi.object()
  .keys({
    id: Joi.string().custom(objectId).optional(),
    name: Joi.string().allow('').optional(),
    relationship: Joi.string().allow('').optional(),
    phone: Joi.string().allow('').optional(),
    email: Joi.string()
      .trim()
      .allow('')
      .optional()
      .custom((value, helpers) => {
        if (value === '' || value == null) return value;
        if (!validator.isEmail(value)) {
          return helpers.message('Invalid emergency contact email');
        }
        return value;
      }),
  })
  .optional();

const familyDigestRecipient = Joi.object()
  .keys({
    id: Joi.string().custom(objectId).optional(),
    name: Joi.string().allow('').optional(),
    relationship: Joi.string().allow('').optional(),
    email: Joi.string()
      .trim()
      .allow('')
      .optional()
      .custom((value, helpers) => {
        if (value === '' || value == null) return value;
        if (!validator.isEmail(value)) {
          return helpers.message('Invalid family digest recipient email');
        }
        return value;
      }),
    familyDigestEmail: Joi.object()
      .keys({
        enabled: Joi.boolean().optional(),
      })
      .optional(),
  })
  .optional();

const emergencyContact = Joi.object()
  .keys({
    name: Joi.string().allow('').optional(),
    relationship: Joi.string().allow('').optional(),
    phone: Joi.string().allow('').optional(),
    email: Joi.string()
      .trim()
      .allow('')
      .optional()
      .custom((value, helpers) => {
        if (value === '' || value == null) return value;
        if (!validator.isEmail(value)) {
          return helpers.message('Invalid emergency contact email');
        }
        return value;
      }),
    familyDigestEmail: Joi.object()
      .keys({
        enabled: Joi.boolean().optional(),
      })
      .optional(),
  })
  .optional();

const createClient = {
  body: Joi.object()
    .keys({
    org: Joi.string().custom(objectId).optional(),
    email: Joi.string().required().email(),
    avatar: Joi.string().optional(),
    name: Joi.string().trim().allow('').optional(),
    firstName: Joi.string().trim().allow('').optional(),
    lastName: Joi.string().trim().allow('').optional(),
    preferredName: Joi.string().allow('').optional(),
    age: Joi.number().integer().min(0).max(150).optional(),
    notes: Joi.string().allow('').optional(),
    phone: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!validator.isMobilePhone(value)) {
          return helpers.message('Invalid phone number');
        }
        return value;
      }),
    preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'ko', 'hu').optional(),
    consented: Joi.boolean().optional(),
    consentedAt: Joi.date().optional(),
    consentEmailVersion: Joi.string().optional(),
    room: Joi.string().trim().allow('', null).optional(),
    moveInDate: Joi.date().optional(),
    emergencyContact,
    emergencyContacts: Joi.array().items(emergencyContactEntry).optional(),
    familyDigestRecipients: Joi.array().items(familyDigestRecipient).optional(),
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
  })
    .custom((value, helpers) => {
      const hasFull = value.name && String(value.name).trim() !== '';
      const hasFirst = value.firstName && String(value.firstName).trim() !== '';
      if (!hasFull && !hasFirst) {
        return helpers.message('Either a full "name" or a "firstName" is required');
      }
      return value;
    }),
};

const getClients = {
  query: Joi.object()
    .keys({
      name: Joi.string(),
      sortBy: Joi.string(),
      limit: Joi.number().integer(),
      page: Joi.number().integer(),
    })
    .unknown(true),
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
      firstName: Joi.string().trim().allow('').optional(),
      lastName: Joi.string().trim().allow('').optional(),
      preferredName: Joi.string().allow('').optional(),
      age: Joi.number().integer().min(0).max(150).optional(),
      notes: Joi.string().allow('').optional(),
      phone: Joi.string()
        .optional()
        .custom((value, helpers) => {
          if (!validator.isMobilePhone(value)) {
            return helpers.message('Invalid phone number');
          }
          return value;
        }),
      preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'ko', 'hu').optional(),
      isEmailVerified: Joi.boolean().optional(),
      consented: Joi.boolean().optional(),
      consentedAt: Joi.date().optional(),
      consentEmailVersion: Joi.string().optional(),
      room: Joi.string().trim().allow('', null).optional(),
      moveInDate: Joi.date().optional(),
      emergencyContact,
      emergencyContacts: Joi.array().items(emergencyContactEntry).optional(),
      familyDigestRecipients: Joi.array().items(familyDigestRecipient).optional(),
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

const getCallsByClient = {
  params: Joi.object().keys({
    clientId: Joi.string().custom(objectId),
  }),
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getClientOnboarding = {
  params: Joi.object().keys({
    clientId: Joi.string().custom(objectId),
  }),
  query: Joi.object().keys({
    day: Joi.number().integer().min(1).max(4).optional(),
  }),
};

const getClientsOnboardingRollups = {
  query: Joi.object().keys({}),
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

const sendFamilyDigestEmailVerification = {
  params: Joi.object().keys({
    clientId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      recipientId: Joi.string().custom(objectId).optional(),
    })
    .optional(),
};

const verifyFamilyDigestEmail = {
  query: Joi.object().keys({
    token: Joi.string().optional(),
    format: Joi.string().optional(),
  }),
  body: Joi.object().keys({
    token: Joi.string().optional(),
  }),
};

const familyPortalClientParams = {
  params: Joi.object().keys({
    clientId: Joi.string().custom(objectId).required(),
  }),
};

const inviteFamilyPortal = {
  ...familyPortalClientParams,
  body: Joi.object().keys({
    recipientId: Joi.string().custom(objectId).required(),
  }),
};

const revokeFamilyPortal = {
  ...familyPortalClientParams,
  body: Joi.object().keys({
    recipientId: Joi.string().custom(objectId).required(),
  }),
};

const getFamilyPortalStatus = {
  ...familyPortalClientParams,
};

module.exports = {
  createClient,
  getConversationsByClient,
  getCallsByClient,
  getClientOnboarding,
  getClientsOnboardingRollups,
  getClients,
  getClient,
  updateClient,
  uploadClientAvatar,
  deleteClient,
  getCaregivers,
  getUnassignedClients,
  assignUnassignedClients,
  sendFamilyDigestEmailVerification,
  verifyFamilyDigestEmail,
  inviteFamilyPortal,
  revokeFamilyPortal,
  getFamilyPortalStatus,
};
