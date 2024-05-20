const Joi = require('joi');
const validator = require('validator');
const { password, objectId } = require('./custom.validation');

const createPatient = {
  body: Joi.object().keys({
    org: Joi.string().custom(objectId).optional(),
    email: Joi.string().required().email(),
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
        patientId: Joi.string().custom(objectId).optional(),
        frequency: Joi.string().valid('daily', 'weekly', 'monthly'),
        intervals: Joi.array().items(
          Joi.object().keys({
            day: Joi.number().integer().min(0).max(6), // 0-6 for days of the week
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
      org: Joi.string().custom(objectId).optional(),
      email: Joi.string().email().optional(),
      password: Joi.when('role', {
        is: 'staff',
        then: Joi.string().required().custom(password),
        otherwise: Joi.string().optional().allow('').custom(password),
      }).optional(),
      name: Joi.string().optional(),
      phone: Joi.string().optional().custom((value, helpers) => {
        if (!validator.isMobilePhone(value)) {
          return helpers.message('Invalid phone number');
        }
        return value;
      }),
      caregivers: Joi.array().optional(),
      schedules: Joi.array().items(
        Joi.object().keys({
          id: Joi.required().custom(objectId),
          patientId: Joi.string().custom(objectId).optional(),
          frequency: Joi.string().valid('daily', 'weekly', 'monthly'),
          intervals: Joi.array().items(
            Joi.object().keys({
              _id: Joi.string().custom(objectId).optional(),
              day: Joi.number().integer().min(0).max(6), // 0-6 for days of the week
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
  deletePatient,
  getCaregivers,
};
