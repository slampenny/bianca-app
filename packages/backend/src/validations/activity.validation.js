const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getRecentActivity = {
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(100),
    sinceDays: Joi.number().integer().min(1).max(90),
    orgId: Joi.string().custom(objectId).optional(),
  }),
};

const getCallsByHourToday = {
  query: Joi.object().keys({
    orgId: Joi.string().custom(objectId).optional(),
  }),
};

module.exports = {
  getRecentActivity,
  getCallsByHourToday,
};
