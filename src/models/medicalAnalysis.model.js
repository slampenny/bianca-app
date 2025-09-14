// src/models/medicalAnalysis.model.js

const mongoose = require('mongoose');

/**
 * Medical Analysis Schema
 * Stores comprehensive medical NLP analysis results for patients
 */
const medicalAnalysisSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  
  // Analysis metadata
  analysisDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  timeRange: {
    type: String,
    enum: ['month', 'quarter', 'year', 'custom'],
    required: true
  },
  
  startDate: {
    type: Date,
    required: true
  },
  
  endDate: {
    type: Date,
    required: true
  },
  
  // Data source information
  conversationCount: {
    type: Number,
    required: true,
    min: 0
  },
  
  messageCount: {
    type: Number,
    required: true,
    min: 0
  },
  
  totalWords: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Cognitive analysis results
  cognitiveMetrics: {
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high', 'none']
    },
    fillerWordDensity: {
      type: Number,
      min: 0
    },
    vagueReferenceDensity: {
      type: Number,
      min: 0
    },
    informationDensity: {
      type: Number,
      min: 0
    },
    temporalConfusionCount: {
      type: Number,
      min: 0
    },
    wordFindingDifficultyCount: {
      type: Number,
      min: 0
    },
    repetitionScore: {
      type: Number,
      min: 0,
      max: 100
    },
    detailedAnalysis: {
      fillerWords: {
        count: Number,
        density: Number,
        foundFillers: mongoose.Schema.Types.Mixed,
        mostCommonFiller: String,
        severity: String
      },
      vagueReferences: {
        count: Number,
        density: Number,
        foundVague: mongoose.Schema.Types.Mixed,
        mostCommonVague: [mongoose.Schema.Types.Mixed],
        severity: String
      },
      informationDensity: {
        totalWords: Number,
        totalSentences: Number,
        totalConcepts: Number,
        conceptsPerWord: Number,
        avgConceptsPerSentence: Number,
        score: Number,
        severity: String
      },
      repetition: {
        totalUniquePhrases: Number,
        totalRepeatedPhrases: Number,
        score: Number,
        patterns: [mongoose.Schema.Types.Mixed],
        severity: String
      },
      temporalConfusion: {
        count: Number,
        foundPatterns: mongoose.Schema.Types.Mixed,
        mostCommonPattern: String,
        severity: String
      },
      wordFinding: {
        count: Number,
        foundPatterns: mongoose.Schema.Types.Mixed,
        mostCommonPattern: String,
        severity: String
      },
      conversationFlow: {
        score: Number,
        flowIssues: Number,
        patterns: [{
          messageIndex: Number,
          type: String,
          coherenceRatio: Number
        }],
        severity: String
      }
    },
    indicators: [{
      type: {
        type: String,
        enum: ['filler_words', 'vague_references', 'information_density', 'repetition', 'temporal_confusion', 'word_finding', 'conversation_flow']
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      message: String,
      details: String
    }]
  },
  
  // Psychiatric analysis results
  psychiatricMetrics: {
    depressionScore: {
      type: Number,
      min: 0,
      max: 100
    },
    anxietyScore: {
      type: Number,
      min: 0,
      max: 100
    },
    overallRiskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    pronounAnalysis: {
      percentages: {
        firstPerson: Number,
        secondPerson: Number,
        thirdPerson: Number
      },
      counts: {
        firstPerson: Number,
        secondPerson: Number,
        thirdPerson: Number
      }
    },
    temporalFocus: {
      percentages: {
        past: Number,
        present: Number,
        future: Number
      },
      counts: {
        past: Number,
        present: Number,
        future: Number
      }
    },
    absolutistAnalysis: {
      count: Number,
      density: Number,
      severity: String,
      foundWords: mongoose.Schema.Types.Mixed
    },
    crisisIndicators: {
      hasCrisisIndicators: Boolean,
      crisisCount: Number,
      crisisWords: [String],
      severity: String
    },
    indicators: [{
      type: {
        type: String,
        enum: ['depression', 'anxiety', 'crisis', 'absolutist_language', 'pronoun_usage', 'temporal_focus', 'negative_tone']
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      message: String,
      details: String
    }]
  },
  
  // Vocabulary analysis results
  vocabularyMetrics: {
    uniqueWords: {
      type: Number,
      min: 0
    },
    totalWords: {
      type: Number,
      min: 0
    },
    typeTokenRatio: {
      type: Number,
      min: 0,
      max: 1
    },
    avgWordLength: {
      type: Number,
      min: 0
    },
    avgSentenceLength: {
      type: Number,
      min: 0
    },
    complexityScore: {
      type: Number,
      min: 0,
      max: 100
    },
    wordFrequency: {
      mostCommon: [{
        word: String,
        count: Number,
        frequency: Number
      }],
      rareWords: [{
        word: String,
        count: Number,
        frequency: Number
      }]
    }
  },
  
  // Speech pattern analysis
  speechPatterns: {
    avgUtteranceLength: Number,
    utteranceDistribution: {
      short: Number,    // < 10 words
      medium: Number,   // 10-20 words
      long: Number      // > 20 words
    },
    incompleteSentences: {
      count: Number,
      percentage: Number
    },
    topicCoherence: {
      score: Number,
      coherenceRatio: Number
    },
    wordSubstitutions: {
      count: Number,
      substitutions: [{
        original: String,
        substituted: String,
        context: String
      }]
    },
    speechAbnormalities: [{
      type: String,
      description: String,
      severity: String
    }],
    neurologicalIndicators: [{
      type: String,
      description: String,
      severity: String
    }],
    speechHealthScore: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  
  // Repetition analysis
  repetitionAnalysis: {
    repeatedPhrases: [{
      phrase: String,
      count: Number,
      frequency: Number,
      severity: String,
      firstOccurrence: Date,
      lastOccurrence: Date,
      daysSpan: Number,
      uniqueConversations: Number,
      wordCount: Number
    }],
    repetitionIndex: {
      type: Number,
      min: 0,
      max: 100
    },
    concerningRepetitions: {
      hasConcerningRepetitions: Boolean,
      concerningCount: Number,
      veryConcerningCount: Number,
      concerningPhrases: [mongoose.Schema.Types.Mixed],
      veryConcerningPhrases: [mongoose.Schema.Types.Mixed],
      severity: String
    },
    withinConversationRepetitions: {
      totalWithinRepetitions: Number,
      conversationStats: [{
        conversationId: mongoose.Schema.Types.ObjectId,
        messageCount: Number,
        repetitions: Number,
        repetitionRate: Number
      }],
      averageRepetitionRate: Number,
      conversationsWithRepetitions: Number
    },
    acrossConversationRepetitions: {
      sharedPhrases: [{
        phrase: String,
        conversationCount: Number,
        totalOccurrences: Number
      }],
      totalSharedPhrases: Number,
      conversationsAnalyzed: Number,
      averagePhrasesPerConversation: Number
    },
    temporalPatterns: {
      timeSpan: Number,
      repetitionFrequency: Number,
      patterns: [{
        phrase: String,
        count: Number,
        frequency: Number,
        timeSpan: Number,
        pattern: String
      }],
      trend: {
        type: String,
        enum: ['increasing', 'stable', 'decreasing']
      }
    }
  },
  
  // Analysis metadata
  confidence: {
    type: String,
    enum: ['low', 'medium', 'high', 'none'],
    required: true
  },
  
  warnings: [{
    type: String
  }],
  
  // Baseline comparison (if available)
  baselineComparison: {
    hasBaseline: Boolean,
    deviations: mongoose.Schema.Types.Mixed,
    significantChanges: [{
      metric: String,
      currentValue: Number,
      baselineValue: Number,
      deviation: Number,
      zScore: Number,
      direction: String,
      severity: String
    }]
  },
  
  // Generated recommendations
  recommendations: [{
    category: {
      type: String,
      enum: ['cognitive', 'psychiatric', 'vocabulary', 'baseline', 'general']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    title: String,
    description: String,
    priority: {
      type: Number,
      min: 0,
      max: 3
    },
    actionRequired: Boolean,
    suggestedActions: [String]
  }],
  
  // Time series data for trend visualization
  timeSeriesData: {
    cognitiveScore: {
      type: Number,
      min: 0,
      max: 100,
      description: 'Cognitive risk score for time series'
    },
    mentalHealthScore: {
      type: Number,
      min: 0,
      max: 100,
      description: 'Overall mental health risk score for time series'
    },
    languageScore: {
      type: Number,
      min: 0,
      max: 100,
      description: 'Language complexity score for time series'
    },
    overallHealthScore: {
      type: Number,
      min: 0,
      max: 100,
      description: 'Overall health score for time series'
    }
  },
  
  // Trend indicators (calculated when analysis runs)
  trends: {
    cognitive: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    },
    mentalHealth: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    },
    language: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    },
    overall: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    }
  },
  
  // Processing metadata
  processingTime: {
    type: Number,
    description: 'Analysis processing time in milliseconds'
  },
  
  version: {
    type: String,
    default: '1.0',
    description: 'Analysis algorithm version'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
medicalAnalysisSchema.index({ patientId: 1, analysisDate: -1 });
medicalAnalysisSchema.index({ patientId: 1, timeRange: 1, startDate: -1 });
medicalAnalysisSchema.index({ 'cognitiveMetrics.riskScore': 1 });
medicalAnalysisSchema.index({ 'psychiatricMetrics.overallRiskScore': 1 });
medicalAnalysisSchema.index({ 'psychiatricMetrics.crisisIndicators.hasCrisisIndicators': 1 });
medicalAnalysisSchema.index({ confidence: 1 });

// Virtual for overall health score
medicalAnalysisSchema.virtual('overallHealthScore').get(function() {
  let score = 100;
  
  // Deduct points for cognitive issues
  if (this.cognitiveMetrics?.riskScore > 0) {
    score -= Math.min(this.cognitiveMetrics.riskScore * 0.3, 30);
  }
  
  // Deduct points for psychiatric issues
  if (this.psychiatricMetrics?.depressionScore > 0) {
    score -= Math.min(this.psychiatricMetrics.depressionScore * 0.2, 25);
  }
  
  if (this.psychiatricMetrics?.anxietyScore > 0) {
    score -= Math.min(this.psychiatricMetrics.anxietyScore * 0.15, 20);
  }
  
  // Deduct points for crisis indicators
  if (this.psychiatricMetrics?.crisisIndicators?.hasCrisisIndicators) {
    score -= 25;
  }
  
  return Math.max(Math.round(score), 0);
});

// Virtual for risk level
medicalAnalysisSchema.virtual('riskLevel').get(function() {
  const healthScore = this.overallHealthScore;
  
  if (healthScore < 30) return 'critical';
  if (healthScore < 50) return 'high';
  if (healthScore < 70) return 'medium';
  return 'low';
});

// Method to get analysis summary for dashboard
medicalAnalysisSchema.methods.getSummary = function() {
  return {
    patientId: this.patientId,
    analysisDate: this.analysisDate,
    timeRange: this.timeRange,
    overallHealthScore: this.overallHealthScore,
    riskLevel: this.riskLevel,
    confidence: this.confidence,
    conversationCount: this.conversationCount,
    messageCount: this.messageCount,
    cognitiveRiskScore: this.cognitiveMetrics?.riskScore || 0,
    depressionScore: this.psychiatricMetrics?.depressionScore || 0,
    anxietyScore: this.psychiatricMetrics?.anxietyScore || 0,
    hasCrisisIndicators: this.psychiatricMetrics?.crisisIndicators?.hasCrisisIndicators || false,
    recommendationCount: this.recommendations?.length || 0,
    criticalRecommendations: this.recommendations?.filter(r => r.priority === 0).length || 0
  };
};

// Static method to get latest analysis for a patient
medicalAnalysisSchema.statics.getLatestAnalysis = function(patientId) {
  return this.findOne({ patientId }).sort({ analysisDate: -1 });
};

// Static method to get analyses for date range
medicalAnalysisSchema.statics.getAnalysesByDateRange = function(patientId, startDate, endDate) {
  return this.find({
    patientId,
    startDate: { $gte: startDate },
    endDate: { $lte: endDate }
  }).sort({ analysisDate: -1 });
};

// Static method to get high-risk analyses
medicalAnalysisSchema.statics.getHighRiskAnalyses = function(options = {}) {
  const query = {
    $or: [
      { 'cognitiveMetrics.riskScore': { $gte: 70 } },
      { 'psychiatricMetrics.depressionScore': { $gte: 70 } },
      { 'psychiatricMetrics.anxietyScore': { $gte: 70 } },
      { 'psychiatricMetrics.crisisIndicators.hasCrisisIndicators': true }
    ]
  };
  
  if (options.patientId) {
    query.patientId = options.patientId;
  }
  
  return this.find(query).sort({ analysisDate: -1 });
};

// Static method to get time series data for trend visualization
medicalAnalysisSchema.statics.getTimeSeriesData = function(patientId, timeRange = 'year') {
  let startDate;
  const endDate = new Date();
  
  switch (timeRange) {
    case 'month':
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      break;
    case 'quarter':
      const quarterStart = Math.floor(endDate.getMonth() / 3) * 3;
      startDate = new Date(endDate.getFullYear(), quarterStart, 1);
      break;
    case 'year':
      startDate = new Date(endDate.getFullYear(), 0, 1);
      break;
    default:
      throw new Error('Invalid timeRange. Must be: month, quarter, or year');
  }

  return this.find({
    patientId,
    analysisDate: { $gte: startDate, $lte: endDate }
  })
  .select('analysisDate timeSeriesData trends conversationCount messageCount')
  .sort({ analysisDate: 1 }); // Sort chronologically for trend calculation
};

module.exports = mongoose.model('MedicalAnalysis', medicalAnalysisSchema);