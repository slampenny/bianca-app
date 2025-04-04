const Joi = require('joi');
const validator = require('validator');
const { password, objectId } = require('./custom.validation');

const createPatient = {
  body: Joi.object().keys({
    org: Joi.string().custom(objectId),
    email: Joi.string().required().email(),
    avatar: Joi.string().optional(),
    name: Joi.string().required(),
    phone: Joi.string().required().custom((value, helpers) => {
      if (!validator.isMobilePhone(value)) {
        return helpers.message('Invalid phone number');
      }
      return value;
    }),
    caregivers: Joi.array().optional(),
    schedules: Joi.array().items(
      Joi.object().keys({
        patient: Joi.string().custom(objectId).optional(),
        nextCallDate: Joi.string().optional(),
        frequency: Joi.string().valid('daily', 'weekly', 'monthly'),
        intervals: Joi.array().items(
          Joi.object().keys({
            day: Joi.number().integer().min(0).max(6), // 0-6 for days of the week
            weeks: Joi.number().integer().optional(), // number of weeks between each run for weekly schedules
          })
        ),
        time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
        isActive: Joi.boolean(),
      })
    ).optional(),
  }),
};

const getPatients = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getPatient = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId),
  }),
};

const updatePatient = {
  params: Joi.object().keys({
    patientId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      id: Joi.string().custom(objectId).optional(),
      org: Joi.string().custom(objectId).optional(),
      avatar: Joi.string().optional(),
      email: Joi.string().email().optional(),
      name: Joi.string().optional(),
      phone: Joi.string().optional().custom((value, helpers) => {
        if (!validator.isMobilePhone(value)) {
          return helpers.message('Invalid phone number');
        }
        return value;
      }),
      isEmailVerified: Joi.boolean().optional(),
      caregivers: Joi.array().optional(),
      schedules: Joi.array().items(
        Joi.object().keys({
          id: Joi.required().custom(objectId),
          patient: Joi.string().custom(objectId).optional(),
          nextCallDate: Joi.string().optional(),
          frequency: Joi.string().valid('daily', 'weekly', 'monthly'),
          intervals: Joi.array().items(
            Joi.object().keys({
              _id: Joi.string().custom(objectId).optional(),
              day: Joi.number().integer().min(0).max(6), // 0-6 for days of the week
              weeks: Joi.number().integer().optional(), // number of weeks between each run for weekly schedules
            })
          ),
          time: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
          isActive: Joi.boolean(),
        })
      ).optional(),
    })
    .min(1)
    .unknown(false), // Disallow fields that are not defined in the schema
};

const uploadPatientAvatar = {
  params: Joi.object().keys({
    patientId: Joi.required().custom(objectId),
  }),
};

const deletePatient = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId),
  }),
};

const getConversationsByPatient = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId),
  }),
}

const getCaregivers = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createPatient,
  getConversationsByPatient,
  getPatients,
  getPatient,
  updatePatient,
  uploadPatientAvatar,
  deletePatient,
  getCaregivers,
};
