// src/services/ai/psychiatricPatternDetector.service.js

const natural = require('natural');
const logger = require('../../config/logger');

/**
 * Enhanced Psychiatric Pattern Detector Service
 * Analyzes depression and anxiety markers with pronoun usage, temporal focus, and linguistic patterns
 */
class PsychiatricPatternDetector {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    this.stemmer = natural.PorterStemmer;
    
    // Pronoun categories
    this.pronouns = {
      firstPerson: ['i', 'me', 'my', 'myself', 'mine', 'we', 'us', 'our', 'ourselves'],
      secondPerson: ['you', 'your', 'yourself', 'yourselves'],
      thirdPerson: ['he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'they', 'them', 'their', 'themselves', 'it', 'its', 'itself']
    };

    // Absolutist words (black and white thinking)
    this.absolutistWords = [
      'always', 'never', 'everything', 'nothing', 'everyone', 'no one', 'nobody', 'everybody',
      'all', 'none', 'completely', 'totally', 'entirely', 'absolutely', 'perfectly',
      'impossible', 'certainly', 'definitely', 'surely', 'obviously', 'clearly'
    ];

    // Temporal indicators
    this.temporalIndicators = {
      past: ['yesterday', 'last week', 'last month', 'ago', 'before', 'earlier', 'previously', 'once', 'used to', 'was', 'were', 'had', 'did'],
      present: ['today', 'now', 'currently', 'at the moment', 'right now', 'is', 'are', 'am', 'do', 'does'],
      future: ['tomorrow', 'next week', 'next month', 'will', 'going to', 'plan to', 'hope to', 'expect to', 'future', 'soon', 'later']
    };

    // Social reference words
    this.socialWords = [
      'people', 'friends', 'family', 'everyone', 'others', 'social', 'party', 'gathering',
      'lonely', 'alone', 'isolated', 'withdrawn', 'avoid', 'meeting', 'conversation'
    ];

    // Catastrophizing language patterns
    this.catastrophizingPatterns = [
      'worst thing', 'terrible', 'awful', 'horrible', 'disaster', 'nightmare',
      'end of the world', 'everything is ruined', 'nothing will work',
      'can\'t handle', 'falling apart', 'losing control', 'going crazy'
    ];

    // Depression-specific linguistic markers
    this.depressionMarkers = {
      hopelessness: ['hopeless', 'helpless', 'worthless', 'pointless', 'no point', 'what\'s the use'],
      selfBlame: ['my fault', 'i\'m to blame', 'because of me', 'i caused', 'my mistake'],
      guilt: ['guilty', 'ashamed', 'regret', 'sorry', 'apologize', 'i should have'],
      lowEnergy: ['tired', 'exhausted', 'no energy', 'can\'t do', 'too hard', 'difficult']
    };

    // Anxiety-specific linguistic markers
    this.anxietyMarkers = {
      worry: ['worried', 'anxious', 'concerned', 'nervous', 'stressed', 'fearful'],
      uncertainty: ['maybe', 'perhaps', 'possibly', 'might', 'could', 'uncertain', 'not sure'],
      hypervigilance: ['watch out', 'be careful', 'danger', 'risky', 'unsafe', 'threat'],
      control: ['can\'t control', 'out of control', 'losing control', 'need to control']
    };
  }

  /**
   * Analyze psychiatric markers in conversations
   * @param {Array} conversations - Array of conversation objects
   * @returns {Object} Comprehensive psychiatric analysis
   */
  analyzePsychiatricMarkers(conversations) {
    try {
      if (!conversations || conversations.length === 0) {
        return this.getDefaultMetrics();
      }

      // Extract and combine patient messages
      const patientMessages = this.extractPatientMessages(conversations);
      const combinedText = patientMessages.join(' ');

      if (combinedText.length < 100) {
        return this.getDefaultMetrics();
      }

      // Perform various analyses
      const pronounAnalysis = this.analyzePronounUsage(combinedText);
      const temporalFocus = this.analyzeTemporalFocus(combinedText);
      const absolutistAnalysis = this.analyzeAbsolutistLanguage(combinedText);
      const socialAnalysis = this.analyzeSocialReferences(combinedText);
      const catastrophizingAnalysis = this.analyzeCatastrophizingLanguage(combinedText);
      
      // Calculate depression and anxiety scores
      const depressionScore = this.calculateDepressionScore(combinedText, pronounAnalysis, absolutistAnalysis, socialAnalysis);
      const anxietyScore = this.calculateAnxietyScore(combinedText, temporalFocus, catastrophizingAnalysis);

      // Analyze month-over-month trends (if baseline provided)
      const trendAnalysis = this.analyzeTrends(pronounAnalysis, temporalFocus, absolutistAnalysis);

      // Generate psychiatric indicators
      const indicators = this.generatePsychiatricIndicators({
        depressionScore,
        anxietyScore,
        pronounAnalysis,
        temporalFocus,
        absolutistAnalysis,
        socialAnalysis,
        catastrophizingAnalysis
      });

      return {
        depressionScore: Math.round(depressionScore * 100) / 100,
        anxietyScore: Math.round(anxietyScore * 100) / 100,
        pronounAnalysis,
        temporalFocus,
        absolutistAnalysis,
        socialAnalysis,
        catastrophizingAnalysis,
        trendAnalysis,
        indicators,
        confidence: this.calculateConfidence(combinedText.length, conversations.length),
        analysisDate: new Date(),
        conversationCount: conversations.length,
        messageCount: patientMessages.length,
        totalWords: this.tokenizer.tokenize(combinedText.toLowerCase()).length
      };

    } catch (error) {
      logger.error('Error in PsychiatricPatternDetector.analyzePsychiatricMarkers:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Analyze pronoun usage patterns
   * @param {string} text - Text to analyze
   * @returns {Object} Pronoun analysis results
   */
  analyzePronounUsage(text) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const totalWords = words.length;
    
    let pronounCounts = {
      firstPerson: 0,
      secondPerson: 0,
      thirdPerson: 0,
      total: 0
    };

    const foundPronouns = {
      firstPerson: {},
      secondPerson: {},
      thirdPerson: {}
    };

    words.forEach(word => {
      // Check each pronoun category
      Object.keys(this.pronouns).forEach(category => {
        if (this.pronouns[category].includes(word)) {
          pronounCounts[category]++;
          pronounCounts.total++;
          foundPronouns[category][word] = (foundPronouns[category][word] || 0) + 1;
        }
      });
    });

    // Calculate percentages
    const percentages = {
      firstPerson: totalWords > 0 ? (pronounCounts.firstPerson / totalWords) * 100 : 0,
      secondPerson: totalWords > 0 ? (pronounCounts.secondPerson / totalWords) * 100 : 0,
      thirdPerson: totalWords > 0 ? (pronounCounts.thirdPerson / totalWords) * 100 : 0
    };

    // Calculate first-person pronoun dominance
    const totalPronouns = pronounCounts.total;
    const firstPersonDominance = totalPronouns > 0 ? (pronounCounts.firstPerson / totalPronouns) * 100 : 0;

    return {
      counts: pronounCounts,
      percentages: {
        firstPerson: Math.round(percentages.firstPerson * 100) / 100,
        secondPerson: Math.round(percentages.secondPerson * 100) / 100,
        thirdPerson: Math.round(percentages.thirdPerson * 100) / 100
      },
      firstPersonDominance: Math.round(firstPersonDominance * 100) / 100,
      foundPronouns,
      mostCommonFirstPerson: this.getMostCommonItem(foundPronouns.firstPerson),
      mostCommonSecondPerson: this.getMostCommonItem(foundPronouns.secondPerson),
      mostCommonThirdPerson: this.getMostCommonItem(foundPronouns.thirdPerson)
    };
  }

  /**
   * Analyze temporal focus (past, present, future)
   * @param {string} text - Text to analyze
   * @returns {Object} Temporal focus analysis
   */
  analyzeTemporalFocus(text) {
    const lowerText = text.toLowerCase();
    let temporalCounts = {
      past: 0,
      present: 0,
      future: 0,
      total: 0
    };

    const foundTemporal = {
      past: {},
      present: {},
      future: {}
    };

    // Count temporal indicators
    Object.keys(this.temporalIndicators).forEach(tense => {
      this.temporalIndicators[tense].forEach(indicator => {
        const regex = new RegExp(`\\b${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          temporalCounts[tense] += matches.length;
          temporalCounts.total += matches.length;
          foundTemporal[tense][indicator] = matches.length;
        }
      });
    });

    // Calculate percentages
    const percentages = {
      past: temporalCounts.total > 0 ? (temporalCounts.past / temporalCounts.total) * 100 : 0,
      present: temporalCounts.total > 0 ? (temporalCounts.present / temporalCounts.total) * 100 : 0,
      future: temporalCounts.total > 0 ? (temporalCounts.future / temporalCounts.total) * 100 : 0
    };

    // Determine dominant temporal focus
    const dominantFocus = Object.keys(percentages).reduce((max, tense) => 
      percentages[tense] > percentages[max] ? tense : max, 'present'
    );

    return {
      counts: temporalCounts,
      percentages: {
        past: Math.round(percentages.past * 100) / 100,
        present: Math.round(percentages.present * 100) / 100,
        future: Math.round(percentages.future * 100) / 100
      },
      dominantFocus,
      foundTemporal,
      mostCommonPast: this.getMostCommonItem(foundTemporal.past),
      mostCommonPresent: this.getMostCommonItem(foundTemporal.present),
      mostCommonFuture: this.getMostCommonItem(foundTemporal.future)
    };
  }

  /**
   * Analyze absolutist language usage
   * @param {string} text - Text to analyze
   * @returns {Object} Absolutist language analysis
   */
  analyzeAbsolutistLanguage(text) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const totalWords = words.length;
    
    let absolutistCount = 0;
    const foundAbsolutist = {};

    words.forEach(word => {
      if (this.absolutistWords.includes(word)) {
        absolutistCount++;
        foundAbsolutist[word] = (foundAbsolutist[word] || 0) + 1;
      }
    });

    const density = totalWords > 0 ? (absolutistCount / totalWords) * 100 : 0;
    const severity = this.categorizeSeverity(density, { low: 0.5, medium: 1.0, high: 2.0 });

    return {
      count: absolutistCount,
      density: Math.round(density * 100) / 100,
      severity,
      foundAbsolutist,
      mostCommonAbsolutist: this.getMostCommonItem(foundAbsolutist),
      percentage: Math.round(density * 100) / 100
    };
  }

  /**
   * Analyze social references
   * @param {string} text - Text to analyze
   * @returns {Object} Social reference analysis
   */
  analyzeSocialReferences(text) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const totalWords = words.length;
    
    let socialCount = 0;
    const foundSocial = {};

    words.forEach(word => {
      if (this.socialWords.includes(word)) {
        socialCount++;
        foundSocial[word] = (foundSocial[word] || 0) + 1;
      }
    });

    const density = totalWords > 0 ? (socialCount / totalWords) * 100 : 0;
    const severity = this.categorizeSeverity(density, { low: 0.5, medium: 1.5, high: 3.0 });

    return {
      count: socialCount,
      density: Math.round(density * 100) / 100,
      severity,
      foundSocial,
      mostCommonSocial: this.getMostCommonItem(foundSocial),
      percentage: Math.round(density * 100) / 100
    };
  }

  /**
   * Analyze catastrophizing language
   * @param {string} text - Text to analyze
   * @returns {Object} Catastrophizing analysis
   */
  analyzeCatastrophizingLanguage(text) {
    const lowerText = text.toLowerCase();
    let catastrophizingCount = 0;
    const foundCatastrophizing = {};

    this.catastrophizingPatterns.forEach(pattern => {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        catastrophizingCount += matches.length;
        foundCatastrophizing[pattern] = matches.length;
      }
    });

    const severity = this.categorizeSeverity(catastrophizingCount, { low: 0, medium: 2, high: 4 });

    return {
      count: catastrophizingCount,
      severity,
      foundCatastrophizing,
      mostCommonCatastrophizing: this.getMostCommonItem(foundCatastrophizing)
    };
  }

  /**
   * Calculate depression score based on multiple factors
   * @param {string} text - Text to analyze
   * @param {Object} pronounAnalysis - Pronoun analysis results
   * @param {Object} absolutistAnalysis - Absolutist language analysis
   * @param {Object} socialAnalysis - Social reference analysis
   * @returns {number} Depression score (0-100)
   */
  calculateDepressionScore(text, pronounAnalysis, absolutistAnalysis, socialAnalysis) {
    let score = 0;

    // First-person pronoun dominance (higher = more depression)
    const firstPersonScore = Math.min(pronounAnalysis.firstPersonDominance * 0.5, 25);
    score += firstPersonScore;

    // Absolutist language usage (higher = more depression)
    const absolutistScore = Math.min(absolutistAnalysis.density * 10, 30);
    score += absolutistScore;

    // Social withdrawal indicators
    const socialWithdrawalWords = ['lonely', 'alone', 'isolated', 'withdrawn', 'avoid'];
    const socialWithdrawalCount = this.countWordsInText(text, socialWithdrawalWords);
    const socialScore = Math.min(socialWithdrawalCount * 5, 20);
    score += socialScore;

    // Depression-specific markers
    const depressionMarkerCount = this.countDepressionMarkers(text);
    const depressionMarkerScore = Math.min(depressionMarkerCount * 3, 25);
    score += depressionMarkerScore;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate anxiety score based on multiple factors
   * @param {string} text - Text to analyze
   * @param {Object} temporalFocus - Temporal focus analysis
   * @param {Object} catastrophizingAnalysis - Catastrophizing analysis
   * @returns {number} Anxiety score (0-100)
   */
  calculateAnxietyScore(text, temporalFocus, catastrophizingAnalysis) {
    let score = 0;

    // Future-focused language (higher = more anxiety)
    const futureFocusScore = Math.min(temporalFocus.percentages.future * 0.3, 25);
    score += futureFocusScore;

    // Catastrophizing language
    const catastrophizingScore = Math.min(catastrophizingAnalysis.count * 8, 30);
    score += catastrophizingScore;

    // Anxiety-specific markers
    const anxietyMarkerCount = this.countAnxietyMarkers(text);
    const anxietyMarkerScore = Math.min(anxietyMarkerCount * 4, 25);
    score += anxietyMarkerScore;

    // Uncertainty indicators
    const uncertaintyWords = ['maybe', 'perhaps', 'possibly', 'might', 'could', 'uncertain'];
    const uncertaintyCount = this.countWordsInText(text, uncertaintyWords);
    const uncertaintyScore = Math.min(uncertaintyCount * 3, 20);
    score += uncertaintyScore;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Analyze trends in psychiatric markers
   * @param {Object} pronounAnalysis - Current pronoun analysis
   * @param {Object} temporalFocus - Current temporal focus
   * @param {Object} absolutistAnalysis - Current absolutist analysis
   * @returns {Object} Trend analysis
   */
  analyzeTrends(pronounAnalysis, temporalFocus, absolutistAnalysis) {
    // This would typically compare with historical data
    // For now, return current analysis as baseline
    return {
      firstPersonTrend: 'stable', // would be calculated from historical data
      temporalTrend: 'stable',
      absolutistTrend: 'stable',
      overallTrend: 'stable',
      significantChanges: []
    };
  }

  /**
   * Count depression markers in text
   * @param {string} text - Text to analyze
   * @returns {number} Count of depression markers
   */
  countDepressionMarkers(text) {
    const lowerText = text.toLowerCase();
    let count = 0;

    Object.values(this.depressionMarkers).forEach(markers => {
      markers.forEach(marker => {
        const regex = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = lowerText.match(regex);
        if (matches) count += matches.length;
      });
    });

    return count;
  }

  /**
   * Count anxiety markers in text
   * @param {string} text - Text to analyze
   * @returns {number} Count of anxiety markers
   */
  countAnxietyMarkers(text) {
    const lowerText = text.toLowerCase();
    let count = 0;

    Object.values(this.anxietyMarkers).forEach(markers => {
      markers.forEach(marker => {
        const regex = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = lowerText.match(regex);
        if (matches) count += matches.length;
      });
    });

    return count;
  }

  /**
   * Count specific words in text
   * @param {string} text - Text to search
   * @param {Array} words - Words to count
   * @returns {number} Total count
   */
  countWordsInText(text, words) {
    const lowerText = text.toLowerCase();
    let count = 0;

    words.forEach(word => {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) count += matches.length;
    });

    return count;
  }

  /**
   * Generate psychiatric indicators based on analysis
   * @param {Object} analyses - All analysis results
   * @returns {Array} Array of indicator objects
   */
  generatePsychiatricIndicators(analyses) {
    const indicators = [];

    // Depression indicators
    if (analyses.depressionScore > 70) {
      indicators.push({
        type: 'depression',
        severity: 'high',
        message: `High depression indicators detected (score: ${analyses.depressionScore})`,
        details: {
          firstPersonDominance: analyses.pronounAnalysis.firstPersonDominance,
          absolutistDensity: analyses.absolutistAnalysis.density
        }
      });
    }

    // Anxiety indicators
    if (analyses.anxietyScore > 70) {
      indicators.push({
        type: 'anxiety',
        severity: 'high',
        message: `High anxiety indicators detected (score: ${analyses.anxietyScore})`,
        details: {
          futureFocus: analyses.temporalFocus.percentages.future,
          catastrophizingCount: analyses.catastrophizingAnalysis.count
        }
      });
    }

    // Pronoun usage indicators
    if (analyses.pronounAnalysis.firstPersonDominance > 80) {
      indicators.push({
        type: 'pronoun_usage',
        severity: 'medium',
        message: `High first-person pronoun usage (${analyses.pronounAnalysis.firstPersonDominance}%)`,
        details: 'May indicate self-focus or depression'
      });
    }

    // Absolutist language indicators
    if (analyses.absolutistAnalysis.density > 2.0) {
      indicators.push({
        type: 'absolutist_language',
        severity: 'medium',
        message: `High absolutist language usage (${analyses.absolutistAnalysis.density}%)`,
        details: 'May indicate black-and-white thinking patterns'
      });
    }

    return indicators;
  }

  /**
   * Extract patient messages from conversations
   * @param {Array} conversations - Array of conversation objects
   * @returns {Array} Array of patient message strings
   */
  extractPatientMessages(conversations) {
    const messages = [];
    
    conversations.forEach(conversation => {
      if (conversation.messages && Array.isArray(conversation.messages)) {
        conversation.messages.forEach(message => {
          if (message.role === 'patient' && message.content && message.content.trim()) {
            messages.push(message.content.trim());
          }
        });
      }
    });

    return messages;
  }

  /**
   * Get most common item from frequency map
   * @param {Object} frequencyMap - Map of items to frequencies
   * @returns {string|null} Most common item
   */
  getMostCommonItem(frequencyMap) {
    const entries = Object.entries(frequencyMap);
    if (entries.length === 0) return null;
    
    return entries.reduce((max, [item, count]) => 
      count > (frequencyMap[max] || 0) ? item : max
    );
  }

  /**
   * Categorize severity based on thresholds
   * @param {number} value - Value to categorize
   * @param {Object} thresholds - Severity thresholds
   * @returns {string} Severity level
   */
  categorizeSeverity(value, thresholds) {
    if (value >= thresholds.high) return 'high';
    if (value >= thresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Calculate confidence level of analysis
   * @param {number} textLength - Length of analyzed text
   * @param {number} conversationCount - Number of conversations
   * @returns {string} Confidence level
   */
  calculateConfidence(textLength, conversationCount) {
    if (textLength < 500 || conversationCount < 3) return 'low';
    if (textLength < 2000 || conversationCount < 10) return 'medium';
    return 'high';
  }

  /**
   * Get default metrics structure
   * @returns {Object} Default metrics
   */
  getDefaultMetrics() {
    return {
      depressionScore: 0,
      anxietyScore: 0,
      pronounAnalysis: {
        counts: { firstPerson: 0, secondPerson: 0, thirdPerson: 0, total: 0 },
        percentages: { firstPerson: 0, secondPerson: 0, thirdPerson: 0 },
        firstPersonDominance: 0,
        foundPronouns: { firstPerson: {}, secondPerson: {}, thirdPerson: {} },
        mostCommonFirstPerson: null,
        mostCommonSecondPerson: null,
        mostCommonThirdPerson: null
      },
      temporalFocus: {
        counts: { past: 0, present: 0, future: 0, total: 0 },
        percentages: { past: 0, present: 0, future: 0 },
        dominantFocus: 'present',
        foundTemporal: { past: {}, present: {}, future: {} },
        mostCommonPast: null,
        mostCommonPresent: null,
        mostCommonFuture: null
      },
      absolutistAnalysis: {
        count: 0,
        density: 0,
        severity: 'low',
        foundAbsolutist: {},
        mostCommonAbsolutist: null,
        percentage: 0
      },
      socialAnalysis: {
        count: 0,
        density: 0,
        severity: 'low',
        foundSocial: {},
        mostCommonSocial: null,
        percentage: 0
      },
      catastrophizingAnalysis: {
        count: 0,
        severity: 'low',
        foundCatastrophizing: {},
        mostCommonCatastrophizing: null
      },
      trendAnalysis: {
        firstPersonTrend: 'stable',
        temporalTrend: 'stable',
        absolutistTrend: 'stable',
        overallTrend: 'stable',
        significantChanges: []
      },
      indicators: [],
      confidence: 'none',
      analysisDate: new Date(),
      conversationCount: 0,
      messageCount: 0,
      totalWords: 0
    };
  }
}

// Create singleton instance
const psychiatricPatternDetector = new PsychiatricPatternDetector();

// Export both the class and the singleton function
module.exports = {
  PsychiatricPatternDetector,
  analyzePsychiatricMarkers: (conversations) => psychiatricPatternDetector.analyzePsychiatricMarkers(conversations)
};
