const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { emergencyPhraseService } = require('../services');

/**
 * Create emergency phrase
 */
const createEmergencyPhrase = catchAsync(async (req, res) => {
  const phraseData = {
    ...req.body,
    createdBy: req.caregiver.id,
    lastModifiedBy: req.caregiver.id
  };
  
  const phrase = await emergencyPhraseService.createEmergencyPhrase(phraseData);
  res.status(httpStatus.CREATED).send(phrase);
});

/**
 * Get emergency phrases
 */
const getEmergencyPhrases = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['language', 'severity', 'category', 'isActive']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await emergencyPhraseService.queryEmergencyPhrases(filter, options);
  res.send(result);
});

/**
 * Get emergency phrase by id
 */
const getEmergencyPhrase = catchAsync(async (req, res) => {
  const phrase = await emergencyPhraseService.getEmergencyPhraseById(req.params.phraseId);
  if (!phrase) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Emergency phrase not found');
  }
  res.send(phrase);
});

/**
 * Update emergency phrase
 */
const updateEmergencyPhrase = catchAsync(async (req, res) => {
  const updateData = {
    ...req.body,
    lastModifiedBy: req.caregiver.id
  };
  
  const phrase = await emergencyPhraseService.updateEmergencyPhraseById(
    req.params.phraseId, 
    updateData
  );
  res.send(phrase);
});

/**
 * Delete emergency phrase
 */
const deleteEmergencyPhrase = catchAsync(async (req, res) => {
  await emergencyPhraseService.deleteEmergencyPhraseById(req.params.phraseId);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Toggle phrase active status
 */
const togglePhraseStatus = catchAsync(async (req, res) => {
  const phrase = await emergencyPhraseService.togglePhraseStatus(
    req.params.phraseId, 
    req.caregiver.id
  );
  res.send(phrase);
});

/**
 * Get phrase statistics
 */
const getPhraseStatistics = catchAsync(async (req, res) => {
  const language = req.query.language;
  const stats = await emergencyPhraseService.getPhraseStatistics(language);
  res.send(stats);
});

/**
 * Test phrase pattern
 */
const testPhrasePattern = catchAsync(async (req, res) => {
  const { pattern, testText } = req.body;
  
  if (!pattern || !testText) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Pattern and testText are required');
  }
  
  const result = await emergencyPhraseService.testPhrasePattern(pattern, testText);
  res.send(result);
});

/**
 * Bulk import phrases
 */
const bulkImportPhrases = catchAsync(async (req, res) => {
  const { phrases } = req.body;
  
  if (!Array.isArray(phrases) || phrases.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phrases array is required and must not be empty');
  }
  
  const result = await emergencyPhraseService.bulkImportPhrases(phrases, req.caregiver.id);
  res.status(httpStatus.CREATED).send(result);
});

/**
 * Export phrases
 */
const exportPhrases = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['language', 'severity', 'category', 'isActive']);
  const phrases = await emergencyPhraseService.exportPhrases(filter);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=emergency-phrases.json');
  res.send(JSON.stringify(phrases, null, 2));
});

/**
 * Get phrases by language for emergency detection
 */
const getPhrasesByLanguage = catchAsync(async (req, res) => {
  const { language } = req.params;
  const { severity, category } = req.query;
  
  const phrases = await emergencyPhraseService.getPhrasesByLanguage(language, severity, category);
  res.send(phrases);
});

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
  getPhrasesByLanguage
};
