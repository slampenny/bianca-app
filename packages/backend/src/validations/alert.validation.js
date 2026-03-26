const Joi = require('joi');
const { objectId } = require('./custom.validation');

const evidenceSchema = Joi.object().keys({
  snippet: Joi.string().allow('', null),
  conversationId: Joi.string().custom(objectId).allow(null),
  messageIds: Joi.array().items(Joi.string().custom(objectId)),
  detector: Joi.string().allow('', null),
  confidence: Joi.number().min(0).max(1).allow(null),
  language: Joi.string().allow('', null),
});

const recommendedActionSchema = Joi.object().keys({
  id: Joi.string().required(),
  labelKey: Joi.string().required(),
  actionType: Joi.string().required(),
});

const createAlert = {
  body: Joi.object().keys({
    message: Joi.string().required(),
    importance: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
    alertType: Joi.string().valid('conversation', 'client', 'system').required(),
    relatedClient: Joi.string().custom(objectId).optional(),
    relatedConversation: Joi.string().custom(objectId).optional(),
    createdBy: Joi.string().custom(objectId).required(),
    createdModel: Joi.string().valid('Client', 'Caregiver', 'Org', 'Schedule').required(),
    visibility: Joi.string().valid('orgAdmin', 'allCaregivers', 'assignedCaregivers').required(),
    relevanceUntil: Joi.date().optional(),
    readBy: Joi.array().items(Joi.string().custom(objectId)),
    evidence: evidenceSchema.optional(),
    recommendedActions: Joi.array().items(recommendedActionSchema).optional(),
  }),
};

const getAlerts = {
  query: Joi.object().keys({
    showRead: Joi.boolean(),
  }),
};

const getAlertById = {
  params: Joi.object().keys({
    alertId: Joi.string().custom(objectId).required(),
  }),
};

const updateAlert = {
  params: Joi.object().keys({
    alertId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      message: Joi.string().optional(),
      importance: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      relevanceUntil: Joi.date().optional(),
      evidence: evidenceSchema.optional(),
      recommendedActions: Joi.array().items(recommendedActionSchema).optional(),
    })
    .min(1),
};

const markAlertAsRead = {
  params: Joi.object().keys({
    alertId: Joi.string().custom(objectId).required(),
  }),
};

const markAlertAsUnread = {
  params: Joi.object().keys({
    alertId: Joi.string().custom(objectId).required(),
  }),
};

const markAllAsRead = {
  body: Joi.object().keys({
    alertIds: Joi.array().items(Joi.string().custom(objectId)).required(),
  }),
};

const deleteAlert = {
  params: Joi.object().keys({
    alertId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createAlert,
  getAlerts,
  getAlertById,
  updateAlert,
  markAlertAsRead,
  markAlertAsUnread,
  markAllAsRead,
  deleteAlert,
};
