// src/services/ai/speechPatternAnalyzer.service.js

const natural = require('natural');
const logger = require('../../config/logger');

/**
 * Speech Pattern Analyzer Service
 * Analyzes speech patterns for neurological conditions and cognitive indicators
 */
class SpeechPatternAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    this.stemmer = natural.PorterStemmer;
    
    // Configuration
    this.config = {
      minUtteranceLength: 5,      // Minimum words for meaningful utterance
      maxUtteranceLength: 100,    // Maximum words for single utterance
      incompleteThreshold: 0.3,   // Threshold for incomplete sentences
      topicCoherenceThreshold: 0.5, // Threshold for topic coherence
      wordSubstitutionThreshold: 0.05 // Threshold for word substitutions
    };

    // Common word substitutions that might indicate aphasia
    this.commonSubstitutions = {
      'spoon': ['fork', 'knife', 'utensil'],
      'cup': ['glass', 'mug', 'drink'],
      'chair': ['seat', 'stool', 'bench'],
      'table': ['desk', 'surface'],
      'car': ['vehicle', 'auto', 'truck'],
      'house': ['home', 'building', 'place'],
      'dog': ['animal', 'pet', 'puppy'],
      'cat': ['animal', 'pet', 'kitten']
    };

    // Speech pattern indicators for different conditions
    this.neurologicalMarkers = {
      parkinsons: {
        shortUtterances: true,
        reducedComplexity: true,
        monotonePattern: true,
        wordFindingDifficulties: true
      },
      aphasia: {
        wordSubstitutions: true,
        incompleteSentences: true,
        grammaticalErrors: true,
        comprehensionIssues: true
      },
      dementia: {
        repetition: true,
        topicDrift: true,
        memoryLapses: true,
        temporalConfusion: true
      }
    };

    // Topic coherence indicators
    this.coherenceMarkers = {
      topicShiftWords: ['anyway', 'speaking of', 'by the way', 'oh', 'wait', 'actually'],
      continuityWords: ['and', 'so', 'then', 'next', 'after', 'because', 'since'],
      conclusionWords: ['finally', 'in conclusion', 'to sum up', 'overall']
    };
  }

  /**
   * Analyze speech patterns in conversations
   * @param {Array} conversations - Array of conversation objects
   * @returns {Object} Speech pattern analysis results
   */
  analyzeSpeechPatterns(conversations) {
    try {
      if (!conversations || conversations.length === 0) {
        return this.getDefaultMetrics();
      }

      // Extract patient messages
      const patientMessages = this.extractPatientMessages(conversations);
      
      if (patientMessages.length === 0) {
        return this.getDefaultMetrics();
      }

      // Analyze utterance lengths
      const utteranceAnalysis = this.analyzeUtteranceLengths(patientMessages);
      
      // Detect incomplete sentences
      const incompleteAnalysis = this.analyzeIncompleteSentences(patientMessages);
      
      // Analyze topic coherence
      const coherenceAnalysis = this.analyzeTopicCoherence(conversations);
      
      // Detect word substitutions
      const substitutionAnalysis = this.analyzeWordSubstitutions(patientMessages);
      
      // Detect speech abnormalities
      const abnormalityAnalysis = this.detectSpeechAbnormalities(patientMessages);
      
      // Analyze temporal patterns
      const temporalAnalysis = this.analyzeTemporalPatterns(patientMessages);

      // Calculate overall speech health score
      const speechHealthScore = this.calculateSpeechHealthScore(
        utteranceAnalysis,
        incompleteAnalysis,
        coherenceAnalysis,
        substitutionAnalysis,
        abnormalityAnalysis
      );

      // Generate neurological indicators
      const neurologicalIndicators = this.generateNeurologicalIndicators({
        utteranceAnalysis,
        incompleteAnalysis,
        coherenceAnalysis,
        substitutionAnalysis,
        abnormalityAnalysis
      });

      return {
        avgUtteranceLength: utteranceAnalysis.averageLength,
        utteranceDistribution: utteranceAnalysis.distribution,
        incompleteSentences: incompleteAnalysis.percentage,
        topicCoherence: coherenceAnalysis.score,
        wordSubstitutions: substitutionAnalysis.count,
        speechAbnormalities: abnormalityAnalysis.abnormalities,
        speechHealthScore: Math.round(speechHealthScore * 100) / 100,
        neurologicalIndicators,
        temporalPatterns: temporalAnalysis,
        confidence: this.calculateConfidence(patientMessages.length, conversations.length),
        analysisDate: new Date(),
        conversationCount: conversations.length,
        messageCount: patientMessages.length,
        totalWords: utteranceAnalysis.totalWords
      };

    } catch (error) {
      logger.error('Error in SpeechPatternAnalyzer.analyzeSpeechPatterns:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Analyze utterance lengths
   * @param {Array} messages - Array of message strings
   * @returns {Object} Utterance length analysis
   */
  analyzeUtteranceLengths(messages) {
    const utteranceLengths = [];
    let totalWords = 0;
    let totalUtterances = 0;

    messages.forEach(message => {
      const sentences = this.sentenceTokenizer.tokenize(message);
      
      sentences.forEach(sentence => {
        const words = this.tokenizer.tokenize(sentence.toLowerCase());
        const wordCount = words.length;
        
        if (wordCount >= this.config.minUtteranceLength && wordCount <= this.config.maxUtteranceLength) {
          utteranceLengths.push(wordCount);
          totalWords += wordCount;
          totalUtterances++;
        }
      });
    });

    // Calculate statistics
    const averageLength = totalUtterances > 0 ? totalWords / totalUtterances : 0;
    const medianLength = this.calculateMedian(utteranceLengths);
    const minLength = utteranceLengths.length > 0 ? Math.min(...utteranceLengths) : 0;
    const maxLength = utteranceLengths.length > 0 ? Math.max(...utteranceLengths) : 0;

    // Categorize utterances by length
    const distribution = {
      veryShort: utteranceLengths.filter(len => len <= 5).length,
      short: utteranceLengths.filter(len => len > 5 && len <= 10).length,
      medium: utteranceLengths.filter(len => len > 10 && len <= 20).length,
      long: utteranceLengths.filter(len => len > 20 && len <= 40).length,
      veryLong: utteranceLengths.filter(len => len > 40).length
    };

    // Calculate percentages
    Object.keys(distribution).forEach(category => {
      distribution[category] = totalUtterances > 0 
        ? Math.round((distribution[category] / totalUtterances) * 10000) / 100 
        : 0;
    });

    return {
      averageLength: Math.round(averageLength * 100) / 100,
      medianLength,
      minLength,
      maxLength,
      distribution,
      totalWords,
      totalUtterances,
      lengths: utteranceLengths
    };
  }

  /**
   * Analyze incomplete sentences
   * @param {Array} messages - Array of message strings
   * @returns {Object} Incomplete sentence analysis
   */
  analyzeIncompleteSentences(messages) {
    let totalSentences = 0;
    let incompleteSentences = 0;
    const incompletePatterns = [];

    // Patterns that indicate incomplete sentences
    const incompleteMarkers = [
      /\.\.\.$/,                    // Trailing ellipsis
      /but\s+$/,                   // Ending with "but"
      /and\s+$/,                   // Ending with "and"
      /so\s+$/,                    // Ending with "so"
      /then\s+$/,                  // Ending with "then"
      /because\s+$/,               // Ending with "because"
      /if\s+$/,                    // Ending with "if"
      /when\s+$/,                  // Ending with "when"
      /where\s+$/,                 // Ending with "where"
      /what\s+$/,                  // Ending with "what"
      /how\s+$/,                   // Ending with "how"
      /why\s+$/,                   // Ending with "why"
      /i\s+don't\s+know\s+how\s+to\s+$/i,  // "I don't know how to"
      /i\s+can't\s+$/i,           // "I can't"
      /it's\s+hard\s+to\s+$/i,    // "It's hard to"
      /i\s+guess\s+$/i,           // "I guess"
      /maybe\s+$/i                 // "Maybe"
    ];

    messages.forEach(message => {
      const sentences = this.sentenceTokenizer.tokenize(message);
      totalSentences += sentences.length;

      sentences.forEach(sentence => {
        const trimmedSentence = sentence.trim();
        
        // Check for incomplete sentence patterns
        incompleteMarkers.forEach(pattern => {
          if (pattern.test(trimmedSentence)) {
            incompleteSentences++;
            incompletePatterns.push({
              sentence: trimmedSentence,
              pattern: pattern.toString()
            });
            return; // Count each sentence only once
          }
        });
      });
    });

    const percentage = totalSentences > 0 ? (incompleteSentences / totalSentences) * 100 : 0;
    const severity = this.categorizeSeverity(percentage, { low: 10, medium: 20, high: 30 });

    return {
      count: incompleteSentences,
      totalSentences,
      percentage: Math.round(percentage * 100) / 100,
      severity,
      patterns: incompletePatterns.slice(0, 10) // Top 10 patterns
    };
  }

  /**
   * Analyze topic coherence across conversations
   * @param {Array} conversations - Array of conversation objects
   * @returns {Object} Topic coherence analysis
   */
  analyzeTopicCoherence(conversations) {
    let totalCoherenceScore = 0;
    let conversationCount = 0;
    const coherenceDetails = [];

    conversations.forEach(conversation => {
      if (conversation.messages && conversation.messages.length > 1) {
        const patientMessages = conversation.messages
          .filter(msg => msg.role === 'patient' && msg.content)
          .map(msg => msg.content.trim());

        if (patientMessages.length > 1) {
          const conversationCoherence = this.analyzeConversationCoherence(patientMessages);
          totalCoherenceScore += conversationCoherence.score;
          conversationCount++;
          
          if (conversationCoherence.score < this.config.topicCoherenceThreshold) {
            coherenceDetails.push({
              conversationId: conversation._id,
              score: conversationCoherence.score,
              topicShifts: conversationCoherence.topicShifts,
              issues: conversationCoherence.issues
            });
          }
        }
      }
    });

    const averageCoherence = conversationCount > 0 ? totalCoherenceScore / conversationCount : 1.0;
    const severity = this.categorizeSeverity(100 - (averageCoherence * 100), { low: 20, medium: 40, high: 60 });

    return {
      score: Math.round(averageCoherence * 10000) / 10000,
      severity,
      conversationCount,
      lowCoherenceConversations: coherenceDetails.length,
      details: coherenceDetails.slice(0, 5) // Top 5 problematic conversations
    };
  }

  /**
   * Analyze coherence within a single conversation
   * @param {Array} messages - Array of message strings
   * @returns {Object} Conversation coherence analysis
   */
  analyzeConversationCoherence(messages) {
    let coherenceScore = 1.0;
    let topicShifts = 0;
    const issues = [];

    for (let i = 1; i < messages.length; i++) {
      const prevMessage = messages[i - 1];
      const currMessage = messages[i];
      
      const coherence = this.calculateMessageCoherence(prevMessage, currMessage);
      
      if (coherence < 0.5) {
        topicShifts++;
        issues.push({
          messageIndex: i,
          coherence,
          prevMessage: prevMessage.substring(0, 50) + '...',
          currMessage: currMessage.substring(0, 50) + '...'
        });
      }
      
      coherenceScore = Math.min(coherenceScore, coherence);
    }

    return {
      score: coherenceScore,
      topicShifts,
      issues: issues.slice(0, 3) // Top 3 issues
    };
  }

  /**
   * Calculate coherence between two consecutive messages
   * @param {string} prevMessage - Previous message
   * @param {string} currMessage - Current message
   * @returns {number} Coherence score (0-1)
   */
  calculateMessageCoherence(prevMessage, currMessage) {
    const prevWords = this.tokenizer.tokenize(prevMessage.toLowerCase());
    const currWords = this.tokenizer.tokenize(currMessage.toLowerCase());
    
    // Filter meaningful words (length > 3)
    const prevMeaningful = prevWords.filter(word => word.length > 3);
    const currMeaningful = currWords.filter(word => word.length > 3);
    
    // Check for shared meaningful words
    const sharedWords = prevMeaningful.filter(word => currMeaningful.includes(word));
    const sharedRatio = prevMeaningful.length > 0 ? sharedWords.length / prevMeaningful.length : 0;
    
    // Check for topic shift indicators
    const topicShiftCount = this.coherenceMarkers.topicShiftWords.filter(word => 
      currMessage.toLowerCase().includes(word)
    ).length;
    
    // Check for continuity indicators
    const continuityCount = this.coherenceMarkers.continuityWords.filter(word => 
      currMessage.toLowerCase().includes(word)
    ).length;
    
    // Calculate final coherence score
    let score = sharedRatio;
    
    // Penalize topic shifts
    if (topicShiftCount > 0) {
      score *= Math.max(0.1, 1 - (topicShiftCount * 0.3));
    }
    
    // Reward continuity
    if (continuityCount > 0) {
      score = Math.min(1.0, score + (continuityCount * 0.1));
    }
    
    return Math.round(score * 10000) / 10000;
  }

  /**
   * Analyze word substitutions that might indicate aphasia
   * @param {Array} messages - Array of message strings
   * @returns {Object} Word substitution analysis
   */
  analyzeWordSubstitutions(messages) {
    let totalWords = 0;
    let substitutionCount = 0;
    const foundSubstitutions = [];

    messages.forEach(message => {
      const words = this.tokenizer.tokenize(message.toLowerCase());
      totalWords += words.length;

      words.forEach(word => {
        // Check if word is a common substitution
        Object.entries(this.commonSubstitutions).forEach(([correct, substitutes]) => {
          if (substitutes.includes(word)) {
            substitutionCount++;
            foundSubstitutions.push({
              original: word,
              expected: correct,
              context: this.getWordContext(message, word)
            });
          }
        });
      });
    });

    const substitutionRate = totalWords > 0 ? (substitutionCount / totalWords) * 100 : 0;
    const severity = this.categorizeSeverity(substitutionRate, { low: 1, medium: 2, high: 5 });

    return {
      count: substitutionCount,
      rate: Math.round(substitutionRate * 10000) / 10000,
      severity,
      totalWords,
      foundSubstitutions: foundSubstitutions.slice(0, 10) // Top 10 substitutions
    };
  }

  /**
   * Detect various speech abnormalities
   * @param {Array} messages - Array of message strings
   * @returns {Object} Speech abnormality analysis
   */
  detectSpeechAbnormalities(messages) {
    const abnormalities = [];
    
    // Check for monotone patterns (lack of emotional words)
    const emotionalWords = ['excited', 'happy', 'sad', 'angry', 'worried', 'surprised', 'disappointed'];
    const monotoneMessages = messages.filter(message => {
      const words = this.tokenizer.tokenize(message.toLowerCase());
      const emotionalWordCount = words.filter(word => emotionalWords.includes(word)).length;
      return emotionalWordCount === 0 && words.length > 10;
    });

    if (monotoneMessages.length > messages.length * 0.7) {
      abnormalities.push({
        type: 'monotone_speech',
        severity: 'medium',
        description: 'Lack of emotional expression in speech',
        count: monotoneMessages.length,
        percentage: Math.round((monotoneMessages.length / messages.length) * 100)
      });
    }

    // Check for excessive repetition of single words
    const repetitiveWords = {};
    messages.forEach(message => {
      const words = this.tokenizer.tokenize(message.toLowerCase());
      words.forEach(word => {
        if (word.length > 3) {
          repetitiveWords[word] = (repetitiveWords[word] || 0) + 1;
        }
      });
    });

    const excessiveRepetition = Object.entries(repetitiveWords)
      .filter(([, count]) => count > 10)
      .sort(([,a], [,b]) => b - a);

    if (excessiveRepetition.length > 0) {
      abnormalities.push({
        type: 'excessive_repetition',
        severity: 'high',
        description: 'Excessive repetition of certain words',
        words: excessiveRepetition.slice(0, 5).map(([word, count]) => ({ word, count }))
      });
    }

    // Check for grammatical errors (simplified)
    let grammaticalErrors = 0;
    messages.forEach(message => {
      const sentences = this.sentenceTokenizer.tokenize(message);
      sentences.forEach(sentence => {
        // Simple checks for common grammatical issues
        if (/i\s+is/i.test(sentence) || /he\s+are/i.test(sentence) || /she\s+are/i.test(sentence)) {
          grammaticalErrors++;
        }
      });
    });

    if (grammaticalErrors > 0) {
      abnormalities.push({
        type: 'grammatical_errors',
        severity: grammaticalErrors > 5 ? 'high' : 'medium',
        description: 'Grammatical errors detected',
        count: grammaticalErrors
      });
    }

    return {
      abnormalities,
      totalAbnormalities: abnormalities.length,
      severity: abnormalities.length > 2 ? 'high' : abnormalities.length > 0 ? 'medium' : 'low'
    };
  }

  /**
   * Analyze temporal patterns in speech
   * @param {Array} messages - Array of message objects with timestamps
   * @returns {Object} Temporal pattern analysis
   */
  analyzeTemporalPatterns(messages) {
    if (messages.length < 2) {
      return { patterns: [], trends: [] };
    }

    const patterns = [];
    const trends = [];

    // Analyze utterance length trends
    const lengthTrend = this.analyzeLengthTrend(messages);
    if (lengthTrend.direction !== 'stable') {
      trends.push(lengthTrend);
    }

    // Analyze response time patterns (if available)
    const responsePatterns = this.analyzeResponsePatterns(messages);
    if (responsePatterns.length > 0) {
      patterns.push(...responsePatterns);
    }

    return {
      patterns,
      trends,
      overallTrend: trends.length > 0 ? trends[0].direction : 'stable'
    };
  }

  /**
   * Analyze trend in utterance lengths over time
   * @param {Array} messages - Array of message objects
   * @returns {Object} Length trend analysis
   */
  analyzeLengthTrend(messages) {
    const lengths = messages.map(msg => {
      const words = this.tokenizer.tokenize(msg.content.toLowerCase());
      return words.length;
    });

    // Simple trend analysis
    const firstHalf = lengths.slice(0, Math.floor(lengths.length / 2));
    const secondHalf = lengths.slice(Math.floor(lengths.length / 2));

    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;

    const change = secondHalfAvg - firstHalfAvg;
    const changePercent = firstHalfAvg > 0 ? (change / firstHalfAvg) * 100 : 0;

    let direction = 'stable';
    if (changePercent > 20) direction = 'increasing';
    else if (changePercent < -20) direction = 'decreasing';

    return {
      type: 'utterance_length',
      direction,
      changePercent: Math.round(changePercent * 100) / 100,
      firstHalfAvg: Math.round(firstHalfAvg * 100) / 100,
      secondHalfAvg: Math.round(secondHalfAvg * 100) / 100
    };
  }

  /**
   * Analyze response patterns (placeholder for future implementation)
   * @param {Array} messages - Array of message objects
   * @returns {Array} Response pattern analysis
   */
  analyzeResponsePatterns(messages) {
    // This would analyze response times, pauses, etc.
    // For now, return empty array
    return [];
  }

  /**
   * Get context around a word in a message
   * @param {string} message - Full message
   * @param {string} word - Word to find context for
   * @returns {string} Context string
   */
  getWordContext(message, word) {
    const words = this.tokenizer.tokenize(message);
    const wordIndex = words.findIndex(w => w.toLowerCase() === word.toLowerCase());
    
    if (wordIndex === -1) return '';
    
    const start = Math.max(0, wordIndex - 3);
    const end = Math.min(words.length, wordIndex + 4);
    
    return words.slice(start, end).join(' ');
  }

  /**
   * Calculate overall speech health score
   * @param {Object} analyses - All analysis results
   * @returns {number} Speech health score (0-100)
   */
  calculateSpeechHealthScore(utteranceAnalysis, incompleteAnalysis, coherenceAnalysis, substitutionAnalysis, abnormalityAnalysis) {
    let score = 100;

    // Penalize very short utterances (potential Parkinson's)
    if (utteranceAnalysis.averageLength < 8) {
      score -= 20;
    }

    // Penalize incomplete sentences
    if (incompleteAnalysis.percentage > 20) {
      score -= 25;
    }

    // Penalize low topic coherence
    if (coherenceAnalysis.score < 0.5) {
      score -= 30;
    }

    // Penalize word substitutions
    if (substitutionAnalysis.rate > 2) {
      score -= 20;
    }

    // Penalize speech abnormalities
    if (abnormalityAnalysis.severity === 'high') {
      score -= 25;
    } else if (abnormalityAnalysis.severity === 'medium') {
      score -= 15;
    }

    return Math.max(0, score);
  }

  /**
   * Generate neurological indicators based on analysis
   * @param {Object} analyses - All analysis results
   * @returns {Array} Array of neurological indicator objects
   */
  generateNeurologicalIndicators(analyses) {
    const indicators = [];

    // Parkinson's indicators
    if (analyses.utteranceAnalysis.averageLength < 8) {
      indicators.push({
        condition: 'parkinsons',
        severity: 'medium',
        indicator: 'Short utterances detected',
        details: `Average utterance length: ${analyses.utteranceAnalysis.averageLength} words`
      });
    }

    // Aphasia indicators
    if (analyses.substitutionAnalysis.count > 0) {
      indicators.push({
        condition: 'aphasia',
        severity: analyses.substitutionAnalysis.severity,
        indicator: 'Word substitutions detected',
        details: `${analyses.substitutionAnalysis.count} substitutions found`
      });
    }

    if (analyses.incompleteAnalysis.percentage > 15) {
      indicators.push({
        condition: 'aphasia',
        severity: 'medium',
        indicator: 'High incomplete sentence rate',
        details: `${analyses.incompleteAnalysis.percentage}% of sentences incomplete`
      });
    }

    // Dementia indicators
    if (analyses.coherenceAnalysis.score < 0.4) {
      indicators.push({
        condition: 'dementia',
        severity: 'medium',
        indicator: 'Low topic coherence',
        details: `Coherence score: ${analyses.coherenceAnalysis.score}`
      });
    }

    // General speech abnormalities
    analyses.abnormalityAnalysis.abnormalities.forEach(abnormality => {
      indicators.push({
        condition: 'general',
        severity: abnormality.severity,
        indicator: abnormality.description,
        details: abnormality.count ? `Count: ${abnormality.count}` : ''
      });
    });

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
   * Calculate median of an array
   * @param {Array} arr - Array of numbers
   * @returns {number} Median value
   */
  calculateMedian(arr) {
    if (arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
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
   * @param {number} messageCount - Number of messages
   * @param {number} conversationCount - Number of conversations
   * @returns {string} Confidence level
   */
  calculateConfidence(messageCount, conversationCount) {
    if (messageCount < 10 || conversationCount < 2) return 'low';
    if (messageCount < 50 || conversationCount < 5) return 'medium';
    return 'high';
  }

  /**
   * Get default metrics structure
   * @returns {Object} Default metrics
   */
  getDefaultMetrics() {
    return {
      avgUtteranceLength: 0,
      utteranceDistribution: {
        veryShort: 0,
        short: 0,
        medium: 0,
        long: 0,
        veryLong: 0
      },
      incompleteSentences: {
        count: 0,
        totalSentences: 0,
        percentage: 0,
        severity: 'low',
        patterns: []
      },
      topicCoherence: {
        score: 0,
        severity: 'low',
        conversationCount: 0,
        lowCoherenceConversations: 0,
        details: []
      },
      wordSubstitutions: {
        count: 0,
        rate: 0,
        severity: 'low',
        totalWords: 0,
        foundSubstitutions: []
      },
      speechAbnormalities: {
        abnormalities: [],
        totalAbnormalities: 0,
        severity: 'low'
      },
      speechHealthScore: 100,
      neurologicalIndicators: [],
      temporalPatterns: {
        patterns: [],
        trends: [],
        overallTrend: 'stable'
      },
      confidence: 'none',
      analysisDate: new Date(),
      conversationCount: 0,
      messageCount: 0,
      totalWords: 0
    };
  }
}

// Create singleton instance
const speechPatternAnalyzer = new SpeechPatternAnalyzer();

// Export both the class and the singleton function
module.exports = {
  SpeechPatternAnalyzer,
  analyzeSpeechPatterns: (conversations) => speechPatternAnalyzer.analyzeSpeechPatterns(conversations)
};
