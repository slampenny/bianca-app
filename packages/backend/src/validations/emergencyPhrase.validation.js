const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createEmergencyPhrase = {
  body: Joi.object().keys({
    phrase: Joi.string().required().trim().max(200),
            language: Joi.string().required().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'hi', 'zh-cn'),
    severity: Joi.string().required().valid('CRITICAL', 'HIGH', 'MEDIUM'),
    category: Joi.string().required().valid('Medical', 'Safety', 'Physical', 'Request'),
    pattern: Joi.string().required().trim().max(500),
    description: Joi.string().optional().trim().max(500),
    tags: Joi.array().items(Joi.string().trim().max(50)).optional(),
    isActive: Joi.boolean().optional().default(true)
  }),
};

const getEmergencyPhrases = {
  query: Joi.object().keys({
    language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar'),
    severity: Joi.string().valid('CRITICAL', 'HIGH', 'MEDIUM'),
    category: Joi.string().valid('Medical', 'Safety', 'Physical', 'Request'),
    isActive: Joi.boolean(),
    sortBy: Joi.string(),
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
  }),
};

const getEmergencyPhrase = {
  params: Joi.object().keys({
    phraseId: Joi.string().custom(objectId),
  }),
};

const updateEmergencyPhrase = {
  params: Joi.object().keys({
    phraseId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      phrase: Joi.string().trim().max(200),
      language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar'),
      severity: Joi.string().valid('CRITICAL', 'HIGH', 'MEDIUM'),
      category: Joi.string().valid('Medical', 'Safety', 'Physical', 'Request'),
      pattern: Joi.string().trim().max(500),
      description: Joi.string().trim().max(500),
      tags: Joi.array().items(Joi.string().trim().max(50)),
      isActive: Joi.boolean(),
    })
    .min(1)
    .unknown(false),
};

const deleteEmergencyPhrase = {
  params: Joi.object().keys({
    phraseId: Joi.string().custom(objectId),
  }),
};

const togglePhraseStatus = {
  params: Joi.object().keys({
    phraseId: Joi.string().custom(objectId),
  }),
};

const getPhraseStatistics = {
  query: Joi.object().keys({
    language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar'),
  }),
};

const testPhrasePattern = {
  body: Joi.object().keys({
    pattern: Joi.string().required().trim().max(500),
    testText: Joi.string().required().trim().max(1000),
  }),
};

const bulkImportPhrases = {
  body: Joi.object().keys({
    phrases: Joi.array()
      .items(
        Joi.object().keys({
          phrase: Joi.string().required().trim().max(200),
            language: Joi.string().required().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'hi', 'zh-cn'),
          severity: Joi.string().required().valid('CRITICAL', 'HIGH', 'MEDIUM'),
          category: Joi.string().required().valid('Medical', 'Safety', 'Physical', 'Request'),
          pattern: Joi.string().required().trim().max(500),
          description: Joi.string().optional().trim().max(500),
          tags: Joi.array().items(Joi.string().trim().max(50)).optional(),
          isActive: Joi.boolean().optional().default(true)
        })
      )
      .min(1)
      .max(1000)
      .required(),
  }),
};

const exportPhrases = {
  query: Joi.object().keys({
    language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar'),
    severity: Joi.string().valid('CRITICAL', 'HIGH', 'MEDIUM'),
    category: Joi.string().valid('Medical', 'Safety', 'Physical', 'Request'),
    isActive: Joi.boolean(),
  }),
};

const getPhrasesByLanguage = {
  params: Joi.object().keys({
            language: Joi.string().required().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'hi', 'zh-cn'),
  }),
  query: Joi.object().keys({
    severity: Joi.string().valid('CRITICAL', 'HIGH', 'MEDIUM'),
    category: Joi.string().valid('Medical', 'Safety', 'Physical', 'Request'),
  }),
};

module.exports = {
  createEmergencyPhrase,
  getEmergencyPhrases,
  getEmergencyPhrase,
  updateEmergencyPhrase,
  deleteEmergencyPhrase,
  togglePhraseStatus,
  getPhraseStatistics,
  testPhrasePattern,
  bulkImportPhrases,
  exportPhrases,
  getPhrasesByLanguage,
};
