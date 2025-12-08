const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getSentimentTrend = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId),
  }),
  query: Joi.object().keys({
    timeRange: Joi.string().valid('lastCall', 'month', 'lifetime').default('lastCall'),
  }),
};

const getSentimentSummary = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId),
  }),
};

const getConversationSentiment = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId),
  }),
};

const analyzeConversationSentiment = {
  params: Joi.object().keys({
    conversationId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  getSentimentTrend,
  getSentimentSummary,
  getConversationSentiment,
  analyzeConversationSentiment,
};

