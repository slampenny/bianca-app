const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createAlert = {
  body: Joi.object().keys({
    message: Joi.string().required(),
    importance: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
    createdBy: Joi.string().custom(objectId).required(),
    createdModel: Joi.string().valid('Patient', 'Caregiver', 'Org').required(),
    visibility: Joi.string().valid('orgAdmin', 'allCaregivers', 'assignedCaregivers').required(),
    relevanceUntil: Joi.date().optional(),
  }),
};

const getAlerts = {
  query: Joi.object().keys({
    showRead: Joi.boolean(),
  }),
};

const getAlert = {
  params: Joi.object().keys({
    alertId: Joi.string().custom(objectId).required(),
  }),
};

const updateAlert = {
  params: Joi.object().keys({
    alertId: Joi.required().custom(objectId),
  }),
  body: Joi.object().keys({
    message: Joi.string().optional(),
    importance: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
    relevanceUntil: Joi.date().optional(),
  }).min(1),
};

const markAlertAsRead = {
  params: Joi.object().keys({
    alertId: Joi.string().custom(objectId).required(),
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
  getAlert,
  updateAlert,
  markAlertAsRead,
  deleteAlert,
};
