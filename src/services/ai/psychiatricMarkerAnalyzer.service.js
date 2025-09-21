// src/services/ai/psychiatricMarkerAnalyzer.service.js

const natural = require('natural');
const logger = require('../../config/logger');

/**
 * Psychiatric Marker Analyzer Service
 * Detects depression, anxiety, and other psychiatric indicators in patient conversations
 */
class PsychiatricMarkerAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    this.stemmer = natural.PorterStemmer;
    
    // Depression markers
    this.depressionMarkers = {
      negativeEmotions: [
        'sad', 'depressed', 'down', 'blue', 'hopeless', 'helpless', 'worthless',
        'empty', 'numb', 'miserable', 'gloomy', 'melancholy', 'despair',
        'desperate', 'devastated', 'crushed', 'broken', 'defeated'
      ],
      negativeThoughts: [
        'can\'t do anything', 'nothing matters', 'no point', 'give up',
        'what\'s the use', 'nothing will help', 'always bad', 'never good',
        'everything is wrong', 'nothing works', 'useless', 'failure'
      ],
      physicalSymptoms: [
        'tired', 'exhausted', 'no energy', 'can\'t sleep', 'sleeping too much',
        'no appetite', 'eating too much', 'weight loss', 'weight gain',
        'headaches', 'body aches', 'stomach problems'
      ],
      cognitiveSymptoms: [
        'can\'t concentrate', 'can\'t focus', 'mind is blank', 'memory problems',
        'can\'t think straight', 'brain fog', 'confused', 'forgetful'
      ],
      socialWithdrawal: [
        'don\'t want to see anyone', 'isolated', 'lonely', 'no friends',
        'avoiding people', 'staying home', 'not going out', 'withdrawn'
      ],
      anhedonia: [
        'don\'t enjoy', 'no pleasure', 'lost interest', 'nothing brings pleasure',
        'can\'t feel pleasure', 'no joy', 'feel nothing', 'emotionally numb',
        'anhedonia', 'don\'t care about', 'used to love', 'feel empty',
        'nothing fun', 'no satisfaction', 'lost enjoyment', 'no happiness',
        'don\'t like', 'no interest in', 'stopped enjoying', 'not interested',
        'don\'t get any pleasure', 'don\'t want to see', 'feel like a burden',
        'prefer to be alone', 'no pleasure from', 'used to be fun'
      ]
    };

    // Anxiety markers
    this.anxietyMarkers = {
      worry: [
        'worried', 'anxious', 'nervous', 'concerned', 'fearful', 'afraid',
        'scared', 'panicked', 'terrified', 'freaking out', 'stressed'
      ],
      physicalAnxiety: [
        'heart racing', 'sweating', 'shaking', 'trembling', 'short of breath',
        'can\'t breathe', 'chest tight', 'stomach knots', 'nauseous',
        'dizzy', 'lightheaded', 'hot flashes', 'cold sweats'
      ],
      catastrophicThinking: [
        'what if', 'worst case', 'something terrible', 'going to die',
        'can\'t handle it', 'falling apart', 'losing control', 'going crazy',
        'never going to get better', 'always going to be like this'
      ],
      avoidance: [
        'can\'t go', 'too scared', 'avoiding', 'staying away', 'not doing',
        'putting off', 'procrastinating', 'too anxious', 'too nervous'
      ],
      hypervigilance: [
        'always on edge', 'jumpy', 'startled', 'on guard', 'watching for',
        'expecting trouble', 'something bad will happen', 'waiting for disaster'
      ]
    };

    // General psychiatric markers
    this.generalPsychiatricMarkers = {
      moodInstability: [
        'mood swings', 'up and down', 'emotional roller coaster', 'unpredictable',
        'can\'t control emotions', 'feelings all over', 'one minute happy',
        'next minute sad', 'emotional chaos'
      ],
      selfHarm: [
        'hurt myself', 'cut myself', 'harm myself', 'end it all', 'not worth living',
        'better off dead', 'kill myself', 'suicide', 'want to die', 'life not worth it'
      ],
      paranoia: [
        'people are watching', 'following me', 'talking about me', 'against me',
        'out to get me', 'plotting', 'conspiracy', 'everyone knows', 'judging me'
      ],
      dissociation: [
        'not myself', 'out of body', 'unreal', 'like a dream', 'disconnected',
        'floating', 'watching myself', 'numb', 'empty', 'gone'
      ],
      psychosis: [
        'hear voices', 'see things', 'not real', 'hallucinations', 'delusions',
        'messages', 'signs', 'special meaning', 'chosen', 'mission'
      ]
    };

    // Positive indicators (protective factors)
    this.positiveMarkers = {
      coping: [
        'coping', 'managing', 'getting through', 'handling', 'dealing with',
        'working on', 'improving', 'getting better', 'feeling stronger'
      ],
      support: [
        'support', 'help', 'therapy', 'counseling', 'medication', 'doctor',
        'family', 'friends', 'loved ones', 'care team'
      ],
      hope: [
        'hope', 'optimistic', 'positive', 'looking forward', 'future',
        'plans', 'goals', 'dreams', 'excited', 'motivated'
      ],
      selfCare: [
        'exercise', 'walking', 'healthy eating', 'sleep', 'relaxation',
        'meditation', 'hobbies', 'activities', 'self care'
      ]
    };

    // Weights for different marker categories
    this.weights = {
      depression: {
        negativeEmotions: 0.25,
        negativeThoughts: 0.30,
        physicalSymptoms: 0.20,
        cognitiveSymptoms: 0.15,
        socialWithdrawal: 0.10,
        anhedonia: 0.20
      },
      anxiety: {
        worry: 0.25,
        physicalAnxiety: 0.25,
        catastrophicThinking: 0.25,
        avoidance: 0.15,
        hypervigilance: 0.10
      },
      general: {
        moodInstability: 0.20,
        selfHarm: 0.35,
        paranoia: 0.15,
        dissociation: 0.15,
        psychosis: 0.15
      }
    };
  }

  /**
   * Analyze psychiatric markers in patient text
   * @param {string} combinedText - Combined text from all messages
   * @param {Array} patientMessages - Array of patient message strings
   * @returns {Object} Psychiatric analysis results
   */
  analyzePsychiatricMarkers(combinedText, patientMessages) {
    try {
      if (!combinedText || combinedText.trim().length === 0) {
        return this.getDefaultMetrics();
      }

      const lowerText = combinedText.toLowerCase();
      
      // Analyze depression markers
      const depressionAnalysis = this.analyzeDepressionMarkers(lowerText);
      
      // Analyze anxiety markers
      const anxietyAnalysis = this.analyzeAnxietyMarkers(lowerText);
      
      // Analyze general psychiatric markers
      const generalAnalysis = this.analyzeGeneralPsychiatricMarkers(lowerText);
      
      // Analyze positive markers (protective factors)
      const positiveAnalysis = this.analyzePositiveMarkers(lowerText);
      
      // Calculate overall risk scores
      const depressionScore = this.calculateDepressionScore(depressionAnalysis);
      const anxietyScore = this.calculateAnxietyScore(anxietyAnalysis);
      const generalRiskScore = this.calculateGeneralRiskScore(generalAnalysis);
      
      // Calculate overall psychiatric risk
      const overallRiskScore = this.calculateOverallRiskScore(
        depressionScore,
        anxietyScore,
        generalRiskScore
      );

      // Analyze emotional tone and intensity
      const emotionalTone = this.analyzeEmotionalTone(patientMessages);
      
      // Detect crisis indicators
      const crisisIndicators = this.detectCrisisIndicators(lowerText);

      // Generate psychiatric indicators
      const indicators = this.generatePsychiatricIndicators({
        depression: depressionAnalysis,
        anxiety: anxietyAnalysis,
        general: generalAnalysis,
        positive: positiveAnalysis,
        emotionalTone,
        crisisIndicators
      });

      return {
        depressionScore: Math.round(depressionScore * 100) / 100,
        anxietyScore: Math.round(anxietyScore * 100) / 100,
        generalRiskScore: Math.round(generalRiskScore * 100) / 100,
        overallRiskScore: Math.round(overallRiskScore * 100) / 100,
        confidence: this.calculateConfidence(combinedText.length, patientMessages.length),
        indicators,
        emotionalTone,
        crisisIndicators,
        detailedAnalysis: {
          depression: depressionAnalysis,
          anxiety: anxietyAnalysis,
          general: generalAnalysis,
          positive: positiveAnalysis
        },
        protectiveFactors: positiveAnalysis.score,
        timestamp: new Date(),
        messageCount: patientMessages.length,
        totalWords: this.tokenizer.tokenize(combinedText.toLowerCase()).length
      };

    } catch (error) {
      logger.error('Error in PsychiatricMarkerAnalyzer.analyzePsychiatricMarkers:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Analyze depression markers in text
   * @param {string} lowerText - Lowercase text to analyze
   * @returns {Object} Depression analysis results
   */
  analyzeDepressionMarkers(lowerText) {
    const analysis = {
      negativeEmotions: this.countMarkers(lowerText, this.depressionMarkers.negativeEmotions),
      negativeThoughts: this.countMarkers(lowerText, this.depressionMarkers.negativeThoughts),
      physicalSymptoms: this.countMarkers(lowerText, this.depressionMarkers.physicalSymptoms),
      cognitiveSymptoms: this.countMarkers(lowerText, this.depressionMarkers.cognitiveSymptoms),
      socialWithdrawal: this.countMarkers(lowerText, this.depressionMarkers.socialWithdrawal),
      anhedonia: this.countMarkers(lowerText, this.depressionMarkers.anhedonia)
    };

    // Calculate weighted score
    let weightedScore = 0;
    let totalWeight = 0;

    Object.keys(analysis).forEach(category => {
      const weight = this.weights.depression[category];
      weightedScore += analysis[category].count * weight;
      totalWeight += weight;
    });

    analysis.weightedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    analysis.severity = this.categorizeSeverity(analysis.weightedScore, { low: 2, medium: 5, high: 8 });

    return analysis;
  }

  /**
   * Analyze anxiety markers in text
   * @param {string} lowerText - Lowercase text to analyze
   * @returns {Object} Anxiety analysis results
   */
  analyzeAnxietyMarkers(lowerText) {
    const analysis = {
      worry: this.countMarkers(lowerText, this.anxietyMarkers.worry),
      physicalAnxiety: this.countMarkers(lowerText, this.anxietyMarkers.physicalAnxiety),
      catastrophicThinking: this.countMarkers(lowerText, this.anxietyMarkers.catastrophicThinking),
      avoidance: this.countMarkers(lowerText, this.anxietyMarkers.avoidance),
      hypervigilance: this.countMarkers(lowerText, this.anxietyMarkers.hypervigilance)
    };

    // Calculate weighted score
    let weightedScore = 0;
    let totalWeight = 0;

    Object.keys(analysis).forEach(category => {
      const weight = this.weights.anxiety[category];
      weightedScore += analysis[category].count * weight;
      totalWeight += weight;
    });

    analysis.weightedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    analysis.severity = this.categorizeSeverity(analysis.weightedScore, { low: 2, medium: 5, high: 8 });

    return analysis;
  }

  /**
   * Analyze general psychiatric markers in text
   * @param {string} lowerText - Lowercase text to analyze
   * @returns {Object} General psychiatric analysis results
   */
  analyzeGeneralPsychiatricMarkers(lowerText) {
    const analysis = {
      moodInstability: this.countMarkers(lowerText, this.generalPsychiatricMarkers.moodInstability),
      selfHarm: this.countMarkers(lowerText, this.generalPsychiatricMarkers.selfHarm),
      paranoia: this.countMarkers(lowerText, this.generalPsychiatricMarkers.paranoia),
      dissociation: this.countMarkers(lowerText, this.generalPsychiatricMarkers.dissociation),
      psychosis: this.countMarkers(lowerText, this.generalPsychiatricMarkers.psychosis)
    };

    // Calculate weighted score (higher weight for self-harm)
    let weightedScore = 0;
    let totalWeight = 0;

    Object.keys(analysis).forEach(category => {
      const weight = this.weights.general[category];
      weightedScore += analysis[category].count * weight;
      totalWeight += weight;
    });

    analysis.weightedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    analysis.severity = this.categorizeSeverity(analysis.weightedScore, { low: 1, medium: 3, high: 5 });

    return analysis;
  }

  /**
   * Analyze positive markers (protective factors) in text
   * @param {string} lowerText - Lowercase text to analyze
   * @returns {Object} Positive markers analysis results
   */
  analyzePositiveMarkers(lowerText) {
    const analysis = {
      coping: this.countMarkers(lowerText, this.positiveMarkers.coping),
      support: this.countMarkers(lowerText, this.positiveMarkers.support),
      hope: this.countMarkers(lowerText, this.positiveMarkers.hope),
      selfCare: this.countMarkers(lowerText, this.positiveMarkers.selfCare)
    };

    // Calculate total positive score
    const totalPositive = Object.values(analysis).reduce((sum, category) => sum + category.count, 0);
    analysis.score = totalPositive;
    analysis.severity = this.categorizeSeverity(totalPositive, { low: 0, medium: 3, high: 6 }, true); // Reverse scale

    return analysis;
  }

  /**
   * Count markers in text using regex matching
   * @param {string} text - Text to search
   * @param {Array} markers - Array of marker patterns
   * @returns {Object} Count and found markers
   */
  countMarkers(text, markers) {
    let totalCount = 0;
    const foundMarkers = {};

    markers.forEach(marker => {
      // Create regex that matches whole words or phrases
      const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedMarker}\\b`, 'gi');
      const matches = text.match(regex);
      
      if (matches) {
        const count = matches.length;
        totalCount += count;
        foundMarkers[marker] = count;
      }
    });

    return {
      count: totalCount,
      foundMarkers,
      mostCommon: this.getMostCommonMarker(foundMarkers)
    };
  }

  /**
   * Calculate depression risk score
   * @param {Object} depressionAnalysis - Depression analysis results
   * @returns {number} Depression score (0-100)
   */
  calculateDepressionScore(depressionAnalysis) {
    const baseScore = depressionAnalysis.weightedScore * 10; // Scale to 0-100
    return Math.min(Math.max(baseScore, 0), 100);
  }

  /**
   * Calculate anxiety risk score
   * @param {Object} anxietyAnalysis - Anxiety analysis results
   * @returns {number} Anxiety score (0-100)
   */
  calculateAnxietyScore(anxietyAnalysis) {
    const baseScore = anxietyAnalysis.weightedScore * 10; // Scale to 0-100
    return Math.min(Math.max(baseScore, 0), 100);
  }

  /**
   * Calculate general psychiatric risk score
   * @param {Object} generalAnalysis - General psychiatric analysis results
   * @returns {number} General risk score (0-100)
   */
  calculateGeneralRiskScore(generalAnalysis) {
    const baseScore = generalAnalysis.weightedScore * 15; // Scale to 0-100
    return Math.min(Math.max(baseScore, 0), 100);
  }

  /**
   * Calculate overall psychiatric risk score
   * @param {number} depressionScore - Depression score
   * @param {number} anxietyScore - Anxiety score
   * @param {number} generalRiskScore - General risk score
   * @returns {number} Overall risk score (0-100)
   */
  calculateOverallRiskScore(depressionScore, anxietyScore, generalRiskScore) {
    // Weight general risk higher due to potential severity
    const weightedAverage = (depressionScore * 0.3) + (anxietyScore * 0.3) + (generalRiskScore * 0.4);
    return Math.min(Math.max(weightedAverage, 0), 100);
  }

  /**
   * Analyze emotional tone across messages
   * @param {Array} messages - Array of message strings
   * @returns {Object} Emotional tone analysis
   */
  analyzeEmotionalTone(messages) {
    let totalWords = 0;
    let emotionalWords = 0;
    let negativeWords = 0;
    let positiveWords = 0;

    const negativeWordsSet = new Set([
      ...this.depressionMarkers.negativeEmotions,
      ...this.anxietyMarkers.worry,
      'angry', 'frustrated', 'annoyed', 'upset', 'mad', 'irritated'
    ]);

    const positiveWordsSet = new Set([
      ...this.positiveMarkers.hope,
      'happy', 'good', 'great', 'wonderful', 'excellent', 'amazing', 'fantastic'
    ]);

    messages.forEach(message => {
      const words = this.tokenizer.tokenize(message.toLowerCase());
      totalWords += words.length;

      words.forEach(word => {
        if (negativeWordsSet.has(word)) {
          negativeWords++;
          emotionalWords++;
        } else if (positiveWordsSet.has(word)) {
          positiveWords++;
          emotionalWords++;
        }
      });
    });

    const emotionalIntensity = totalWords > 0 ? emotionalWords / totalWords : 0;
    const negativeRatio = emotionalWords > 0 ? negativeWords / emotionalWords : 0;
    const positiveRatio = emotionalWords > 0 ? positiveWords / emotionalWords : 0;

    return {
      emotionalIntensity: Math.round(emotionalIntensity * 10000) / 10000,
      negativeRatio: Math.round(negativeRatio * 10000) / 10000,
      positiveRatio: Math.round(positiveRatio * 10000) / 10000,
      dominantTone: negativeRatio > positiveRatio ? 'negative' : positiveRatio > negativeRatio ? 'positive' : 'neutral',
      totalWords,
      emotionalWords,
      negativeWords,
      positiveWords
    };
  }

  /**
   * Detect crisis indicators that require immediate attention
   * @param {string} lowerText - Lowercase text to analyze
   * @returns {Object} Crisis indicators analysis
   */
  detectCrisisIndicators(lowerText) {
    const crisisPatterns = [
      'kill myself', 'end my life', 'suicide', 'not worth living', 'better off dead',
      'want to die', 'harm myself', 'hurt myself', 'cut myself', 'overdose',
      'no reason to live', 'nothing to live for', 'give up on life'
    ];

    const foundCrisis = [];
    let crisisCount = 0;

    crisisPatterns.forEach(pattern => {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        crisisCount += matches.length;
        foundCrisis.push({ pattern, count: matches.length });
      }
    });

    return {
      hasCrisisIndicators: crisisCount > 0,
      crisisCount,
      foundCrisis,
      severity: this.categorizeSeverity(crisisCount, { low: 0, medium: 1, high: 2 })
    };
  }

  /**
   * Generate psychiatric indicators based on analysis
   * @param {Object} analyses - All analysis results
   * @returns {Array} Array of indicator objects
   */
  generatePsychiatricIndicators(analyses) {
    const indicators = [];

    // Depression indicators
    if (analyses.depression.weightedScore > 0.5) {
      indicators.push({
        type: 'depression',
        severity: analyses.depression.severity,
        message: `Depression markers detected (score: ${analyses.depression.weightedScore.toFixed(1)})`,
        details: this.getTopMarkers(analyses.depression)
      });
    }

    // Anxiety indicators
    if (analyses.anxiety.weightedScore > 0.5) {
      indicators.push({
        type: 'anxiety',
        severity: analyses.anxiety.severity,
        message: `Anxiety markers detected (score: ${analyses.anxiety.weightedScore.toFixed(1)})`,
        details: this.getTopMarkers(analyses.anxiety)
      });
    }

    // General psychiatric indicators
    if (analyses.general.weightedScore > 0.5) {
      indicators.push({
        type: 'general_psychiatric',
        severity: analyses.general.severity,
        message: `General psychiatric markers detected (score: ${analyses.general.weightedScore.toFixed(1)})`,
        details: this.getTopMarkers(analyses.general)
      });
    }

    // Crisis indicators
    if (analyses.crisisIndicators.hasCrisisIndicators) {
      indicators.push({
        type: 'crisis',
        severity: 'critical',
        message: `Crisis indicators detected (${analyses.crisisIndicators.crisisCount} instances)`,
        details: analyses.crisisIndicators.foundCrisis.map(c => c.pattern)
      });
    }

    // Emotional tone indicators
    if (analyses.emotionalTone.dominantTone === 'negative' && analyses.emotionalTone.negativeRatio > 0.6) {
      indicators.push({
        type: 'negative_tone',
        severity: 'medium',
        message: `Strongly negative emotional tone detected (${(analyses.emotionalTone.negativeRatio * 100).toFixed(1)}% negative)`,
        details: `Emotional intensity: ${(analyses.emotionalTone.emotionalIntensity * 100).toFixed(1)}%`
      });
    }

    return indicators;
  }

  /**
   * Get top markers from analysis
   * @param {Object} analysis - Analysis results
   * @returns {Array} Top markers
   */
  getTopMarkers(analysis) {
    const markers = [];
    Object.keys(analysis).forEach(category => {
      if (category !== 'weightedScore' && category !== 'severity' && analysis[category].count > 0) {
        markers.push({
          category,
          count: analysis[category].count,
          mostCommon: analysis[category].mostCommon
        });
      }
    });
    return markers.sort((a, b) => b.count - a.count).slice(0, 3);
  }

  /**
   * Get most common marker from found markers
   * @param {Object} foundMarkers - Map of found markers
   * @returns {string|null} Most common marker
   */
  getMostCommonMarker(foundMarkers) {
    const entries = Object.entries(foundMarkers);
    if (entries.length === 0) return null;
    
    return entries.reduce((max, [marker, count]) => 
      count > (foundMarkers[max] || 0) ? marker : max
    );
  }

  /**
   * Categorize severity based on thresholds
   * @param {number} value - Value to categorize
   * @param {Object} thresholds - Severity thresholds
   * @param {boolean} reverse - Whether to reverse the scale (for positive indicators)
   * @returns {string} Severity level
   */
  categorizeSeverity(value, thresholds, reverse = false) {
    if (reverse) {
      if (value >= thresholds.high) return 'high';
      if (value >= thresholds.medium) return 'medium';
      return 'low';
    } else {
      if (value >= thresholds.high) return 'high';
      if (value >= thresholds.medium) return 'medium';
      return 'low';
    }
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
      depressionScore: 0,
      anxietyScore: 0,
      generalRiskScore: 0,
      overallRiskScore: 0,
      confidence: 'none',
      indicators: [],
      emotionalTone: {
        emotionalIntensity: 0,
        negativeRatio: 0,
        positiveRatio: 0,
        dominantTone: 'neutral',
        totalWords: 0,
        emotionalWords: 0,
        negativeWords: 0,
        positiveWords: 0
      },
      crisisIndicators: {
        hasCrisisIndicators: false,
        crisisCount: 0,
        foundCrisis: [],
        severity: 'low'
      },
      detailedAnalysis: {},
      protectiveFactors: 0,
      timestamp: new Date(),
      messageCount: 0,
      totalWords: 0
    };
  }
}

// Create singleton instance
const psychiatricMarkerAnalyzer = new PsychiatricMarkerAnalyzer();

// Export both the class and the singleton function
module.exports = {
  PsychiatricMarkerAnalyzer,
  analyzePsychiatricMarkers: (text, messages) => psychiatricMarkerAnalyzer.analyzePsychiatricMarkers(text, messages)
};
