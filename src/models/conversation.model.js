const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const messageSchema = mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant', 'system'],
  },
  content: {
    type: String,
    required: true,
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,  // Add index for faster queries
  },
  messageType: {
    type: String,
    enum: ['text', 'assistant_response', 'user_message', 'function_call', 'audio_transcript_delta'],
    default: 'text',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  }
}, {
  timestamps: true,  // This adds createdAt and updatedAt automatically
});

// Conversation Schema
const conversationSchema = mongoose.Schema(
  {
    callSid: {
      type: String,
      index: true,
    },
    patientId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Patient',
    },
    lineItemId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'LineItem',
      default: null, // Indicates that the conversation has not been billed yet
    },
    messages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
      },
    ],
    history: {
      type: String,
    },
    callType: {
      type: String,
      enum: ['inbound', 'outbound', 'wellness-check', 'follow-up'],
      default: 'inbound',
    },
    
    status: {
      type: String,
      enum: ['initiated', 'in-progress', 'completed', 'failed', 'machine'],
      default: 'initiated',
    },
    
    asteriskChannelId: {
      type: String,
      // For tracking the Asterisk side of the call
    },
    analyzedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Metadata such as speaker distinction
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    startTime: {
      type: Date,
      default: Date.now, // Defaults to the current time
    },
    endTime: {
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
      // Note: Zero-duration conversations are allowed to exist in the database
      // but will be adjusted to minimum billable duration (30 seconds) for failed calls
      // via the pre-save hook
    },
    // Add these fields to your conversationSchema:

    debugAudioUrls: [{
      description: String,
      url: String,
      key: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],

    callEndReason: {
      type: String,
      enum: ['normal_completion', 'user_hangup', 'assistant_error', 'network_error', 'timeout', 'unknown', null],
      default: null,
    },

    // Also consider adding these for better tracking:
    realtimeSessionId: {
      type: String,
      // OpenAI session ID for debugging
    },

    totalMessages: {
      type: Number,
      default: 0,
    },

    // For tracking conversation quality
    conversationQuality: {
      audioIssues: {
        type: Boolean,
        default: false,
      },
      transcriptionErrors: {
        type: Number,
        default: 0,
      },
      reconnectCount: {
        type: Number,
        default: 0,
      }
    },

    // NEW: Call workflow fields
    callStatus: {
      type: String,
      enum: ['initiating', 'ringing', 'answered', 'connected', 'ended', 'failed', 'busy', 'no_answer'],
      default: 'initiating',
    },
    
    callStartTime: {
      type: Date,
      default: Date.now,
    },
    
    callEndTime: {
      type: Date,
    },
    
    callDuration: {
      type: Number,
      default: 0,
      min: [0, 'Call duration cannot be negative'],
    },
    
    callOutcome: {
      type: String,
      enum: ['answered', 'no_answer', 'busy', 'failed', 'voicemail', null],
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
    }
  },
  {
    timestamps: true,
  }
);

conversationSchema.pre('save', function (next) {
  if (this.startTime && this.endTime) {
    const calculatedDuration = (this.endTime.getTime() - this.startTime.getTime()) / 1000;
    
    // Billing Policy:
    // - Successful calls (completed): Billed for actual duration
    // - Failed calls (failed, machine, busy, no-answer): Billed minimum 30 seconds
    // - Zero-duration calls: Adjusted to minimum 30 seconds for billing
    // This ensures we charge for service attempts even when calls don't connect
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

conversationSchema.statics.aggregateUnchargedConversations = async function (patientId) {
  return await this.aggregate([
    {
      $match: {
        patientId: new mongoose.Types.ObjectId(patientId),
        lineItemId: null,
      },
    },
    {
      $group: {
        _id: '$patientId',
        totalDuration: { $sum: '$duration' },
        conversationIds: { $push: '$_id' },
      },
    },
    {
      $project: {
        patientId: '$_id',
        totalDuration: 1,
        conversationIds: 1,
        _id: 0,
      },
    },
  ]);
};

// Plugins for JSON conversion and pagination
conversationSchema.plugin(toJSON);
conversationSchema.plugin(paginate);

/**
 * @typedef Conversation
 */
const Conversation = mongoose.model('Conversation', conversationSchema);

/**
 * @typedef Message
 */
const Message = mongoose.model('Message', messageSchema);

module.exports = { Message, Conversation };
