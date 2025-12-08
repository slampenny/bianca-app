const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createSchedule = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId),
  }),
  body: Joi.object().keys({
    frequency: Joi.string().required(),
    intervals: Joi.array()
      .items(
        Joi.object().keys({
          day: Joi.number().min(0).max(31).optional(),
          weeks: Joi.number().min(1).optional(),
        })
      )
      .required(),
    time: Joi.string()
      .pattern(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
      .required(),
    isActive: Joi.boolean().optional(),
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
    id: Joi.string().custom(objectId),
    patient: Joi.string().custom(objectId),
    nextCallDate: Joi.string().optional(),
    frequency: Joi.string().required(),
    intervals: Joi.array()
      .items(
        Joi.object().keys({
          day: Joi.number().min(0).max(31).optional(),
          weeks: Joi.number().min(1).optional(),
        })
      )
      .required(),
    time: Joi.string()
      .pattern(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
      .required(),
    isActive: Joi.boolean().optional(),
  }),
};

const patchSchedule = {
  params: Joi.object().keys({
    scheduleId: Joi.string().custom(objectId),
  }),
  body: Joi.object().keys({
    id: Joi.string().custom(objectId),
    patient: Joi.string().custom(objectId),
    frequency: Joi.string().optional(),
    intervals: Joi.array()
      .items(
        Joi.object().keys({
          day: Joi.number().min(0).max(31).optional(),
          weeks: Joi.number().min(1).optional(),
        })
      )
      .optional(),
    time: Joi.string()
      .pattern(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    isActive: Joi.boolean().optional(),
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
