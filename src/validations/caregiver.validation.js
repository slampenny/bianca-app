const Joi = require('joi');
const { password, objectId } = require('./custom.validation');

const createCaregiver = {
  body: Joi.object().keys({
    orgId: Joi.required().custom(objectId),
    email: Joi.string().required().email(),
    avatar: Joi.string().optional(),
    name: Joi.string().required(),
    phone: Joi.string().required(),
    password: Joi.string().required().custom(password),
    patients: Joi.array().items(Joi.string().custom(objectId)),
  }),
};

const getCaregivers = {
  query: Joi.object().keys({
    org: Joi.string().custom(objectId),
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
      id: Joi.required().custom(objectId).optional(),
      org: Joi.required().custom(objectId).optional(),
      email: Joi.string().email().optional(),
      avatar: Joi.string().optional(),
      name: Joi.string().optional(),
      phone: Joi.string().optional(),
      isEmailVerified: Joi.boolean().optional(),
      password: Joi.string().required().custom(password).optional(),
      patients: Joi.array().items(Joi.string().custom(objectId)),
    })
    .min(1)
    .unknown(false), // Disallow fields that are not defined in the schema
};

const uploadCaregiverAvatar = {
  params: Joi.object().keys({
    caregiverId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      avatar: Joi.string(),
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
  uploadCaregiverAvatar,
  deleteCaregiver,
  addPatient,
  removePatient,
  getPatientsByCaregiver,
};