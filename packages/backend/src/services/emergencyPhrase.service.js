const httpStatus = require('http-status');
const { EmergencyPhrase } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Create emergency phrase
 * @param {Object} phraseData
 * @returns {Promise<EmergencyPhrase>}
 */
const createEmergencyPhrase = async (phraseData) => {
  // Validate regex pattern
  const validation = validateRegexPattern(phraseData.pattern);
  if (!validation.isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid regex pattern: ${validation.error}`);
  }

  const phrase = await EmergencyPhrase.create(phraseData);
  return phrase;
};

/**
 * Query for emergency phrases with pagination
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default: 10)
 * @param {number} [options.page] - Current page (default: 1)
 * @returns {Promise<QueryResult>}
 */
const queryEmergencyPhrases = async (filter, options) => {
  const sortBy = options.sortBy || 'createdAt:desc';
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;

  // Build sort object
  const sort = {};
  if (sortBy) {
    const parts = sortBy.split(':');
    sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
  }

  // Build query
  const query = {};
  if (filter.language) query.language = filter.language;
  if (filter.severity) query.severity = filter.severity;
  if (filter.category) query.category = filter.category;
  if (filter.isActive !== undefined) query.isActive = filter.isActive === 'true';

  const phrases = await EmergencyPhrase.find(query)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email')
    .sort(sort)
    .skip(skip)
    .limit(limit);

  const total = await EmergencyPhrase.countDocuments(query);

  return {
    results: phrases,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    totalResults: total
  };
};

/**
 * Get emergency phrase by id
 * @param {ObjectId} id
 * @returns {Promise<EmergencyPhrase>}
 */
const getEmergencyPhraseById = async (id) => {
  return EmergencyPhrase.findById(id)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');
};

/**
 * Update emergency phrase by id
 * @param {ObjectId} phraseId
 * @param {Object} updateBody
 * @returns {Promise<EmergencyPhrase>}
 */
const updateEmergencyPhraseById = async (phraseId, updateBody) => {
  const phrase = await getEmergencyPhraseById(phraseId);
  if (!phrase) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Emergency phrase not found');
  }

  // Validate regex pattern if it's being updated
  if (updateBody.pattern) {
    const validation = validateRegexPattern(updateBody.pattern);
    if (!validation.isValid) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Invalid regex pattern: ${validation.error}`);
    }
  }

  Object.assign(phrase, updateBody);
  await phrase.save();
  return phrase;
};

/**
 * Delete emergency phrase by id
 * @param {ObjectId} phraseId
 * @returns {Promise<void>}
 */
const deleteEmergencyPhraseById = async (phraseId) => {
  const phrase = await getEmergencyPhraseById(phraseId);
  if (!phrase) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Emergency phrase not found');
  }
  await phrase.remove();
};

/**
 * Toggle phrase active status
 * @param {ObjectId} phraseId
 * @param {ObjectId} modifiedBy
 * @returns {Promise<EmergencyPhrase>}
 */
const togglePhraseStatus = async (phraseId, modifiedBy) => {
  const phrase = await getEmergencyPhraseById(phraseId);
  if (!phrase) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Emergency phrase not found');
  }

  phrase.isActive = !phrase.isActive;
  phrase.lastModifiedBy = modifiedBy;
  await phrase.save();
  return phrase;
};

/**
 * Get phrase statistics
 * @param {string} language - Optional language filter
 * @returns {Promise<Object>}
 */
const getPhraseStatistics = async (language = null) => {
  const query = language ? { language } : {};
  const phrases = await EmergencyPhrase.find(query);
  
  const stats = {
    totalPhrases: phrases.length,
    activePhrases: phrases.filter(p => p.isActive).length,
    totalUsage: phrases.reduce((sum, p) => sum + p.usageCount, 0),
    byLanguage: {},
    bySeverity: {},
    byCategory: {},
    mostUsed: phrases
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)
      .map(p => ({
        phrase: p.phrase,
        language: p.language,
        usageCount: p.usageCount,
        severity: p.severity,
        category: p.category
      }))
  };

  // Group by language
  phrases.forEach(phrase => {
    if (!stats.byLanguage[phrase.language]) {
      stats.byLanguage[phrase.language] = 0;
    }
    stats.byLanguage[phrase.language]++;
  });

  // Group by severity
  phrases.forEach(phrase => {
    if (!stats.bySeverity[phrase.severity]) {
      stats.bySeverity[phrase.severity] = 0;
    }
    stats.bySeverity[phrase.severity]++;
  });

  // Group by category
  phrases.forEach(phrase => {
    if (!stats.byCategory[phrase.category]) {
      stats.byCategory[phrase.category] = 0;
    }
    stats.byCategory[phrase.category]++;
  });

  return stats;
};

/**
 * Test phrase pattern
 * @param {string} pattern - Regex pattern to test
 * @param {string} testText - Text to test against
 * @returns {Promise<Object>}
 */
const testPhrasePattern = async (pattern, testText) => {
  const validation = validateRegexPattern(pattern);
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error,
      matches: false
    };
  }

  try {
    const regex = new RegExp(pattern, 'i');
    const matches = regex.test(testText);
    const matchDetails = testText.match(regex);
    
    return {
      isValid: true,
      matches,
      matchDetails: matchDetails ? {
        match: matchDetails[0],
        index: matchDetails.index,
        input: matchDetails.input
      } : null
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message,
      matches: false
    };
  }
};

/**
 * Bulk import phrases
 * @param {Array} phrases - Array of phrase objects
 * @param {ObjectId} createdBy - User ID who created the phrases
 * @returns {Promise<Object>}
 */
const bulkImportPhrases = async (phrases, createdBy) => {
  const results = {
    success: [],
    errors: [],
    total: phrases.length
  };

  for (let i = 0; i < phrases.length; i++) {
    try {
      const phraseData = {
        ...phrases[i],
        createdBy,
        lastModifiedBy: createdBy
      };

      // Validate required fields
      if (!phraseData.phrase || !phraseData.pattern || !phraseData.severity || !phraseData.category || !phraseData.language) {
        results.errors.push({
          index: i,
          phrase: phrases[i],
          error: 'Missing required fields: phrase, pattern, severity, category, language'
        });
        continue;
      }

      // Validate regex pattern
      const validation = validateRegexPattern(phraseData.pattern);
      if (!validation.isValid) {
        results.errors.push({
          index: i,
          phrase: phrases[i],
          error: `Invalid regex pattern: ${validation.error}`
        });
        continue;
      }

      const phrase = await EmergencyPhrase.create(phraseData);
      results.success.push(phrase);
    } catch (error) {
      results.errors.push({
        index: i,
        phrase: phrases[i],
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Export phrases
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Array>}
 */
const exportPhrases = async (filter) => {
  const query = {};
  if (filter.language) query.language = filter.language;
  if (filter.severity) query.severity = filter.severity;
  if (filter.category) query.category = filter.category;
  if (filter.isActive !== undefined) query.isActive = filter.isActive === 'true';

  return EmergencyPhrase.find(query)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email')
    .sort({ language: 1, severity: 1, category: 1 });
};

/**
 * Get phrases by language
 * @param {string} language - Language code
 * @param {string} severity - Optional severity filter
 * @param {string} category - Optional category filter
 * @returns {Promise<Array>}
 */
const getPhrasesByLanguage = async (language, severity = null, category = null) => {
  return EmergencyPhrase.getPhrasesByLanguage(language, severity, category);
};

/**
 * Validate regex pattern
 * @param {string} pattern - Regex pattern to validate
 * @returns {Object} - Validation result
 */
const validateRegexPattern = (pattern) => {
  try {
    new RegExp(pattern, 'i');
    return { isValid: true, error: null };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
};

/**
 * Initialize default phrases for all supported languages
 * @returns {Promise<void>}
 */
const initializeDefaultPhrases = async () => {
  try {
    // Check if phrases already exist
    const existingCount = await EmergencyPhrase.countDocuments();
    if (existingCount > 0) {
      logger.info('Emergency phrases already initialized, skipping...');
      return;
    }

    const defaultPhrases = [
      // English phrases
      { phrase: 'heart attack', pattern: '\\b(heart\\s+attack|heartattack)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
      { phrase: "can't breathe", pattern: "\\b(can'?t\\s+breathe|cannot\\s+breathe|can't\\s+breath|cannot\\s+breath)\\b", severity: 'CRITICAL', category: 'Medical', language: 'en' },
      { phrase: 'choking', pattern: '\\b(choking|choke)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
      { phrase: 'stroke', pattern: '\\b(stroke|stroke\\s+symptoms)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
      { phrase: 'seizure', pattern: '\\b(seizure|seizing|having\\s+a\\s+seizure)\\b', severity: 'CRITICAL', category: 'Medical', language: 'en' },
      { phrase: 'suicide', pattern: '\\b(suicide|killing\\s+myself|kill\\s+myself|want\\s+to\\s+die|end\\s+my\\s+life)\\b', severity: 'CRITICAL', category: 'Safety', language: 'en' },
      { phrase: 'fell down', pattern: '\\b(i\\s+fell|fell\\s+down|i\\s+tripped|i\\s+slipped)\\b', severity: 'HIGH', category: 'Physical', language: 'en' },
      { phrase: "can't get up", pattern: "\\b(can'?t\\s+get\\s+up|unable\\s+to\\s+get\\s+up|cannot\\s+get\\s+up)\\b", severity: 'HIGH', category: 'Physical', language: 'en' },
      { phrase: 'chest pain', pattern: '\\b(chest\\s+pain|chest\\s+ache|chest\\s+aches|chest\\s+pressure)\\b', severity: 'HIGH', category: 'Medical', language: 'en' },
      { phrase: 'need help', pattern: '\\b(need\\s+help|i\\s+need\\s+help|help\\s+me)\\b', severity: 'MEDIUM', category: 'Request', language: 'en' },
      { phrase: 'call 911', pattern: '\\b(call\\s+911|call\\s+emergency|emergency\\s+services)\\b', severity: 'MEDIUM', category: 'Request', language: 'en' },

      // Spanish phrases
      { phrase: 'ataque al corazón', pattern: '\\b(ataque\\s+al\\s+corazón|infarto)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
      { phrase: 'no puedo respirar', pattern: '\\b(no\\s+puedo\\s+respirar|no\\s+puedo\\s+respirar)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
      { phrase: 'me estoy ahogando', pattern: '\\b(me\\s+estoy\\s+ahogando|ahogándome)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
      { phrase: 'derrame cerebral', pattern: '\\b(derrame\\s+cerebral|accidente\\s+cerebrovascular)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
      { phrase: 'convulsión', pattern: '\\b(convulsión|convulsiones|tengo\\s+una\\s+convulsión)\\b', severity: 'CRITICAL', category: 'Medical', language: 'es' },
      { phrase: 'suicidio', pattern: '\\b(suicidio|matarme|quiero\\s+morir)\\b', severity: 'CRITICAL', category: 'Safety', language: 'es' },
      { phrase: 'me caí', pattern: '\\b(me\\s+caí|caí\\s+al\\s+suelo|me\\s+resbalé)\\b', severity: 'HIGH', category: 'Physical', language: 'es' },
      { phrase: 'no puedo levantarme', pattern: '\\b(no\\s+puedo\\s+levantarme|no\\s+me\\s+puedo\\s+levantar)\\b', severity: 'HIGH', category: 'Physical', language: 'es' },
      { phrase: 'dolor en el pecho', pattern: '\\b(dolor\\s+en\\s+el\\s+pecho|dolor\\s+de\\s+pecho)\\b', severity: 'HIGH', category: 'Medical', language: 'es' },
      { phrase: 'necesito ayuda', pattern: '\\b(necesito\\s+ayuda|ayúdame)\\b', severity: 'MEDIUM', category: 'Request', language: 'es' },
      { phrase: 'llamar ambulancia', pattern: '\\b(llamar\\s+ambulancia|llamar\\s+emergencias)\\b', severity: 'MEDIUM', category: 'Request', language: 'es' },

      // French phrases
      { phrase: 'crise cardiaque', pattern: '\\b(crise\\s+cardiaque|infarctus)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
      { phrase: 'je ne peux pas respirer', pattern: '\\b(je\\s+ne\\s+peux\\s+pas\\s+respirer|je\\s+peux\\s+pas\\s+respirer)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
      { phrase: 'je m\'étouffe', pattern: '\\b(je\\s+m\'étouffe|étouffement)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
      { phrase: 'accident vasculaire cérébral', pattern: '\\b(accident\\s+vasculaire\\s+cérébral|avc)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
      { phrase: 'convulsion', pattern: '\\b(convulsion|convulsions|j\'ai\\s+une\\s+convulsion)\\b', severity: 'CRITICAL', category: 'Medical', language: 'fr' },
      { phrase: 'suicide', pattern: '\\b(suicide|me\\s+tuer|je\\s+veux\\s+mourir)\\b', severity: 'CRITICAL', category: 'Safety', language: 'fr' },
      { phrase: 'je suis tombé', pattern: '\\b(je\\s+suis\\s+tombé|je\\s+suis\\s+tombée|je\\s+me\\s+suis\\s+cassé\\s+la\\s+figure)\\b', severity: 'HIGH', category: 'Physical', language: 'fr' },
      { phrase: 'je ne peux pas me lever', pattern: '\\b(je\\s+ne\\s+peux\\s+pas\\s+me\\s+lever|je\\s+peux\\s+pas\\s+me\\s+lever)\\b', severity: 'HIGH', category: 'Physical', language: 'fr' },
      { phrase: 'douleur à la poitrine', pattern: '\\b(douleur\\s+à\\s+la\\s+poitrine|mal\\s+à\\s+la\\s+poitrine)\\b', severity: 'HIGH', category: 'Medical', language: 'fr' },
      { phrase: 'j\'ai besoin d\'aide', pattern: '\\b(j\'ai\\s+besoin\\s+d\'aide|aidez-moi)\\b', severity: 'MEDIUM', category: 'Request', language: 'fr' },
      { phrase: 'appeler une ambulance', pattern: '\\b(appeler\\s+une\\s+ambulance|appeler\\s+les\\s+secours)\\b', severity: 'MEDIUM', category: 'Request', language: 'fr' }
    ];

    // Create a system user ID for default phrases
    const systemUserId = '000000000000000000000000'; // 24-character ObjectId

    const phrasesToCreate = defaultPhrases.map(phrase => ({
      ...phrase,
      createdBy: systemUserId,
      lastModifiedBy: systemUserId,
      isActive: true,
      description: `Default ${phrase.severity} ${phrase.category} phrase in ${phrase.language}`
    }));

    await EmergencyPhrase.insertMany(phrasesToCreate);
    logger.info(`Initialized ${phrasesToCreate.length} default emergency phrases`);
  } catch (error) {
    logger.error('Error initializing default phrases:', error);
    throw error;
  }
};

module.exports = {
  createEmergencyPhrase,
  queryEmergencyPhrases,
  getEmergencyPhraseById,
  updateEmergencyPhraseById,
  deleteEmergencyPhraseById,
  togglePhraseStatus,
  getPhraseStatistics,
  testPhrasePattern,
  bulkImportPhrases,
  exportPhrases,
  getPhrasesByLanguage,
  initializeDefaultPhrases
};
