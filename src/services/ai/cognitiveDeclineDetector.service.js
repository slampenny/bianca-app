// src/services/ai/cognitiveDeclineDetector.service.js

const natural = require('natural');
const logger = require('../../config/logger');

/**
 * Cognitive Decline Detector Service
 * Detects cognitive decline patterns in patient conversations
 */
class CognitiveDeclineDetector {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    
    // Cognitive markers for detection
    this.cognitiveMarkers = {
      fillerWords: [
        'um', 'uh', 'er', 'hmm', 'ah', 'oh', 'well', 'you know', 'sort of', 'kind of',
        'like', 'basically', 'actually', 'literally', 'really', 'just', 'so', 'then'
      ],
      vagueReferences: [
        'thing', 'stuff', 'whatnot', 'whatsit', 'thingy', 'gizmo', 'doohickey',
        'whatchamacallit', 'thingamajig', 'whatever', 'something', 'anything'
      ],
      temporalConfusion: [
        'wait when was', 'i forget if', 'was it yesterday or', 'i think it was',
        'when did i', 'i can\'t remember when', 'was that today', 'is it today',
        'what day is it', 'i don\'t know what time', 'was that this week'
      ],
      wordFindingDifficulties: [
        'the word for', 'what\'s it called', 'how do you say', 'i can\'t think of',
        'it\'s on the tip of my tongue', 'i know what i mean', 'you know what i mean'
      ],
      repetitionPatterns: [
        'i already said', 'like i told you', 'as i mentioned', 'i said before',
        'like i said', 'i told you already', 'i mentioned that'
      ]
    };

    // Weights for different cognitive indicators
    this.weights = {
      fillerWords: 0.15,
      vagueReferences: 0.20,
      temporalConfusion: 0.25,
      wordFindingDifficulties: 0.25,
      repetitionPatterns: 0.15
    };
  }

  /**
   * Detect cognitive decline patterns in patient messages
   * @param {Array} patientMessages - Array of patient message strings
   * @param {string} combinedText - Combined text from all messages
   * @returns {Object} Cognitive decline analysis results
   */
  detectCognitiveDecline(patientMessages, combinedText) {
    try {
      if (!patientMessages || patientMessages.length === 0) {
        return this.getDefaultMetrics();
      }

      // Analyze individual cognitive markers
      const fillerWordAnalysis = this.analyzeFillerWords(combinedText);
      const vagueReferenceAnalysis = this.analyzeVagueReferences(combinedText);
      const temporalConfusionAnalysis = this.analyzeTemporalConfusion(combinedText);
      const wordFindingAnalysis = this.analyzeWordFindingDifficulties(combinedText);
      const repetitionAnalysis = this.analyzeRepetitionPatterns(patientMessages);

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore({
        fillerWords: fillerWordAnalysis,
        vagueReferences: vagueReferenceAnalysis,
        temporalConfusion: temporalConfusionAnalysis,
        wordFinding: wordFindingAnalysis,
        repetition: repetitionAnalysis
      });

      // Analyze information density
      const informationDensity = this.analyzeInformationDensity(patientMessages);

      // Detect conversation flow patterns
      const conversationFlow = this.analyzeConversationFlow(patientMessages);

      // Generate indicators and warnings
      const indicators = this.generateCognitiveIndicators({
        fillerWords: fillerWordAnalysis,
        vagueReferences: vagueReferenceAnalysis,
        temporalConfusion: temporalConfusionAnalysis,
        wordFinding: wordFindingAnalysis,
        repetition: repetitionAnalysis,
        informationDensity,
        conversationFlow
      });

      return {
        riskScore: Math.round(riskScore * 100) / 100,
        confidence: this.calculateConfidence(combinedText.length, patientMessages.length),
        indicators,
        fillerWordDensity: fillerWordAnalysis.density,
        vagueReferenceDensity: vagueReferenceAnalysis.density,
        temporalConfusionCount: temporalConfusionAnalysis.count,
        wordFindingDifficultyCount: wordFindingAnalysis.count,
        repetitionScore: repetitionAnalysis.score,
        informationDensity: informationDensity.score,
        conversationFlow: conversationFlow.score,
        detailedAnalysis: {
          fillerWords: fillerWordAnalysis,
          vagueReferences: vagueReferenceAnalysis,
          temporalConfusion: temporalConfusionAnalysis,
          wordFinding: wordFindingAnalysis,
          repetition: repetitionAnalysis,
          informationDensity,
          conversationFlow
        },
        timestamp: new Date(),
        messageCount: patientMessages.length,
        totalWords: this.tokenizer.tokenize(combinedText.toLowerCase()).length
      };

    } catch (error) {
      logger.error('Error in CognitiveDeclineDetector.detectCognitiveDecline:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Analyze filler word usage
   * @param {string} text - Text to analyze
   * @returns {Object} Filler word analysis results
   */
  analyzeFillerWords(text) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const totalWords = words.length;
    
    let fillerCount = 0;
    const foundFillers = {};

    words.forEach(word => {
      if (this.cognitiveMarkers.fillerWords.includes(word)) {
        fillerCount++;
        foundFillers[word] = (foundFillers[word] || 0) + 1;
      }
    });

    const density = totalWords > 0 ? fillerCount / totalWords : 0;
    const severity = this.categorizeSeverity(density, {
      low: 0.02,
      medium: 0.05,
      high: 0.08
    });

    return {
      count: fillerCount,
      density: Math.round(density * 10000) / 10000,
      severity,
      foundFillers,
      mostCommonFiller: this.getMostCommonItem(foundFillers)
    };
  }

  /**
   * Analyze vague reference usage
   * @param {string} text - Text to analyze
   * @returns {Object} Vague reference analysis results
   */
  analyzeVagueReferences(text) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const totalWords = words.length;
    
    let vagueCount = 0;
    const foundVague = {};

    words.forEach(word => {
      if (this.cognitiveMarkers.vagueReferences.includes(word)) {
        vagueCount++;
        foundVague[word] = (foundVague[word] || 0) + 1;
      }
    });

    const density = totalWords > 0 ? vagueCount / totalWords : 0;
    const severity = this.categorizeSeverity(density, {
      low: 0.01,
      medium: 0.03,
      high: 0.05
    });

    return {
      count: vagueCount,
      density: Math.round(density * 10000) / 10000,
      severity,
      foundVague,
      mostCommonVague: this.getMostCommonItem(foundVague)
    };
  }

  /**
   * Analyze temporal confusion markers
   * @param {string} text - Text to analyze
   * @returns {Object} Temporal confusion analysis results
   */
  analyzeTemporalConfusion(text) {
    const lowerText = text.toLowerCase();
    let confusionCount = 0;
    const foundPatterns = {};

    this.cognitiveMarkers.temporalConfusion.forEach(pattern => {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        confusionCount += matches.length;
        foundPatterns[pattern] = matches.length;
      }
    });

    const severity = this.categorizeSeverity(confusionCount, {
      low: 1,
      medium: 3,
      high: 5
    });

    return {
      count: confusionCount,
      severity,
      foundPatterns,
      mostCommonPattern: this.getMostCommonItem(foundPatterns)
    };
  }

  /**
   * Analyze word-finding difficulties
   * @param {string} text - Text to analyze
   * @returns {Object} Word-finding analysis results
   */
  analyzeWordFindingDifficulties(text) {
    const lowerText = text.toLowerCase();
    let difficultyCount = 0;
    const foundPatterns = {};

    this.cognitiveMarkers.wordFindingDifficulties.forEach(pattern => {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        difficultyCount += matches.length;
        foundPatterns[pattern] = matches.length;
      }
    });

    const severity = this.categorizeSeverity(difficultyCount, {
      low: 1,
      medium: 2,
      high: 4
    });

    return {
      count: difficultyCount,
      severity,
      foundPatterns,
      mostCommonPattern: this.getMostCommonItem(foundPatterns)
    };
  }

  /**
   * Analyze repetition patterns across messages
   * @param {Array} messages - Array of message strings
   * @returns {Object} Repetition analysis results
   */
  analyzeRepetitionPatterns(messages) {
    if (messages.length < 2) {
      return { score: 0, severity: 'low', patterns: [] };
    }

    const repetitionPatterns = [];
    const phraseCounts = {};
    
    // Look for repeated phrases within and across messages
    messages.forEach((message, index) => {
      const sentences = this.sentenceTokenizer.tokenize(message);
      
      sentences.forEach(sentence => {
        const words = this.tokenizer.tokenize(sentence.toLowerCase());
        
        // Check for 3+ word phrases
        for (let i = 0; i <= words.length - 3; i++) {
          const phrase = words.slice(i, i + 3).join(' ');
          if (phrase.length > 10) { // Only consider meaningful phrases
            phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
          }
        }
      });
    });

    // Find repeated phrases
    Object.entries(phraseCounts).forEach(([phrase, count]) => {
      if (count > 1) {
        repetitionPatterns.push({ phrase, count, severity: this.categorizeSeverity(count, { low: 2, medium: 3, high: 4 }) });
      }
    });

    // Calculate overall repetition score
    const totalPhrases = Object.keys(phraseCounts).length;
    const repeatedPhrases = repetitionPatterns.length;
    const score = totalPhrases > 0 ? (repeatedPhrases / totalPhrases) * 100 : 0;

    const severity = this.categorizeSeverity(score, {
      low: 10,
      medium: 20,
      high: 30
    });

    return {
      score: Math.round(score * 100) / 100,
      severity,
      patterns: repetitionPatterns.slice(0, 10), // Top 10 patterns
      totalRepeatedPhrases: repeatedPhrases,
      totalUniquePhrases: totalPhrases
    };
  }

  /**
   * Analyze information density in messages
   * @param {Array} messages - Array of message strings
   * @returns {Object} Information density analysis
   */
  analyzeInformationDensity(messages) {
    let totalWords = 0;
    let totalConcepts = 0;
    let totalSentences = 0;

    messages.forEach(message => {
      const words = this.tokenizer.tokenize(message.toLowerCase());
      const sentences = this.sentenceTokenizer.tokenize(message);
      
      totalWords += words.length;
      totalSentences += sentences.length;
      
      // Estimate concepts by counting meaningful words (excluding common words)
      const meaningfulWords = words.filter(word => 
        word.length > 3 && !this.cognitiveMarkers.fillerWords.includes(word)
      );
      totalConcepts += meaningfulWords.length;
    });

    const avgConceptsPerSentence = totalSentences > 0 ? totalConcepts / totalSentences : 0;
    const conceptsPerWord = totalWords > 0 ? totalConcepts / totalWords : 0;
    
    // Calculate density score (0-100)
    const densityScore = Math.min(avgConceptsPerSentence * 10, 100);

    const severity = this.categorizeSeverity(100 - densityScore, {
      low: 20,
      medium: 40,
      high: 60
    });

    return {
      score: Math.round(densityScore * 100) / 100,
      severity,
      avgConceptsPerSentence: Math.round(avgConceptsPerSentence * 100) / 100,
      conceptsPerWord: Math.round(conceptsPerWord * 10000) / 10000,
      totalConcepts,
      totalWords,
      totalSentences
    };
  }

  /**
   * Analyze conversation flow patterns
   * @param {Array} messages - Array of message strings
   * @returns {Object} Conversation flow analysis
   */
  analyzeConversationFlow(messages) {
    if (messages.length < 3) {
      return { score: 100, severity: 'low', patterns: [] };
    }

    let flowIssues = 0;
    const patterns = [];

    // Check for abrupt topic changes
    for (let i = 1; i < messages.length; i++) {
      const prevWords = this.tokenizer.tokenize(messages[i-1].toLowerCase());
      const currWords = this.tokenizer.tokenize(messages[i].toLowerCase());
      
      // Simple topic coherence check (shared meaningful words)
      const prevMeaningful = prevWords.filter(word => word.length > 4);
      const currMeaningful = currWords.filter(word => word.length > 4);
      
      const sharedWords = prevMeaningful.filter(word => currMeaningful.includes(word));
      const coherenceRatio = prevMeaningful.length > 0 ? sharedWords.length / prevMeaningful.length : 0;
      
      if (coherenceRatio < 0.1) {
        flowIssues++;
        patterns.push({
          type: 'topic_change',
          messageIndex: i,
          coherenceRatio: Math.round(coherenceRatio * 100) / 100
        });
      }
    }

    // Calculate flow score
    const maxPossibleIssues = messages.length - 1;
    const flowScore = maxPossibleIssues > 0 ? ((maxPossibleIssues - flowIssues) / maxPossibleIssues) * 100 : 100;

    const severity = this.categorizeSeverity(100 - flowScore, {
      low: 20,
      medium: 40,
      high: 60
    });

    return {
      score: Math.round(flowScore * 100) / 100,
      severity,
      flowIssues,
      patterns: patterns.slice(0, 5) // Top 5 patterns
    };
  }

  /**
   * Calculate overall risk score from all indicators
   * @param {Object} analyses - All analysis results
   * @returns {number} Risk score (0-100)
   */
  calculateRiskScore(analyses) {
    let weightedScore = 0;
    let totalWeight = 0;

    // Filler words contribution
    weightedScore += analyses.fillerWords.density * 10000 * this.weights.fillerWords;
    totalWeight += this.weights.fillerWords;

    // Vague references contribution
    weightedScore += analyses.vagueReferences.density * 10000 * this.weights.vagueReferences;
    totalWeight += this.weights.vagueReferences;

    // Temporal confusion contribution (count-based)
    const temporalScore = Math.min(analyses.temporalConfusion.count * 10, 100);
    weightedScore += temporalScore * this.weights.temporalConfusion;
    totalWeight += this.weights.temporalConfusion;

    // Word finding difficulties contribution (count-based)
    const wordFindingScore = Math.min(analyses.wordFinding.count * 15, 100);
    weightedScore += wordFindingScore * this.weights.wordFindingDifficulties;
    totalWeight += this.weights.wordFindingDifficulties;

    // Repetition contribution
    weightedScore += analyses.repetition.score * this.weights.repetitionPatterns;
    totalWeight += this.weights.repetitionPatterns;

    const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    return Math.min(Math.max(finalScore, 0), 100);
  }

  /**
   * Generate cognitive indicators based on analysis
   * @param {Object} analyses - All analysis results
   * @returns {Array} Array of indicator objects
   */
  generateCognitiveIndicators(analyses) {
    const indicators = [];

    // Filler word indicators
    if (analyses.fillerWords.severity === 'high' || analyses.fillerWords.severity === 'medium') {
      indicators.push({
        type: 'filler_words',
        severity: 'high',
        message: `High filler word usage detected (${(analyses.fillerWords.density * 100).toFixed(2)}% of words)`,
        details: analyses.fillerWords.mostCommonFiller
      });
    }

    // Vague reference indicators
    if (analyses.vagueReferences.severity === 'high' || analyses.vagueReferences.severity === 'medium') {
      indicators.push({
        type: 'vague_references',
        severity: 'high',
        message: `Excessive use of vague references (${(analyses.vagueReferences.density * 100).toFixed(2)}% of words)`,
        details: analyses.vagueReferences.mostCommonVague
      });
    }

    // Temporal confusion indicators
    if (analyses.temporalConfusion.severity === 'high') {
      indicators.push({
        type: 'temporal_confusion',
        severity: 'high',
        message: `Multiple temporal confusion markers detected (${analyses.temporalConfusion.count} instances)`,
        details: analyses.temporalConfusion.mostCommonPattern
      });
    }

    // Word finding indicators
    if (analyses.wordFinding.severity === 'high') {
      indicators.push({
        type: 'word_finding',
        severity: 'high',
        message: `Word-finding difficulties detected (${analyses.wordFinding.count} instances)`,
        details: analyses.wordFinding.mostCommonPattern
      });
    }

    // Repetition indicators
    if (analyses.repetition.severity === 'high') {
      indicators.push({
        type: 'repetition',
        severity: 'high',
        message: `High repetition patterns detected (${analyses.repetition.score.toFixed(1)}% score)`,
        details: `${analyses.repetition.totalRepeatedPhrases} repeated phrases`
      });
    }

    // Information density indicators
    if (analyses.informationDensity.severity === 'high' || analyses.informationDensity.severity === 'medium') {
      indicators.push({
        type: 'information_density',
        severity: 'medium',
        message: `Low information density detected (${analyses.informationDensity.score.toFixed(1)}/100)`,
        details: `${analyses.informationDensity.avgConceptsPerSentence.toFixed(2)} concepts per sentence`
      });
    }

    return indicators;
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
   * Calculate confidence level of analysis
   * @param {number} textLength - Length of analyzed text
   * @param {number} messageCount - Number of messages
   * @returns {string} Confidence level
   */
  calculateConfidence(textLength, messageCount) {
    if (textLength < 500 || messageCount < 3) return 'low';
    if (textLength < 2000 || messageCount < 10) return 'medium';
    return 'high';
  }

  /**
   * Get default metrics structure
   * @returns {Object} Default metrics
   */
  getDefaultMetrics() {
    return {
      riskScore: 0,
      confidence: 'none',
      indicators: [],
      fillerWordDensity: 0,
      vagueReferenceDensity: 0,
      temporalConfusionCount: 0,
      wordFindingDifficultyCount: 0,
      repetitionScore: 0,
      informationDensity: { score: 0 },
      conversationFlow: { score: 100 },
      detailedAnalysis: {},
      timestamp: new Date(),
      messageCount: 0,
      totalWords: 0
    };
  }
}

// Create singleton instance
const cognitiveDeclineDetector = new CognitiveDeclineDetector();

// Export both the class and the singleton function
module.exports = {
  CognitiveDeclineDetector,
  detectCognitiveDecline: (messages, text) => cognitiveDeclineDetector.detectCognitiveDecline(messages, text)
};
