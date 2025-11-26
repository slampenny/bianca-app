const EmergencyPhrase = require('../models/emergencyPhrase.model');
const logger = require('../config/logger');

/**
 * Localized Emergency Detection Service
 * Detects emergency patterns in multiple languages using database-stored phrases
 */
class LocalizedEmergencyDetector {
  constructor() {
    this.phraseCache = new Map(); // Cache for compiled patterns
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.lastCacheUpdate = 0;
    this.initialized = false;
  }

  /**
   * Initialize the detector by loading phrases from database
   */
  async initialize() {
    try {
      await this.loadPhrases();
      this.initialized = true;
      logger.info('LocalizedEmergencyDetector initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize LocalizedEmergencyDetector:', error);
      this.initialized = false;
    }
  }

  /**
   * Load phrases from database into cache
   */
  async loadPhrases() {
    try {
      const phrases = await EmergencyPhrase.find({ isActive: true });
      this.phraseCache.clear();
      
      phrases.forEach(phrase => {
        const language = phrase.language;
        if (!this.phraseCache.has(language)) {
          this.phraseCache.set(language, []);
        }
        this.phraseCache.get(language).push(phrase);
      });
      
      this.lastCacheUpdate = Date.now();
      logger.info(`Loaded ${phrases.length} emergency phrases for ${this.phraseCache.size} languages`);
    } catch (error) {
      logger.error('Error loading emergency phrases:', error);
    }
  }

  /**
   * Detect emergency patterns in the given text using patient's language
   * @param {string} text - The text to analyze
   * @param {string} language - Patient's preferred language (default: 'en')
   * @returns {Promise<Object>} - Emergency detection result
   */
  async detectEmergency(text, language = 'en') {
    try {
      // Ensure initialization
      if (!this.initialized) {
        await this.initialize();
      }

      // Validate inputs
      if (!text || typeof text !== 'string') {
        return { 
          isEmergency: false, 
          severity: null, 
          matchedPhrase: null, 
          category: null,
          language: language
        };
      }

      // Clean and normalize text
      const normalizedText = text.trim();
      if (normalizedText.length === 0) {
        return { 
          isEmergency: false, 
          severity: null, 
          matchedPhrase: null, 
          category: null,
          language: language
        };
      }

      // Get phrases for the specified language from cache
      const phrases = this.phraseCache.get(language) || [];
      
      if (phrases.length === 0) {
        logger.warn(`No emergency phrases found for language: ${language}`);
        return { 
          isEmergency: false, 
          severity: null, 
          matchedPhrase: null, 
          category: null,
          language: language
        };
      }

      // Check each phrase and return the highest severity match
      let highestSeverityMatch = null;
      const severityOrder = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1 };

      // Log the text being analyzed for debugging
      if (normalizedText.toLowerCase().includes('heart') || normalizedText.toLowerCase().includes('attack')) {
        logger.info(`[Emergency Detection] Analyzing text for heart attack: "${normalizedText}"`);
      }

      for (const phraseDoc of phrases) {
        try {
          const pattern = this.getCompiledPattern(phraseDoc);
          if (pattern) {
            const matches = pattern.test(normalizedText);
            if (matches) {
              // Log when heart attack pattern is tested
              if (phraseDoc.phrase === 'heart attack') {
                logger.info(`[Emergency Detection] Heart attack pattern matched! Pattern: ${phraseDoc.pattern}, Text: "${normalizedText}"`);
              }
              // If no match yet or this match has higher severity
              if (!highestSeverityMatch || 
                  severityOrder[phraseDoc.severity] > severityOrder[highestSeverityMatch.severity]) {
                highestSeverityMatch = {
                  phrase: phraseDoc.phrase,
                  severity: phraseDoc.severity,
                  category: phraseDoc.category,
                  phraseId: phraseDoc._id
                };
              }
            }
          }
        } catch (error) {
          logger.error(`Error testing pattern for phrase ${phraseDoc.phrase}:`, error);
        }
      }

      // Return the highest severity match or no emergency
      if (highestSeverityMatch) {
        // Increment usage count for the matched phrase
        try {
          await EmergencyPhrase.findByIdAndUpdate(
            highestSeverityMatch.phraseId,
            { 
              $inc: { usageCount: 1 },
              $set: { lastUsed: new Date() }
            }
          );
        } catch (error) {
          logger.error('Error updating phrase usage count:', error);
        }

        return {
          isEmergency: true,
          severity: highestSeverityMatch.severity,
          phrase: highestSeverityMatch.phrase,
          matchedPhrase: highestSeverityMatch.phrase, // Keep both for compatibility
          category: highestSeverityMatch.category,
          language: language,
          phraseId: highestSeverityMatch.phraseId
        };
      }

      // No emergency patterns found
      return { 
        isEmergency: false, 
        severity: null, 
        matchedPhrase: null, 
        category: null,
        language: language
      };

    } catch (error) {
      logger.error('Error in localized emergency detection:', error);
      return { 
        isEmergency: false, 
        severity: null, 
        matchedPhrase: null, 
        category: null,
        language: language,
        error: error.message
      };
    }
  }

  /**
   * Get all emergency phrases for a specific language
   * @param {string} language - Language code
   * @returns {Promise<Array>} - Array of phrase documents
   */
  async getPhrasesForLanguage(language) {
    try {
      // Check cache first
      if (this.isCacheValid() && this.phraseCache.has(language)) {
        return this.phraseCache.get(language);
      }

      // Fetch from database
      const phrases = await EmergencyPhrase.getActivePhrases(language);
      
      // Update cache
      this.phraseCache.set(language, phrases);
      this.lastCacheUpdate = Date.now();

      return phrases;
    } catch (error) {
      logger.error(`Error fetching phrases for language ${language}:`, error);
      return [];
    }
  }

  /**
   * Get compiled regex pattern for a phrase document
   * @param {Object} phraseDoc - Phrase document from database
   * @returns {RegExp|null} - Compiled pattern or null if invalid
   */
  getCompiledPattern(phraseDoc) {
    const cacheKey = `${phraseDoc._id}-${phraseDoc.pattern}`;
    
    if (this.phraseCache.has(cacheKey)) {
      return this.phraseCache.get(cacheKey);
    }

    try {
      const pattern = new RegExp(phraseDoc.pattern, 'i');
      this.phraseCache.set(cacheKey, pattern);
      return pattern;
    } catch (error) {
      logger.error(`Invalid regex pattern for phrase ${phraseDoc.phrase}: ${phraseDoc.pattern}`, error);
      return null;
    }
  }

  /**
   * Check if cache is still valid
   * @returns {boolean} - True if cache is valid
   */
  isCacheValid() {
    return (Date.now() - this.lastCacheUpdate) < this.cacheExpiry;
  }

  /**
   * Clear the phrase cache
   */
  clearCache() {
    this.phraseCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Get all matched emergency patterns in the text (for debugging/analysis)
   * @param {string} text - The text to analyze
   * @param {string} language - Patient's preferred language
   * @returns {Promise<Array>} - Array of matched phrases with details
   */
  async getAllEmergencyPatterns(text, language = 'en') {
    try {
      if (!text || typeof text !== 'string') {
        return [];
      }

      const phrases = await this.getPhrasesForLanguage(language);
      const matchedPatterns = [];
      const normalizedText = text.trim();

      for (const phraseDoc of phrases) {
        try {
          const pattern = this.getCompiledPattern(phraseDoc);
          if (pattern && pattern.test(normalizedText)) {
            matchedPatterns.push({
              phrase: phraseDoc.phrase,
              severity: phraseDoc.severity,
              category: phraseDoc.category,
              phraseId: phraseDoc._id,
              language: phraseDoc.language
            });
          }
        } catch (error) {
          logger.error(`Error testing pattern for phrase ${phraseDoc.phrase}:`, error);
        }
      }

      return matchedPatterns;
    } catch (error) {
      logger.error('Error getting all emergency patterns:', error);
      return [];
    }
  }

  /**
   * Get statistics about phrase usage
   * @param {string} language - Language code (optional)
   * @returns {Promise<Object>} - Usage statistics
   */
  async getPhraseStatistics(language = null) {
    try {
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
    } catch (error) {
      logger.error('Error getting phrase statistics:', error);
      return null;
    }
  }
}

// Create singleton instance
const localizedEmergencyDetector = new LocalizedEmergencyDetector();

module.exports = {
  LocalizedEmergencyDetector,
  localizedEmergencyDetector
};
