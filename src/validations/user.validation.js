const Joi = require('joi');
const validator = require('validator');
const { password, objectId } = require('./custom.validation');

const createUser = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.when('role', {
      is: 'caregiver',
      then: Joi.string().required().custom(password),
      otherwise: Joi.string().optional().allow('').custom(password),
    }),
    name: Joi.string().required(),
    role: Joi.string().required().valid('user', 'admin', 'caregiver'),
    phone: Joi.when('role', {
      is: 'user',
      then: Joi.string().required().custom((value, helpers) => {
        if (!validator.isMobilePhone(value)) {
          return helpers.message('Invalid phone number');
        }
        return value;
      }),
      otherwise: Joi.string().optional().allow(''),
    }),
    caregiver: Joi.string().optional(),
    schedules: Joi.array().items(
      Joi.object().keys({
        userId: Joi.string().custom(objectId).optional(),
        frequency: Joi.string().valid('daily', 'weekly', 'monthly'),
        intervals: Joi.array().items(
          Joi.object().keys({
            day: Joi.number().integer().min(0).max(6), // 0-6 for days of the week
          })
        ),
        time: Joi.date(),
        isActive: Joi.boolean(),
      })
    ).optional(),
  }),
};

const getUsers = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

const updateUser = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      name: Joi.string(),
    })
    .min(1),
};

const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

const getConversationsByUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
}

module.exports = {
  createUser,
  getConversationsByUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
};
