const Joi = require('joi');
const { objectId } = require('./custom.validation');

const requestAccess = {
  body: Joi.object().keys({
    informationRequested: Joi.string().max(5000).optional(),
    accessMethod: Joi.string().valid('email', 'download', 'mail').optional(),
  }),
};

const requestCorrection = {
  body: Joi.object().keys({
    informationRequested: Joi.string().max(5000).optional(),
    correctionDetails: Joi.object()
      .keys({
        field: Joi.string().required(),
        currentValue: Joi.string().allow('', null).optional(),
        requestedValue: Joi.string().required(),
        reason: Joi.string().allow('', null).optional(),
      })
      .required(),
  }),
};

const privacyRequestIdParam = {
  params: Joi.object().keys({
    requestId: Joi.string().custom(objectId).required(),
  }),
};

const complaintIdParam = {
  params: Joi.object().keys({
    complaintId: Joi.string().custom(objectId).required(),
  }),
};

const consentIdParam = {
  params: Joi.object().keys({
    consentId: Joi.string().custom(objectId).required(),
  }),
};

const getRequests = {
  query: Joi.object().keys({
    sortBy: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).optional(),
    consentType: Joi.string().optional(),
    purpose: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),
};

const updatePrivacyRequest = {
  ...privacyRequestIdParam,
  body: Joi.object()
    .keys({
      status: Joi.string().optional(),
      notes: Joi.string().allow('', null).optional(),
      correctionStatus: Joi.object().optional(),
    })
    .min(1),
};

const processCorrection = {
  ...privacyRequestIdParam,
  body: Joi.object().keys({
    field: Joi.string().required(),
    value: Joi.any().required(),
    notes: Joi.string().allow('', null).optional(),
  }),
};

const createConsent = {
  body: Joi.object().keys({
    consentType: Joi.string().required(),
    purpose: Joi.string().required(),
    granted: Joi.boolean().optional(),
    method: Joi.string().optional(),
    explicitConsent: Joi.object().optional(),
    informationTypes: Joi.array().items(Joi.string()).optional(),
    thirdParties: Joi.array().items(Joi.string()).optional(),
    retentionPeriod: Joi.string().optional(),
    legalBasis: Joi.string().optional(),
    collectionNoticeProvided: Joi.boolean().optional(),
    collectionNoticeVersion: Joi.string().optional(),
    expiresAt: Joi.date().iso().optional(),
  }),
};

const withdrawConsent = {
  ...consentIdParam,
  body: Joi.object().keys({
    reason: Joi.string().allow('', null).optional(),
    withdrawalMethod: Joi.string().optional(),
    withdrawalReason: Joi.string().allow('', null).optional(),
    withdrawalImpact: Joi.string().allow('', null).optional(),
  }),
};

const createComplaint = {
  body: Joi.object()
    .keys({
      complaintType: Joi.string().optional(),
      complaint: Joi.string().optional(),
      subject: Joi.string().optional(),
      description: Joi.string().optional(),
      violationType: Joi.string().optional(),
    })
    .or('complaint', 'description'),
};

const updateComplaint = {
  ...complaintIdParam,
  body: Joi.object()
    .keys({
      status: Joi.string().optional(),
      resolution: Joi.string().allow('', null).optional(),
      notes: Joi.string().allow('', null).optional(),
    })
    .min(1),
};

const requestDeletion = {
  body: Joi.object().keys({
    dataType: Joi.string().valid('all', 'profile', 'conversations', 'medical').optional(),
  }),
};

module.exports = {
  requestAccess,
  requestCorrection,
  privacyRequestIdParam,
  complaintIdParam,
  consentIdParam,
  getRequests,
  updatePrivacyRequest,
  processCorrection,
  createConsent,
  withdrawConsent,
  createComplaint,
  updateComplaint,
  requestDeletion,
};
