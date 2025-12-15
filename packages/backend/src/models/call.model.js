const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

// Call Schema - Represents a phone call attempt
const callSchema = mongoose.Schema(
  {
    callSid: {
      type: String,
      index: true,
      required: true,
    },
    patientId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Patient',
    },
    callType: {
      type: String,
      enum: ['inbound', 'outbound', 'wellness-check', 'follow-up'],
      default: 'outbound',
    },
    status: {
      type: String,
      enum: ['initiated', 'in-progress', 'completed', 'failed', 'machine'],
      default: 'initiated',
    },
    callStatus: {
      type: String,
      enum: ['initiating', 'ringing', 'answered', 'connected', 'ended', 'failed', 'busy', 'no_answer'],
      default: 'initiating',
    },
    callOutcome: {
      type: String,
      enum: ['answered', 'no_answer', 'busy', 'failed', 'voicemail', null],
      default: null,
    },
    asteriskChannelId: {
      type: String,
      // For tracking the Asterisk side of the call
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    callStartTime: {
      type: Date,
      default: Date.now,
    },
    callEndTime: {
      type: Date,
    },
    duration: {
      type: Number,
      default: 0,
      min: [0, 'Duration cannot be negative'],
      validate: {
        validator: function(v) {
          return v >= 0;
        },
        message: 'Duration must be non-negative'
      }
    },
    callDuration: {
      type: Number,
      default: 0,
      min: [0, 'Call duration cannot be negative'],
    },
    cost: {
      type: Number,
      default: 0,
      min: [0, 'Cost cannot be negative'],
      validate: {
        validator: function(v) {
          return v >= 0;
        },
        message: 'Cost must be non-negative'
      }
    },
    lineItemId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'LineItem',
      default: null, // Indicates that the call has not been billed yet
    },
    // Retry fields for missed call retry functionality
    retryAttempt: {
      type: Number,
      default: 0,
      min: [0, 'Retry attempt cannot be negative'],
    },
    retryScheduledAt: {
      type: Date,
    },
    originalCallId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Call',
    },
    maxRetries: {
      type: Number,
      default: 2,
      min: [0, 'Max retries cannot be negative'],
    },
    callEndReason: {
      type: String,
      enum: ['normal_completion', 'user_hangup', 'assistant_error', 'network_error', 'timeout', 'unknown', null],
      default: null,
    },
    agentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Caregiver',
      required: false,
    },
    callNotes: {
      type: String,
      default: '',
    },
    // Reference to conversation if call was answered and conversation occurred
    conversationId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Conversation',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
callSchema.index({ patientId: 1 });
callSchema.index({ callSid: 1 });
callSchema.index({ lineItemId: 1 });
callSchema.index({ patientId: 1, lineItemId: 1 }); // Critical for billing queries
callSchema.index({ patientId: 1, startTime: -1 }); // For patient call history
callSchema.index({ status: 1, startTime: -1 }); // For status-based queries
callSchema.index({ originalCallId: 1 }); // For retry queries

// Pre-save hook to calculate duration and apply billing rules
callSchema.pre('save', function (next) {
  if (this.startTime && this.endTime) {
    const calculatedDuration = (this.endTime.getTime() - this.startTime.getTime()) / 1000;
    
    // Billing Policy:
    // - Successful calls (completed): Billed for actual duration
    // - Failed calls (failed, machine, busy, no-answer): Billed minimum 30 seconds
    // - Zero-duration calls: Adjusted to minimum 30 seconds for billing
    if (calculatedDuration <= 0 || this.status === 'failed' || this.status === 'machine') {
      // Set minimum billable duration for failed calls (e.g., 30 seconds)
      this.duration = Math.max(calculatedDuration, 30); // Minimum 30 seconds for billing
      
      // If the calculated duration was actually 0, adjust endTime to reflect the minimum duration
      if (calculatedDuration <= 0) {
        this.endTime = new Date(this.startTime.getTime() + (this.duration * 1000));
      }
    } else {
      this.duration = calculatedDuration;
    }
  }
  next();
});

// Plugins for JSON conversion and pagination
callSchema.plugin(toJSON);
callSchema.plugin(paginate);

/**
 * @typedef Call
 */
const Call = mongoose.model('Call', callSchema);

module.exports = Call;
