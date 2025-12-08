const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createAlert = {
  body: Joi.object().keys({
    message: Joi.string().required(),
    importance: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
    alertType: Joi.string().valid('conversation', 'patient', 'system').required(),
    relatedPatient: Joi.string().custom(objectId).optional(),
    relatedConversation: Joi.string().custom(objectId).optional(),
    createdBy: Joi.string().custom(objectId).required(),
    createdModel: Joi.string().valid('Patient', 'Caregiver', 'Org', 'Schedule').required(),
    visibility: Joi.string().valid('orgAdmin', 'allCaregivers', 'assignedCaregivers').required(),
    relevanceUntil: Joi.date().optional(),
    readBy: Joi.array().items(Joi.string().custom(objectId)),
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
    })
    .min(1),
};

const markAlertAsRead = {
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
  markAllAsRead,
  deleteAlert,
};
