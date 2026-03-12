/**
 * Privacy Complaint Model
 * 
 * PIPEDA Requirements:
 * - Principle 10: Challenging Compliance
 * - Provide mechanism for individuals to challenge compliance
 * - Investigate all complaints
 * 
 * HIPAA Requirements:
 * - §164.530(d) - Complaints to covered entity
 * - §164.530(e) - Complaints to Secretary
 * 
 * Tracks privacy complaints for both PIPEDA and HIPAA compliance
 */

const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const privacyComplaintSchema = new mongoose.Schema(
  {
    // Complaint Identification
    complaintType: {
      type: String,
      required: true,
      enum: ['PIPEDA', 'HIPAA', 'GENERAL'],
      index: true
    },
    
    // Complainant Information
    complainantType: {
      type: String,
      required: true,
      enum: ['caregiver', 'client', 'external'],
      index: true
    },
    
    complainantId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'complainantModel',
      index: true
    },
    
    complainantModel: {
      type: String,
      required: true,
      enum: ['Caregiver', 'Client'],
      default: 'Caregiver'
    },
    
    // External complainant information (if not a user)
    externalComplainant: {
      name: String,
      email: String,
      phone: String,
      relationship: String,
      identityVerified: {
        type: Boolean,
        default: false
      }
    },
    
    // Complaint Details
    complaintDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    
    subject: {
      type: String,
      required: true,
      trim: true
    },
    
    description: {
      type: String,
      required: true
    },
    
    // What privacy right or principle was violated
    violationType: {
      type: String,
      enum: [
        'unauthorized_access',
        'unauthorized_disclosure',
        'incorrect_information',
        'denied_access',
        'denied_correction',
        'consent_issue',
        'retention_issue',
        'breach_notification',
        'complaint_handling',
        'other'
      ],
      required: true
    },
    
    // Status Tracking
    status: {
      type: String,
      required: true,
      enum: ['submitted', 'acknowledged', 'investigating', 'resolved', 'dismissed', 'escalated'],
      default: 'submitted',
      index: true
    },
    
    // Investigation
    acknowledgedAt: Date,
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver'
    },
    
    investigationStartedAt: Date,
    investigationNotes: [{
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
    
    // Resolution
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver'
    },
    resolution: {
      type: String,
      enum: ['upheld', 'partially_upheld', 'dismissed', 'remedial_action_taken']
    },
    resolutionDetails: String,
    remedialActions: [{
      action: String,
      completed: Boolean,
      completedAt: Date
    }],
    
    // Escalation to Regulator
    escalatedToRegulator: {
      type: Boolean,
      default: false
    },
    regulatorType: {
      type: String,
      enum: ['HHS', 'PrivacyCommissioner', 'OTHER']
    },
    escalatedAt: Date,
    regulatorComplaintNumber: String,
    
    // Organization country for jurisdiction
    organizationCountry: {
      type: String,
      trim: true,
      uppercase: true
    },
    
    // Processing Information
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver' // Privacy Officer or assigned staff
    },
    
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
privacyComplaintSchema.index({ complaintDate: -1 });
privacyComplaintSchema.index({ status: 1, complaintDate: -1 });
privacyComplaintSchema.index({ complainantId: 1, complaintDate: -1 });
privacyComplaintSchema.index({ complaintType: 1, status: 1 });
privacyComplaintSchema.index({ assignedTo: 1, status: 1 });

// Plugin to convert mongoose to JSON and paginate
privacyComplaintSchema.plugin(toJSON);
privacyComplaintSchema.plugin(paginate);

/**
 * Get complaints by complainant
 */
privacyComplaintSchema.statics.getByComplainant = async function(complainantId, complainantModel = 'Caregiver') {
  return this.find({
    complainantId,
    complainantModel
  }).sort({ complaintDate: -1 });
};

/**
 * Get open complaints (not resolved or dismissed)
 */
privacyComplaintSchema.statics.getOpenComplaints = async function() {
  return this.find({
    status: { $in: ['submitted', 'acknowledged', 'investigating', 'escalated'] }
  }).sort({ complaintDate: 1 });
};

/**
 * @typedef PrivacyComplaint
 */
const PrivacyComplaint = mongoose.model('PrivacyComplaint', privacyComplaintSchema);

module.exports = PrivacyComplaint;

