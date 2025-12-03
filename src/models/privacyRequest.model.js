/**
 * Privacy Request Model
 * 
 * PIPEDA Requirements:
 * - Access Rights (Section 8)
 * - Correction Rights (Section 8)
 * - 30-day response requirement
 * 
 * Tracks access and correction requests for PIPEDA compliance
 */

const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const privacyRequestSchema = new mongoose.Schema(
  {
    // Request Identification
    requestType: {
      type: String,
      required: true,
      enum: ['access', 'correction'],
      index: true
    },
    
    // Requestor Information
    requestorType: {
      type: String,
      required: true,
      enum: ['caregiver', 'patient', 'external'],
      index: true
    },
    
    requestorId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'requestorModel',
      index: true
    },
    
    requestorModel: {
      type: String,
      required: true,
      enum: ['Caregiver', 'Patient'],
      default: 'Caregiver'
    },
    
    // External requestor information (if not a user)
    externalRequestor: {
      name: String,
      email: String,
      phone: String,
      relationship: String, // e.g., "legal representative", "family member"
      identityVerified: {
        type: Boolean,
        default: false
      },
      identityVerificationMethod: String, // e.g., "government_id", "notarized_letter"
      identityVerificationDate: Date
    },
    
    // Request Details
    requestDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    
    informationRequested: {
      type: String,
      required: true
    },
    
    // For correction requests
    correctionDetails: {
      field: String, // Field to be corrected
      currentValue: String, // Current value
      requestedValue: String, // Requested correction
      reason: String // Reason for correction
    },
    
    // Status Tracking
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'denied', 'partially_fulfilled'],
      default: 'pending',
      index: true
    },
    
    // Response Tracking (30-day requirement)
    responseDeadline: {
      type: Date,
      required: true,
      default: function() {
        const deadline = new Date(this.requestDate);
        deadline.setDate(deadline.getDate() + 30);
        return deadline;
      },
      index: true
    },
    
    extensionRequested: {
      type: Boolean,
      default: false
    },
    
    extensionReason: String,
    
    extendedDeadline: Date, // Can extend to 60 days with notice
    
    // Response Information
    responseDate: Date,
    
    informationProvided: [{
      dataType: String, // e.g., "profile", "conversations", "medical_analysis"
      dataId: mongoose.Schema.Types.ObjectId,
      format: String, // e.g., "json", "pdf", "csv"
      providedAt: Date
    }],
    
    // For access requests
    accessMethod: {
      type: String,
      enum: ['download', 'view', 'email', 'mail']
    },
    
    // For correction requests
    correctionStatus: {
      corrected: Boolean,
      correctionDate: Date,
      correctionNotes: String,
      thirdPartiesNotified: Boolean,
      thirdPartiesNotifiedAt: Date,
      thirdPartiesNotifiedTo: [String] // List of third parties notified
    },
    
    // Fees (PIPEDA allows reasonable fees)
    fees: {
      amount: {
        type: Number,
        default: 0
      },
      currency: {
        type: String,
        default: 'CAD'
      },
      reason: String, // Explanation of fees
      paid: {
        type: Boolean,
        default: false
      },
      paidAt: Date
    },
    
    // Denial Information
    denialReason: String,
    denialDate: Date,
    
    // Appeal Information
    appealRequested: {
      type: Boolean,
      default: false
    },
    
    appealDate: Date,
    appealStatus: {
      type: String,
      enum: ['pending', 'approved', 'denied']
    },
    appealDecision: String,
    
    // Processing Information
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver' // Privacy Officer or assigned staff
    },
    
    processingNotes: [{
      note: String,
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Caregiver'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Compliance Tracking
    complianceNotes: String,
    privacyOfficerReviewed: {
      type: Boolean,
      default: false
    },
    privacyOfficerReviewedAt: Date,
    
    // Audit Trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver'
    },
    
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver'
    }
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
privacyRequestSchema.index({ requestDate: -1 });
privacyRequestSchema.index({ status: 1, responseDeadline: 1 });
privacyRequestSchema.index({ requestorId: 1, requestDate: -1 });
privacyRequestSchema.index({ assignedTo: 1, status: 1 });
privacyRequestSchema.index({ responseDeadline: 1, status: 1 }); // For deadline tracking

// Plugin to convert mongoose to JSON and paginate
privacyRequestSchema.plugin(toJSON);
privacyRequestSchema.plugin(paginate);

/**
 * Get requests approaching deadline (within 5 days)
 */
privacyRequestSchema.statics.getApproachingDeadline = async function() {
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
  
  return this.find({
    status: { $in: ['pending', 'processing'] },
    responseDeadline: { $lte: fiveDaysFromNow }
  }).sort({ responseDeadline: 1 });
};

/**
 * Get overdue requests
 */
privacyRequestSchema.statics.getOverdue = async function() {
  return this.find({
    status: { $in: ['pending', 'processing'] },
    responseDeadline: { $lt: new Date() }
  }).sort({ responseDeadline: 1 });
};

/**
 * Get requests by requestor
 */
privacyRequestSchema.statics.getByRequestor = async function(requestorId, requestorModel = 'Caregiver') {
  return this.find({
    requestorId,
    requestorModel
  }).sort({ requestDate: -1 });
};

/**
 * Get statistics
 */
privacyRequestSchema.statics.getStatistics = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.requestDate = {};
    if (startDate) match.requestDate.$gte = new Date(startDate);
    if (endDate) match.requestDate.$lte = new Date(endDate);
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        access: {
          $sum: { $cond: [{ $eq: ['$requestType', 'access'] }, 1, 0] }
        },
        correction: {
          $sum: { $cond: [{ $eq: ['$requestType', 'correction'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        processing: {
          $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        denied: {
          $sum: { $cond: [{ $eq: ['$status', 'denied'] }, 1, 0] }
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', ['pending', 'processing']] },
                  { $lt: ['$responseDeadline', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        },
        onTime: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'completed'] },
                  { $lte: ['$responseDate', '$responseDeadline'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    access: 0,
    correction: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    denied: 0,
    overdue: 0,
    onTime: 0
  };
};

/**
 * @typedef PrivacyRequest
 */
const PrivacyRequest = mongoose.model('PrivacyRequest', privacyRequestSchema);

module.exports = PrivacyRequest;



