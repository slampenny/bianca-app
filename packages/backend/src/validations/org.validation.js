const Joi = require('joi');
const validator = require('validator');
const { objectId } = require('./custom.validation');
const { MAX_ONBOARDING_DAYS, FACILITY_TYPES } = require('../services/onboardingPlan.service');
const { HH_MM_PATTERN } = require('../utils/digestScheduler.utils');

const voiceOnboardingQuestionSchema = Joi.object().keys({
  id: Joi.string().trim().min(1).max(100).required(),
  prompt: Joi.string().trim().min(1).max(1000).required(),
  compressionPriority: Joi.boolean().optional(),
});

const voiceOnboardingDaySchema = Joi.object().keys({
  dayNumber: Joi.number().integer().min(0).max(MAX_ONBOARDING_DAYS).optional(),
  theme: Joi.string().trim().max(200).allow('').optional(),
  opening: Joi.string().trim().max(2000).allow('').optional(),
  questions: Joi.array().items(voiceOnboardingQuestionSchema).min(1).required(),
});

const voiceOnboardingSchema = Joi.object().keys({
  useDefault: Joi.boolean().required(),
  days: Joi.when('useDefault', {
    is: false,
    then: Joi.array().items(voiceOnboardingDaySchema).max(MAX_ONBOARDING_DAYS).required(),
    otherwise: Joi.array().items(voiceOnboardingDaySchema).max(MAX_ONBOARDING_DAYS).optional(),
  }),
});

const MAX_REQUIRED_CALL_QUESTIONS = 10;

const requiredCallQuestionSchema = Joi.object().keys({
  id: Joi.string().trim().min(1).max(100).required(),
  prompt: Joi.string().trim().min(1).max(1000).required(),
});

const requiredCallQuestionsSchema = Joi.object().keys({
  enabled: Joi.boolean().required(),
  questions: Joi.array().items(requiredCallQuestionSchema).max(MAX_REQUIRED_CALL_QUESTIONS).required(),
});

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
      country: Joi.string().valid('US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'CH', 'JP', 'CN', 'HK', 'SG', 'AE', 'IN', 'MX', 'BR', 'OTHER').optional().uppercase(),
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
      patients: Joi.array().items(Joi.string().custom(objectId)).optional(),
      clients: Joi.array().items(Joi.string().custom(objectId)).optional(),
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
      logo: Joi.string().allow(null, '').optional(),
      timezone: Joi.string().optional(), // IANA timezone identifier
      country: Joi.string().valid('US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'CH', 'JP', 'CN', 'HK', 'SG', 'AE', 'IN', 'MX', 'BR', 'OTHER').optional().uppercase(),
      callRetrySettings: Joi.object().keys({
        retryCount: Joi.number().integer().min(0).max(5).optional(),
        retryIntervalMinutes: Joi.number().integer().min(1).max(1440).optional(),
        alertOnAllMissedCalls: Joi.boolean().optional(),
      }).optional(),
      requireClientConsent: Joi.boolean().optional(),
      /** Super admin / org admin: allow S3 debug audio for this org's Realtime calls */
      debugAudioUploadEnabled: Joi.boolean().optional(),
      /** Facility care setting — selects preset when useDefault; null clears */
      facilityType: Joi.string()
        .valid(...FACILITY_TYPES)
        .allow(null)
        .optional(),
      /** Org admin / super admin: per-org resident voice onboarding plan */
      voiceOnboarding: voiceOnboardingSchema.optional(),
      /** Org admin: questions Bianca asks on every wellness call */
      requiredCallQuestions: requiredCallQuestionsSchema.optional(),
      dailyDigestSettings: Joi.object()
        .keys({
          enabled: Joi.boolean().optional(),
          sendTime: Joi.string().pattern(HH_MM_PATTERN).optional().allow(null, ''),
        })
        .optional(),
      familyPortalSettings: Joi.object()
        .keys({
          enabled: Joi.boolean().optional(),
          allowInviteAfterDigestVerify: Joi.boolean().optional(),
        })
        .optional(),
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
