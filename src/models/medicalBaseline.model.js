// src/models/medicalBaseline.model.js

const mongoose = require('mongoose');

/**
 * Medical Baseline Schema
 * Stores patient baseline metrics for comparison with current analysis
 */
const medicalBaselineSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  
  // Baseline type and metadata
  type: {
    type: String,
    enum: ['initial', 'rolling'],
    required: true,
    default: 'initial'
  },
  
  establishedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  lastUpdated: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  version: {
    type: Number,
    required: true,
    default: 1
  },
  
  // Data points used to calculate baseline
  dataPoints: [{
    analysisDate: {
      type: Date,
      required: true
    },
    vocabularyScore: Number,
    depressionScore: Number,
    anxietyScore: Number,
    cognitiveScore: Number,
    sourceAnalysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalAnalysis'
    }
  }],
  
  // Calculated baseline metrics
  metrics: {
    vocabularyScore: {
      mean: Number,
      std: Number,
      min: Number,
      max: Number,
      count: Number
    },
    depressionScore: {
      mean: Number,
      std: Number,
      min: Number,
      max: Number,
      count: Number
    },
    anxietyScore: {
      mean: Number,
      std: Number,
      min: Number,
      max: Number,
      count: Number
    },
    cognitiveScore: {
      mean: Number,
      std: Number,
      min: Number,
      max: Number,
      count: Number
    }
  },
  
  // Seasonal adjustment factors
  seasonalAdjustments: {
    vocabulary: {
      type: Number,
      default: 1.0
    },
    mood: {
      type: Number,
      default: 1.0
    },
    cognitive: {
      type: Number,
      default: 1.0
    },
    month: {
      type: Number,
      min: 0,
      max: 11
    },
    monthName: String
  },
  
  // Configuration used for this baseline
  config: {
    initialBaselineMonths: Number,
    rollingBaselineMonths: Number,
    seasonalAdjustment: Boolean,
    significantChangeThreshold: Number,
    minDataPoints: Number
  },
  
  // Quality metrics
  quality: {
    dataPointCount: Number,
    timeSpanDays: Number,
    reliability: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  
  // Significant changes detected
  significantChanges: [{
    metric: String,
    currentValue: Number,
    baselineValue: Number,
    deviation: Number,
    zScore: Number,
    direction: {
      type: String,
      enum: ['increased', 'decreased', 'stable']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    detectedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'deprecated', 'superseded'],
    default: 'active'
  },
  
  // Notes
  notes: String
}, {
  timestamps: true
});

// Indexes
medicalBaselineSchema.index({ patientId: 1, status: 1 });
medicalBaselineSchema.index({ patientId: 1, type: 1, lastUpdated: -1 });
medicalBaselineSchema.index({ establishedDate: -1 });

// Virtual for data point count
medicalBaselineSchema.virtual('dataPointCount').get(function() {
  return this.dataPoints ? this.dataPoints.length : 0;
});

// Virtual for time span
medicalBaselineSchema.virtual('timeSpanDays').get(function() {
  if (!this.dataPoints || this.dataPoints.length < 2) return 0;
  
  const dates = this.dataPoints.map(dp => new Date(dp.analysisDate));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  
  return Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
});

// Method to calculate reliability
medicalBaselineSchema.methods.calculateReliability = function() {
  const dataCount = this.dataPointCount;
  const timeSpan = this.timeSpanDays;
  
  if (dataCount < 3 || timeSpan < 7) return 'low';
  if (dataCount < 10 || timeSpan < 30) return 'medium';
  return 'high';
};

// Method to calculate confidence score
medicalBaselineSchema.methods.calculateConfidence = function() {
  const reliability = this.calculateReliability();
  const dataCount = this.dataPointCount;
  const timeSpan = this.timeSpanDays;
  
  let confidence = 0;
  
  // Base confidence from data count
  confidence += Math.min(dataCount * 5, 50);
  
  // Time span bonus
  if (timeSpan >= 90) confidence += 30;
  else if (timeSpan >= 30) confidence += 20;
  else if (timeSpan >= 7) confidence += 10;
  
  // Reliability bonus
  switch (reliability) {
    case 'high': confidence += 20; break;
    case 'medium': confidence += 10; break;
    default: confidence += 0;
  }
  
  return Math.min(Math.round(confidence), 100);
};

// Method to get baseline summary
medicalBaselineSchema.methods.getSummary = function() {
  return {
    patientId: this.patientId,
    type: this.type,
    establishedDate: this.establishedDate,
    lastUpdated: this.lastUpdated,
    version: this.version,
    dataPointCount: this.dataPointCount,
    timeSpanDays: this.timeSpanDays,
    reliability: this.calculateReliability(),
    confidence: this.calculateConfidence(),
    status: this.status,
    metrics: {
      vocabularyScore: this.metrics.vocabularyScore?.mean || null,
      depressionScore: this.metrics.depressionScore?.mean || null,
      anxietyScore: this.metrics.anxietyScore?.mean || null,
      cognitiveScore: this.metrics.cognitiveScore?.mean || null
    },
    significantChangesCount: this.significantChanges?.length || 0
  };
};

// Static method to get active baseline for patient
medicalBaselineSchema.statics.getActiveBaseline = function(patientId) {
  return this.findOne({ 
    patientId, 
    status: 'active' 
  }).sort({ lastUpdated: -1 });
};

// Static method to get all baselines for patient
medicalBaselineSchema.statics.getPatientBaselines = function(patientId) {
  return this.find({ patientId }).sort({ lastUpdated: -1 });
};

// Static method to get baselines by date range
medicalBaselineSchema.statics.getBaselinesByDateRange = function(patientId, startDate, endDate) {
  return this.find({
    patientId,
    establishedDate: { $gte: startDate, $lte: endDate },
    status: 'active'
  }).sort({ establishedDate: -1 });
};

// Pre-save middleware to update quality metrics
medicalBaselineSchema.pre('save', function(next) {
  this.quality.dataPointCount = this.dataPointCount;
  this.quality.timeSpanDays = this.timeSpanDays;
  this.quality.reliability = this.calculateReliability();
  this.quality.confidence = this.calculateConfidence();
  
  next();
});

module.exports = mongoose.model('MedicalBaseline', medicalBaselineSchema);
