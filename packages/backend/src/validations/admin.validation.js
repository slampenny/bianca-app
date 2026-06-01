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

/** Invite email for a future superAdmin (super admin only). */
const sendSuperAdminInvite = {
  body: Joi.object().keys({
    name: Joi.string().required().trim().min(1).max(200),
    email: Joi.string().required().email(),
    phone: Joi.string().required().trim().min(1).max(40),
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

const embeddingAnchorsList = {
  query: Joi.object().keys({
    detector: Joi.string()
      .valid('emergencyDetector', 'abuseNeglectDetector', 'financialExploitationDetector', 'relationshipPatternDetector')
      .optional(),
  }),
};

const embeddingAnchorCreate = {
  body: Joi.object()
    .keys({
      detector: Joi.string()
        .valid('emergencyDetector', 'abuseNeglectDetector', 'financialExploitationDetector', 'relationshipPatternDetector')
        .required(),
      category: Joi.when('detector', {
        is: 'abuseNeglectDetector',
        then: Joi.string().valid('physical', 'emotional', 'neglect').required(),
        otherwise: Joi.valid(null, '').optional(),
      }),
      bucket: Joi.string().trim().min(1).max(200).required(),
      phrase: Joi.string().trim().min(1).max(8000).required(),
      order: Joi.number().integer().min(0).optional(),
      isActive: Joi.boolean().optional(),
      emergencySeverity: Joi.string()
        .valid('CRITICAL', 'HIGH', 'MEDIUM')
        .when('detector', { is: 'emergencyDetector', then: Joi.required(), otherwise: Joi.forbidden() }),
      emergencyCategory: Joi.string()
        .trim()
        .max(200)
        .when('detector', { is: 'emergencyDetector', then: Joi.required(), otherwise: Joi.forbidden() }),
    })
    .required(),
};

const embeddingAnchorIdParam = {
  params: Joi.object().keys({
    phraseId: Joi.string().custom(objectId).required(),
  }),
};

const embeddingAnchorUpdate = {
  ...embeddingAnchorIdParam,
  body: Joi.object()
    .keys({
      detector: Joi.string()
        .valid('emergencyDetector', 'abuseNeglectDetector', 'financialExploitationDetector', 'relationshipPatternDetector')
        .optional(),
      category: Joi.string().valid('physical', 'emotional', 'neglect').allow(null).optional(),
      bucket: Joi.string().trim().min(1).max(200).optional(),
      phrase: Joi.string().trim().min(1).max(8000).optional(),
      order: Joi.number().integer().min(0).optional(),
      isActive: Joi.boolean().optional(),
      emergencySeverity: Joi.string().valid('CRITICAL', 'HIGH', 'MEDIUM').allow(null).optional(),
      emergencyCategory: Joi.string().trim().max(200).allow('', null).optional(),
    })
    .min(1),
};

const saveCorpEmailForwards = {
  body: Joi.object().keys({
    forwards: Joi.array()
      .items(
        Joi.object().keys({
          caregiverId: Joi.string().custom(objectId).optional().allow(null),
          corpEmail: Joi.string().required().email(),
          forwardToEmail: Joi.string().email().allow(null, '').optional(),
        }),
      )
      .min(1)
      .required(),
  }),
};

const listBreachLogs = {
  query: Joi.object().keys({
    status: Joi.string()
      .valid(
        'INVESTIGATING',
        'FALSE_POSITIVE',
        'SECURITY_EVENT_CONFIRMED',
        'BREACH_CONFIRMED',
        'CLOSED',
        'CONFIRMED',
        'MITIGATED',
        'RESOLVED',
      )
      .optional(),
    type: Joi.string()
      .valid(
        'excessive_failed_logins',
        'unusual_data_access_volume',
        'off_hours_access',
        'unauthorized_export_attempt',
        'suspicious_ip_address',
        'brute_force_attempt',
        'privilege_escalation_attempt',
        'data_exfiltration_attempt',
        'unauthorized_access',
        'other',
      )
      .optional(),
    severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
    jurisdiction: Joi.string().valid('HIPAA', 'PIPEDA', 'OTHER').optional(),
    orgId: Joi.string().custom(objectId).optional(),
    userId: Joi.string().custom(objectId).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const breachLogIdParam = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

const updateBreachLogStatus = {
  ...breachLogIdParam,
  body: Joi.object().keys({
    status: Joi.string()
      .valid(
        'INVESTIGATING',
        'FALSE_POSITIVE',
        'SECURITY_EVENT_CONFIRMED',
        'BREACH_CONFIRMED',
        'CLOSED',
      )
      .required(),
    resolutionNotes: Joi.string().trim().min(1).max(5000).when('status', {
      is: Joi.valid('FALSE_POSITIVE', 'BREACH_CONFIRMED', 'CLOSED'),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    resolutionReason: Joi.string()
      .valid(
        'timezone_false_positive',
        'legitimate_access',
        'detector_bug',
        'user_error',
        'confirmed_unauthorized_access',
        'confirmed_breach',
        'other',
      )
      .optional(),
  }),
};

module.exports = {
  searchCaregivers,
  impersonate,
  searchOrgs,
  orgIdParam,
  sendSuperAdminInvite,
  setCaregiverRole,
  embeddingAnchorsList,
  embeddingAnchorCreate,
  embeddingAnchorIdParam,
  embeddingAnchorUpdate,
  saveCorpEmailForwards,
  listBreachLogs,
  breachLogIdParam,
  updateBreachLogStatus,
};
