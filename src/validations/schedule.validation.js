const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createSchedule = {
  body: Joi.object().keys({
    patientId: Joi.string().custom(objectId),
    frequency: Joi.string().required(),
    intervals: Joi.array().items(Joi.string()).required(),
  }),
};

const getSchedule = {
  params: Joi.object().keys({
    scheduleId: Joi.string().custom(objectId),
  }),
};

const updateSchedule = {
  params: Joi.object().keys({
    scheduleId: Joi.string().custom(objectId),
  }),
  body: Joi.object().keys({
    frequency: Joi.string().required(),
    intervals: Joi.array().items(Joi.string()).required(),
  }),
};

const patchSchedule = {
  params: Joi.object().keys({
    scheduleId: Joi.string().custom(objectId),
  }),
  body: Joi.object().keys({
    frequency: Joi.string(),
    intervals: Joi.array().items(Joi.string()),
  }),
};

const deleteSchedule = {
  params: Joi.object().keys({
    scheduleId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createSchedule,
  getSchedule,
  updateSchedule,
  patchSchedule,
  deleteSchedule,
};