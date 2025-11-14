// src/models/fraudAbuseAnalysis.model.js

const mongoose = require('mongoose');

/**
 * Fraud and Abuse Analysis Schema
 * Stores analysis results for fraud, exploitation, abuse, and neglect detection
 */
const fraudAbuseAnalysisSchema = new mongoose.Schema({
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
  
  // Financial exploitation analysis results
  financialRisk: {
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high', 'none']
    },
    indicators: [{
      type: {
        type: String,
        enum: ['large_amounts', 'transfer_methods', 'scam_indicators', 'urgency_language', 'help_requests', 'relationship_money', 'escalation']
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      message: String
    }],
    largeAmountMentions: Number,
    transferMethodMentions: Number,
    scamIndicatorMentions: Number,
    urgencyMentions: Number,
    helpRequestMentions: Number,
    relationshipMoneyMentions: Number,
    temporalPatterns: {
      hasEscalation: Boolean,
      trend: {
        type: String,
        enum: ['increasing', 'decreasing', 'stable', 'insufficient_data']
      },
      recentAverage: Number,
      earlierAverage: Number
    },
    flaggedPhrases: [String]
  },
  
  // Abuse and neglect analysis results
  abuseRisk: {
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high', 'none']
    },
    indicators: [{
      type: {
        type: String,
        enum: ['physical_abuse', 'emotional_abuse', 'neglect', 'escalation']
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      message: String
    }],
    physicalAbuseScore: Number,
    emotionalAbuseScore: Number,
    neglectScore: Number,
    injuryMentions: Number,
    isolationMentions: Number,
    fearMentions: Number,
    basicNeedsMentions: Number,
    temporalPatterns: {
      hasEscalation: Boolean,
      trend: {
        type: String,
        enum: ['increasing', 'decreasing', 'stable', 'insufficient_data']
      },
      recentAverage: Number,
      earlierAverage: Number
    },
    flaggedPhrases: [String]
  },
  
  // Relationship pattern analysis results
  relationshipRisk: {
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high', 'none']
    },
    indicators: [{
      type: {
        type: String,
        enum: ['new_people', 'isolation', 'control', 'dependency', 'suspicious_behavior', 'temporal_changes']
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      message: String
    }],
    newPeopleCount: Number,
    isolationCount: Number,
    controlCount: Number,
    dependencyCount: Number,
    suspiciousBehaviorCount: Number,
    temporalChanges: {
      hasChanges: Boolean,
      hasIsolationIncrease: Boolean,
      hasNewPeopleIncrease: Boolean,
      trend: {
        type: String,
        enum: ['increasing', 'decreasing', 'stable', 'insufficient_data']
      },
      earlyPeriod: {
        count: Number,
        messages: Number
      },
      middlePeriod: {
        count: Number,
        messages: Number
      },
      latePeriod: {
        count: Number,
        messages: Number
      }
    },
    flaggedPeople: [{
      context: String,
      timestamp: Date,
      conversationId: mongoose.Schema.Types.ObjectId
    }],
    relationshipTimeline: [{
      timestamp: Date,
      type: {
        type: String,
        enum: ['new_person', 'isolation']
      },
      excerpt: String
    }]
  },
  
  // Overall risk assessment
  overallRiskScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  
  // Baseline comparison (if available)
  changeFromBaseline: {
    financial: {
      riskScore: Number,
      largeAmountMentions: Number,
      transferMethodMentions: Number
    },
    abuse: {
      riskScore: Number,
      physicalAbuseScore: Number,
      emotionalAbuseScore: Number,
      neglectScore: Number
    },
    relationship: {
      riskScore: Number,
      newPeopleCount: Number,
      isolationCount: Number
    },
    overall: {
      riskScore: Number
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
  
  // Generated recommendations
  recommendations: [{
    category: {
      type: String,
      enum: ['financial', 'abuse', 'neglect', 'relationship', 'overall', 'general']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    action: String,
    description: String
  }],
  
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
fraudAbuseAnalysisSchema.index({ patientId: 1, analysisDate: -1 });
fraudAbuseAnalysisSchema.index({ patientId: 1, timeRange: 1, startDate: -1 });
fraudAbuseAnalysisSchema.index({ overallRiskScore: 1 });
fraudAbuseAnalysisSchema.index({ 'financialRisk.riskScore': 1 });
fraudAbuseAnalysisSchema.index({ 'abuseRisk.riskScore': 1 });
fraudAbuseAnalysisSchema.index({ 'relationshipRisk.riskScore': 1 });
fraudAbuseAnalysisSchema.index({ confidence: 1 });

// Virtual for risk level
fraudAbuseAnalysisSchema.virtual('riskLevel').get(function() {
  if (this.overallRiskScore >= 70) return 'critical';
  if (this.overallRiskScore >= 50) return 'high';
  if (this.overallRiskScore >= 30) return 'medium';
  return 'low';
});

// Method to get analysis summary for dashboard
fraudAbuseAnalysisSchema.methods.getSummary = function() {
  return {
    patientId: this.patientId,
    analysisDate: this.analysisDate,
    timeRange: this.timeRange,
    overallRiskScore: this.overallRiskScore,
    riskLevel: this.riskLevel,
    confidence: this.confidence,
    conversationCount: this.conversationCount,
    messageCount: this.messageCount,
    financialRiskScore: this.financialRisk?.riskScore || 0,
    abuseRiskScore: this.abuseRisk?.riskScore || 0,
    relationshipRiskScore: this.relationshipRisk?.riskScore || 0,
    recommendationCount: this.recommendations?.length || 0,
    highPriorityRecommendations: this.recommendations?.filter(r => r.priority === 'high').length || 0
  };
};

// Static method to get latest analysis for a patient
fraudAbuseAnalysisSchema.statics.getLatestAnalysis = function(patientId) {
  return this.findOne({ patientId }).sort({ analysisDate: -1 });
};

// Static method to get analyses for date range
fraudAbuseAnalysisSchema.statics.getAnalysesByDateRange = function(patientId, startDate, endDate) {
  return this.find({
    patientId,
    startDate: { $gte: startDate },
    endDate: { $lte: endDate }
  }).sort({ analysisDate: -1 });
};

// Static method to get high-risk analyses
fraudAbuseAnalysisSchema.statics.getHighRiskAnalyses = function(options = {}) {
  const query = {
    $or: [
      { overallRiskScore: { $gte: 50 } },
      { 'financialRisk.riskScore': { $gte: 50 } },
      { 'abuseRisk.riskScore': { $gte: 50 } },
      { 'relationshipRisk.riskScore': { $gte: 50 } }
    ]
  };
  
  if (options.patientId) {
    query.patientId = options.patientId;
  }
  
  return this.find(query).sort({ analysisDate: -1 });
};

module.exports = mongoose.model('FraudAbuseAnalysis', fraudAbuseAnalysisSchema);

