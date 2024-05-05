const Joi = require('joi');
const { password, objectId } = require('./custom.validation');

const createCaregiver = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    name: Joi.string().required(),
    phone: Joi.string().required(),
    patients: Joi.array().items(Joi.string().custom(objectId)),
  }),
  params: Joi.object().keys({
    orgId: Joi.required().custom(objectId),
  }),
};

const getCaregivers = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getCaregiver = {
  params: Joi.object().keys({
    caregiverId: Joi.string().custom(objectId),
  }),
};

const updateCaregiver = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      name: Joi.string(),
      phone: Joi.string(),
      password: Joi.string().required().custom(password).optional(),
      patients: Joi.array().items(Joi.string().custom(objectId)),
    })
    .min(1)
    .unknown(false), // Disallow fields that are not defined in the schema
};

const deleteCaregiver = {
  params: Joi.object().keys({
    caregiverId: Joi.string().custom(objectId),
  }),
};

const addPatient = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
    patientId: Joi.required().custom(objectId),
  }),
};

const removePatient = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
    patientId: Joi.required().custom(objectId),
  }),
};

const getPatientsByCaregiver = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
  }),
};

const getConversationsByPatient = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
    patientId: Joi.required().custom(objectId),
  }),
};

module.exports = {
  createCaregiver,
  getCaregivers,
  getCaregiver,
  updateCaregiver,
  deleteCaregiver,
  addPatient,
  removePatient,
  getPatientsByCaregiver,
};