/**
 * Consent Record Model
 * 
 * PIPEDA Requirements:
 * - Meaningful consent (Section 6.1)
 * - Consent documentation
 * - Consent withdrawal
 * 
 * Tracks user consent for collection, use, and disclosure of personal information
 */

const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const consentRecordSchema = new mongoose.Schema(
  {
    // User Information
    userType: {
      type: String,
      required: true,
      enum: ['caregiver', 'patient'],
      index: true
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userModel',
      index: true
    },
    
    userModel: {
      type: String,
      required: true,
      enum: ['Caregiver', 'Patient'],
      default: 'Caregiver'
    },
    
    // Consent Type
    consentType: {
      type: String,
      required: true,
      enum: ['collection', 'use', 'disclosure', 'recording', 'transcription', 'analysis', 'marketing'],
      index: true
    },
    
    // Purpose
    purpose: {
      type: String,
      required: true
    },
    
    // Consent Status
    granted: {
      type: Boolean,
      required: true,
      default: true,
      index: true
    },
    
    // Consent Method
    method: {
      type: String,
      required: true,
      enum: ['explicit', 'implied'],
      default: 'explicit',
      index: true
    },
    
    // Explicit consent details
    explicitConsent: {
      provided: Boolean,
      providedAt: Date,
      providedVia: String, // e.g., "checkbox", "signature", "verbal", "email"
      consentText: String, // Text of consent provided
      ipAddress: String,
      userAgent: String
    },
    
    // Implied consent details
    impliedConsent: {
      basis: String, // Reason for implied consent
      documented: Boolean
    },
    
    // Consent Details
    informationTypes: [{
      type: String // e.g., "name", "email", "phone", "health_data", "call_recordings"
    }],
    
    thirdParties: [{
      name: String,
      purpose: String,
      agreementType: String // e.g., "BAA", "DPA", "contract"
    }],
    
    // Withdrawal
    withdrawn: {
      type: Boolean,
      default: false,
      index: true
    },
    
    withdrawnAt: Date,
    
    withdrawalMethod: String, // e.g., "email", "app", "phone", "mail"
    
    withdrawalReason: String,
    
    withdrawalImpact: {
      explained: Boolean,
      impactDescription: String, // What happens when consent is withdrawn
      serviceImpact: String // e.g., "service_continues", "service_limited", "service_stops"
    },
    
    // Retention
    retentionPeriod: {
      type: Number, // Days
      default: null // null = indefinite (until withdrawal)
    },
    
    expiresAt: Date, // If consent has expiration
    
    // Legal Basis
    legalBasis: {
      type: String,
      enum: ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'],
      default: 'consent'
    },
    
    // Documentation
    documented: {
      type: Boolean,
      default: true
    },
    
    documentationLocation: String, // Where consent is documented
    
    // Collection Notice
    collectionNoticeProvided: {
      type: Boolean,
      default: false
    },
    
    collectionNoticeProvidedAt: Date,
    
    collectionNoticeVersion: String, // Version of notice provided
    
    // Audit Trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver'
    },
    
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver'
    },
    
    // Notes
    notes: String
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
consentRecordSchema.index({ userId: 1, userModel: 1, consentType: 1 });
consentRecordSchema.index({ granted: 1, withdrawn: 1 });
consentRecordSchema.index({ consentType: 1, granted: 1 });
consentRecordSchema.index({ expiresAt: 1 }); // For expired consent tracking
consentRecordSchema.index({ createdAt: -1 });

// Plugin to convert mongoose to JSON and paginate
consentRecordSchema.plugin(toJSON);
consentRecordSchema.plugin(paginate);

/**
 * Get active consent for a user
 */
consentRecordSchema.statics.getActiveConsent = async function(userId, userModel, consentType) {
  const query = {
    userId,
    userModel,
    granted: true,
    withdrawn: false
  };
  
  if (consentType) {
    query.consentType = consentType;
  }
  
  // Check expiration
  query.$or = [
    { expiresAt: null },
    { expiresAt: { $gt: new Date() } }
  ];
  
  return this.find(query).sort({ createdAt: -1 });
};

/**
 * Check if user has consent for specific purpose
 */
consentRecordSchema.statics.hasConsent = async function(userId, userModel, consentType, purpose) {
  const consent = await this.findOne({
    userId,
    userModel,
    consentType,
    purpose,
    granted: true,
    withdrawn: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  
  return !!consent;
};

/**
 * Get consent history for a user
 */
consentRecordSchema.statics.getConsentHistory = async function(userId, userModel) {
  return this.find({
    userId,
    userModel
  }).sort({ createdAt: -1 });
};

/**
 * Withdraw consent
 */
consentRecordSchema.methods.withdraw = async function(withdrawalMethod, withdrawalReason, withdrawalImpact) {
  this.withdrawn = true;
  this.withdrawnAt = new Date();
  this.withdrawalMethod = withdrawalMethod;
  this.withdrawalReason = withdrawalReason;
  
  if (withdrawalImpact) {
    this.withdrawalImpact = {
      explained: true,
      impactDescription: withdrawalImpact.impactDescription,
      serviceImpact: withdrawalImpact.serviceImpact
    };
  }
  
  this.granted = false;
  return this.save();
};

/**
 * Get expired consents
 */
consentRecordSchema.statics.getExpiredConsents = async function() {
  return this.find({
    granted: true,
    withdrawn: false,
    expiresAt: { $lte: new Date() }
  });
};

/**
 * Get statistics
 */
consentRecordSchema.statics.getStatistics = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        granted: {
          $sum: { $cond: [{ $eq: ['$granted', true] }, 1, 0] }
        },
        withdrawn: {
          $sum: { $cond: [{ $eq: ['$withdrawn', true] }, 1, 0] }
        },
        explicit: {
          $sum: { $cond: [{ $eq: ['$method', 'explicit'] }, 1, 0] }
        },
        implied: {
          $sum: { $cond: [{ $eq: ['$method', 'implied'] }, 1, 0] }
        },
        byType: {
          $push: '$consentType'
        }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    granted: 0,
    withdrawn: 0,
    explicit: 0,
    implied: 0,
    byType: []
  };
};

/**
 * @typedef ConsentRecord
 */
const ConsentRecord = mongoose.model('ConsentRecord', consentRecordSchema);

module.exports = ConsentRecord;



