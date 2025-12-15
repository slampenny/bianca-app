/**
 * Breach Log Model
 * 
 * HIPAA Requirements:
 * - §164.308(a)(6) - Security Incident Procedures
 * - §164.404 - Notification to Individuals
 * - §164.406 - Notification to the Secretary
 * 
 * PIPEDA Requirements:
 * - Notification to individuals "as soon as feasible"
 * - Notification to Privacy Commissioner of Canada for significant harm
 * 
 * Tracks potential and confirmed security breaches for HIPAA and PIPEDA compliance
 */

const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const breachLogSchema = new mongoose.Schema(
  {
    // Breach Identification
    type: {
      type: String,
      required: true,
      enum: [
        'excessive_failed_logins',
        'unusual_data_access_volume',
        'off_hours_access',
        'unauthorized_export_attempt',
        'suspicious_ip_address',
        'brute_force_attempt',
        'privilege_escalation_attempt',
        'data_exfiltration_attempt',
        'unauthorized_access',
        'other'
      ],
      index: true
    },
    
    severity: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      index: true
    },
    
    status: {
      type: String,
      required: true,
      enum: ['INVESTIGATING', 'CONFIRMED', 'FALSE_POSITIVE', 'MITIGATED', 'RESOLVED'],
      default: 'INVESTIGATING',
      index: true
    },
    
    // User/Session Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
      index: true
    },
    
    ipAddress: {
      type: String,
    },
    
    userAgent: {
      type: String,
    },
    
    // Breach Details
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    
    details: {
      type: String,
      required: true,
    },
    
    // Evidence (stored as encrypted JSON string)
    evidence: {
      type: String, // JSON stringified evidence
    },
    
    // Impact Assessment
    affectedResourceType: {
      type: String,
      enum: ['patient', 'conversation', 'medicalAnalysis', 'caregiver', 'org', 'system', 'multiple'],
    },
    
    affectedResourceIds: [{
      type: String,
    }],
    
    affectedCount: {
      type: Number,
      default: 0,
    },
    
    // Notification Requirements
    requiresHHSNotification: {
      type: Boolean,
      default: false, // True if affects 500+ individuals
    },
    
    requiresMediaNotification: {
      type: Boolean,
      default: false, // True if affects 500+ individuals
    },
    
    notificationDeadline: {
      type: Date, // 60 days from discovery
    },
    
    individualsNotified: {
      type: Boolean,
      default: false,
    },
    
    individualsNotifiedAt: {
      type: Date,
    },
    
    hhsNotified: {
      type: Boolean,
      default: false,
    },
    
    hhsNotifiedAt: {
      type: Date,
    },
    
    // PIPEDA-specific fields
    requiresPrivacyCommissionerNotification: {
      type: Boolean,
      default: false, // True if breach involves significant harm (PIPEDA)
    },
    
    privacyCommissionerNotified: {
      type: Boolean,
      default: false,
    },
    
    privacyCommissionerNotifiedAt: {
      type: Date,
    },
    
    significantHarmAssessment: {
      type: String, // Assessment of whether breach involves significant harm (PIPEDA)
      enum: ['NOT_ASSESSED', 'NO_SIGNIFICANT_HARM', 'SIGNIFICANT_HARM', 'PENDING'],
      default: 'NOT_ASSESSED'
    },
    
    // Organization country for jurisdiction determination
    organizationCountry: {
      type: String,
      trim: true,
      uppercase: true,
    },
    
    // Response Actions
    mitigationSteps: [{
      action: String,
      takenAt: Date,
      takenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Caregiver'
      },
      result: String
    }],
    
    resolvedAt: {
      type: Date,
    },
    
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver'
    },
    
    resolutionNotes: {
      type: String,
    },
    
    // Root Cause Analysis
    rootCause: {
      type: String,
    },
    
    preventiveMeasures: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
breachLogSchema.index({ detectedAt: -1 });
breachLogSchema.index({ status: 1, severity: 1 });
breachLogSchema.index({ userId: 1, detectedAt: -1 });
breachLogSchema.index({ requiresHHSNotification: 1, hhsNotified: 1 });
breachLogSchema.index({ requiresPrivacyCommissionerNotification: 1, privacyCommissionerNotified: 1 });
breachLogSchema.index({ organizationCountry: 1, detectedAt: -1 });

// Plugin to convert mongoose to JSON
breachLogSchema.plugin(toJSON);

/**
 * Get breaches requiring notification
 */
breachLogSchema.statics.getNotificationRequired = async function() {
  return this.find({
    status: 'CONFIRMED',
    $or: [
      { requiresHHSNotification: true, hhsNotified: false },
      { requiresPrivacyCommissionerNotification: true, privacyCommissionerNotified: false },
      { individualsNotified: false }
    ]
  }).sort({ detectedAt: 1 });
};

/**
 * Get recent breaches (last 30 days)
 */
breachLogSchema.statics.getRecentBreaches = async function(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  return this.find({
    detectedAt: { $gte: since }
  }).sort({ detectedAt: -1 });
};

/**
 * Get breach statistics
 */
breachLogSchema.statics.getStatistics = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.detectedAt = {};
    if (startDate) match.detectedAt.$gte = new Date(startDate);
    if (endDate) match.detectedAt.$lte = new Date(endDate);
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        critical: {
          $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] }
        },
        high: {
          $sum: { $cond: [{ $eq: ['$severity', 'HIGH'] }, 1, 0] }
        },
        medium: {
          $sum: { $cond: [{ $eq: ['$severity', 'MEDIUM'] }, 1, 0] }
        },
        low: {
          $sum: { $cond: [{ $eq: ['$severity', 'LOW'] }, 1, 0] }
        },
        investigating: {
          $sum: { $cond: [{ $eq: ['$status', 'INVESTIGATING'] }, 1, 0] }
        },
        confirmed: {
          $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] }
        },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] }
        },
        falsePositives: {
          $sum: { $cond: [{ $eq: ['$status', 'FALSE_POSITIVE'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    investigating: 0,
    confirmed: 0,
    resolved: 0,
    falsePositives: 0
  };
};

/**
 * @typedef BreachLog
 */
const BreachLog = mongoose.model('BreachLog', breachLogSchema);

module.exports = BreachLog;

