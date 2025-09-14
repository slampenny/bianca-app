// src/validations/medicalAnalysis.validation.js

const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getMedicalAnalysis = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId).required(),
  }),
  query: Joi.object().keys({
    timeRange: Joi.string().valid('month', 'quarter', 'year', 'custom').default('month'),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
    includeBaseline: Joi.boolean().default(true),
  }),
};

const getMedicalAnalysisSummary = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId).required(),
  }),
};

const getBaseline = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId).required(),
  }),
};

const establishBaseline = {
  params: Joi.object().keys({
    patientId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    metrics: Joi.object().keys({
      vocabularyScore: Joi.number().min(0).max(100),
      depressionScore: Joi.number().min(0).max(100),
      anxietyScore: Joi.number().min(0).max(100),
      cognitiveScore: Joi.number().min(0).max(100),
      analysisDate: Joi.date().iso(),
    }).required(),
  }),
};

module.exports = {
  getMedicalAnalysis,
  getMedicalAnalysisSummary,
  getBaseline,
  establishBaseline,
};
