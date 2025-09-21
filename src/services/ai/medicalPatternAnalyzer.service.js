// src/services/ai/medicalPatternAnalyzer.service.js

const natural = require('natural');
const logger = require('../../config/logger');
const { calculateVocabularyMetrics } = require('./vocabularyAnalyzer.service');
const { detectCognitiveDecline } = require('./cognitiveDeclineDetector.service');
const { analyzePsychiatricMarkers } = require('./psychiatricMarkerAnalyzer.service');

/**
 * Medical Pattern Analyzer
 * Analyzes patient conversations for cognitive and psychiatric indicators
 */
class MedicalPatternAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    
    // Configuration for analysis thresholds
    this.config = {
      vocabularyDiversityThreshold: 0.2, // 20% drop in diversity
      sentenceLengthThreshold: 0.3,      // 30% drop in sentence length
      cognitiveDeclineThreshold: 70,     // Risk score threshold
      psychiatricAlertThreshold: 75,     // Psychiatric marker threshold
      baselineMonths: 3,                 // Months for rolling baseline
    };
  }

  /**
   * Analyze a month of patient conversations
   * @param {Array} conversations - Array of conversation objects
   * @param {Object} baseline - Previous analysis results for comparison
   * @returns {Object} Analysis results with metrics and warnings
   */
  async analyzeMonth(conversations, baseline = null) {
    try {
      // Extract and combine all patient messages from conversations
      const patientMessages = await this.extractPatientMessages(conversations);
      const combinedText = patientMessages.join(' ');

      if (combinedText.length < 100) {
        return {
          cognitiveMetrics: this.getDefaultMetrics(),
          psychiatricMetrics: this.getDefaultMetrics(),
          changeFromBaseline: null,
          warnings: ['Insufficient conversation data for analysis (< 100 characters)'],
          confidence: 'low'
        };
      }

      // Perform vocabulary and complexity analysis
      const vocabularyMetrics = calculateVocabularyMetrics(combinedText);
      
      // Detect cognitive decline patterns
      const cognitiveMetrics = detectCognitiveDecline(patientMessages, combinedText);
      
      // Analyze psychiatric markers
      const psychiatricMetrics = analyzePsychiatricMarkers(combinedText, patientMessages);
      
      // Calculate changes from baseline
      const changeFromBaseline = baseline ? this.calculateBaselineChanges(
        vocabularyMetrics, 
        cognitiveMetrics, 
        psychiatricMetrics, 
        baseline
      ) : null;

      // Generate warnings based on analysis
      const warnings = this.generateWarnings(
        vocabularyMetrics,
        cognitiveMetrics,
        psychiatricMetrics,
        changeFromBaseline
      );

      return {
        cognitiveMetrics,
        psychiatricMetrics,
        vocabularyMetrics,
        changeFromBaseline,
        warnings,
        confidence: this.calculateConfidence(combinedText.length, conversations.length),
        analysisDate: new Date(),
        conversationCount: conversations.length,
        messageCount: patientMessages.length,
        totalWords: vocabularyMetrics.totalWords
      };

    } catch (error) {
      logger.error('Error in MedicalPatternAnalyzer.analyzeMonth:', error);
      return {
        cognitiveMetrics: this.getDefaultMetrics(),
        psychiatricMetrics: this.getDefaultMetrics(),
        changeFromBaseline: null,
        warnings: [`Analysis failed: ${error.message}`],
        confidence: 'none',
        error: error.message
      };
    }
  }

  /**
   * Extract patient messages from conversations
   * @param {Array} conversations - Array of conversation objects
   * @returns {Array} Array of patient message strings
   */
  async extractPatientMessages(conversations) {
    const messages = [];
    const { Message } = require('../../models');
    
    for (const conversation of conversations) {
      if (conversation.messages && Array.isArray(conversation.messages)) {
        // Check if messages are populated objects or just IDs
        if (conversation.messages.length > 0 && typeof conversation.messages[0] === 'string') {
          // Messages are IDs, need to populate them
          const populatedMessages = await Message.find({ _id: { $in: conversation.messages } });
          populatedMessages.forEach(message => {
            if (message.role === 'patient' && message.content && message.content.trim()) {
              messages.push(message.content.trim());
            }
          });
        } else {
          // Messages are already populated objects
          conversation.messages.forEach(message => {
            if (message.role === 'patient' && message.content && message.content.trim()) {
              messages.push(message.content.trim());
            }
          });
        }
      }
    }

    return messages;
  }

  /**
   * Calculate changes from baseline analysis
   * @param {Object} currentMetrics - Current analysis metrics
   * @param {Object} baseline - Baseline analysis results
   * @returns {Object} Percentage changes from baseline
   */
  calculateBaselineChanges(vocabularyMetrics, cognitiveMetrics, psychiatricMetrics, baseline) {
    const changes = {};

    // Vocabulary changes
    if (baseline.vocabularyMetrics) {
      changes.vocabulary = {
        typeTokenRatio: this.calculatePercentageChange(
          baseline.vocabularyMetrics.typeTokenRatio,
          vocabularyMetrics.typeTokenRatio
        ),
        avgWordLength: this.calculatePercentageChange(
          baseline.vocabularyMetrics.avgWordLength,
          vocabularyMetrics.avgWordLength
        ),
        avgSentenceLength: this.calculatePercentageChange(
          baseline.vocabularyMetrics.avgSentenceLength,
          vocabularyMetrics.avgSentenceLength
        ),
        complexityScore: this.calculatePercentageChange(
          baseline.vocabularyMetrics.complexityScore,
          vocabularyMetrics.complexityScore
        )
      };
    }

    // Cognitive changes
    if (baseline.cognitiveMetrics) {
      changes.cognitive = {
        riskScore: cognitiveMetrics.riskScore - baseline.cognitiveMetrics.riskScore,
        fillerWordDensity: this.calculatePercentageChange(
          baseline.cognitiveMetrics.fillerWordDensity,
          cognitiveMetrics.fillerWordDensity
        ),
        repetitionScore: this.calculatePercentageChange(
          baseline.cognitiveMetrics.repetitionScore,
          cognitiveMetrics.repetitionScore
        )
      };
    }

    // Psychiatric changes
    if (baseline.psychiatricMetrics) {
      changes.psychiatric = {
        depressionScore: psychiatricMetrics.depressionScore - baseline.psychiatricMetrics.depressionScore,
        anxietyScore: psychiatricMetrics.anxietyScore - baseline.psychiatricMetrics.anxietyScore,
        overallRiskScore: psychiatricMetrics.overallRiskScore - baseline.psychiatricMetrics.overallRiskScore
      };
    }

    return changes;
  }

  /**
   * Calculate percentage change between two values
   * @param {number} baseline - Baseline value
   * @param {number} current - Current value
   * @returns {number} Percentage change
   */
  calculatePercentageChange(baseline, current) {
    if (baseline === 0) return current > 0 ? 100 : 0;
    return ((current - baseline) / baseline) * 100;
  }

  /**
   * Generate warnings based on analysis results
   * @param {Object} vocabularyMetrics - Vocabulary analysis results
   * @param {Object} cognitiveMetrics - Cognitive analysis results
   * @param {Object} psychiatricMetrics - Psychiatric analysis results
   * @param {Object} changeFromBaseline - Changes from baseline
   * @returns {Array} Array of warning strings
   */
  generateWarnings(vocabularyMetrics, cognitiveMetrics, psychiatricMetrics, changeFromBaseline) {
    const warnings = [];

    // Vocabulary diversity warnings
    if (changeFromBaseline?.vocabulary?.typeTokenRatio < -this.config.vocabularyDiversityThreshold * 100) {
      warnings.push(`Vocabulary diversity decreased by ${Math.abs(changeFromBaseline.vocabulary.typeTokenRatio).toFixed(1)}%`);
    }

    // Sentence length warnings
    if (changeFromBaseline?.vocabulary?.avgSentenceLength < -this.config.sentenceLengthThreshold * 100) {
      warnings.push(`Average sentence length decreased by ${Math.abs(changeFromBaseline.vocabulary.avgSentenceLength).toFixed(1)}%`);
    }

    // Cognitive decline warnings
    if (cognitiveMetrics.riskScore > this.config.cognitiveDeclineThreshold) {
      warnings.push(`High cognitive decline risk score: ${cognitiveMetrics.riskScore}/100`);
    }

    // Psychiatric marker warnings
    if (psychiatricMetrics.overallRiskScore > this.config.psychiatricAlertThreshold) {
      warnings.push(`Elevated psychiatric risk indicators detected`);
    }

    if (psychiatricMetrics.depressionScore > 70) {
      warnings.push(`Depression markers detected (score: ${psychiatricMetrics.depressionScore})`);
    }

    if (psychiatricMetrics.anxietyScore > 70) {
      warnings.push(`Anxiety markers detected (score: ${psychiatricMetrics.anxietyScore})`);
    }

    return warnings;
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
   * @returns {Object} Default metrics object
   */
  getDefaultMetrics() {
    return {
      riskScore: 0,
      confidence: 'none',
      indicators: [],
      timestamp: new Date()
    };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration object
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

module.exports = MedicalPatternAnalyzer;
