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
      enum: ['caregiver', 'client'],
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
      enum: ['Caregiver', 'Client'],
      default: 'Caregiver'
    },
    
    // Consent Type
    consentType: {
      type: String,
      required: function requiredConsentType() {
        return !this.recordType;
      },
      enum: ['collection', 'use', 'disclosure', 'recording', 'transcription', 'analysis', 'marketing', 'familyReports'],
      index: true
    },
    
    // Purpose
    purpose: {
      type: String,
      required: function requiredPurpose() {
        return !this.recordType;
      }
    },

    /** GDPR client consent: grant or withdrawal event (append-only). */
    recordType: {
      type: String,
      enum: ['grant', 'withdrawal'],
      index: true,
    },

    /** Denormalized client reference for GDPR audit queries. */
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },

    /** ISO country / jurisdiction at time of consent (from org). */
    jurisdiction: {
      type: String,
      trim: true,
    },

    /** Purposes included in this grant or withdrawal event. */
    purposes: [{
      type: String,
      enum: ['recording', 'transcription', 'aiAnalysis', 'familyReports'],
    }],

    /** Consent policy version accepted at time of event. */
    consentVersion: {
      type: String,
      trim: true,
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
    
    jurisdiction: {
      type: String,
      enum: ['HIPAA', 'PIPEDA', 'GDPR', 'OTHER'],
      required: true,
      index: true,
    },

    // Legal Basis (Article 6 GDPR bases validated in pre-validate hook)
    legalBasis: {
      type: String,
      enum: ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'],
      required: true,
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

const GDPR_LEGAL_BASES = new Set(['consent', 'vital_interests', 'legitimate_interests', 'legal_obligation']);

consentRecordSchema.pre('validate', function validateLegalBasis(next) {
  if (!this.legalBasis && this.jurisdiction !== 'GDPR') {
    this.legalBasis = 'consent';
  }

  if (this.jurisdiction === 'GDPR') {
    if (!this.legalBasis) {
      return next(new Error('GDPR consent records require an explicit legal basis'));
    }
    if (!GDPR_LEGAL_BASES.has(this.legalBasis)) {
      return next(
        new Error(
          'GDPR legal basis must be one of: consent, vital_interests, legitimate_interests, legal_obligation'
        )
      );
    }
    const hasExplicitConsent =
      this.legalBasis !== 'consent' ||
      this.method === 'explicit' ||
      this.explicitConsent?.provided === true;
    if (!hasExplicitConsent) {
      return next(new Error('GDPR records with consent legal basis require explicit consent'));
    }
  }

  next();
});

// Indexes for efficient querying
consentRecordSchema.index({ userId: 1, userModel: 1, consentType: 1 });
consentRecordSchema.index({ granted: 1, withdrawn: 1 });
consentRecordSchema.index({ consentType: 1, granted: 1 });
consentRecordSchema.index({ expiresAt: 1 }); // For expired consent tracking
consentRecordSchema.index({ createdAt: -1 });
consentRecordSchema.index({ clientId: 1, recordType: 1, createdAt: -1 });

/** GDPR client consent records are append-only — never mutate after creation. */
consentRecordSchema.pre('save', function preventGdprConsentMutation(next) {
  if (!this.isNew && this.recordType) {
    return next(new Error('GDPR consent records are append-only and cannot be modified'));
  }
  next();
});

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



