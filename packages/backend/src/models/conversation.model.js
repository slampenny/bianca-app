const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const messageSchema = mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['patient', 'assistant', 'system', 'debug-user'],
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
    enum: ['text', 'assistant_response', 'user_message', 'function_call', 'audio_transcript_delta', 'debug_user_message'],
    default: 'text',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  }
}, {
  timestamps: true,  // This adds createdAt and updatedAt automatically
});

// Conversation Schema - Represents the actual conversation content (messages, transcript, etc.)
// A Conversation only exists when there's actual conversation content (call was answered)
// The Call model tracks the phone call attempt itself
const conversationSchema = mongoose.Schema(
  {
    callId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Call',
      index: true,
      unique: true, // One conversation per call
    },
    patientId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Patient',
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
    analyzedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Metadata such as speaker distinction
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    debugAudioUrls: [{
      description: String,
      url: String,
      key: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
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
    summary: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
conversationSchema.index({ patientId: 1 });
conversationSchema.index({ callId: 1 });
conversationSchema.index({ patientId: 1, createdAt: -1 }); // For patient conversation history

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
