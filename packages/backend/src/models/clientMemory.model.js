const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const clientMemorySchema = mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: false, // null for mid-call facts written by emergency processor
    },
    fact: {
      type: String,
      required: true,
      maxlength: 500,
    },
    category: {
      type: String,
      enum: [
        'preference', // how they like to be addressed, topics they enjoy
        'relationship', // family members, friends, caregivers mentioned
        'health', // conditions, symptoms, medications, upcoming procedures
        'mood', // emotional state, patterns over time
        'concern', // unresolved worries, things to follow up on
        'life_event', // moves, losses, milestones, changes in routine
        'cognitive', // memory lapses, confusion, repetition patterns
        'safety', // fall risk, isolation, emergency-adjacent signals
        'general', // anything that doesn't fit above
      ],
      default: 'general',
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    priority: {
      type: String,
      enum: ['urgent', 'normal'],
      default: 'normal',
    },
    source: {
      type: String,
      enum: ['post_call_extraction', 'mid_call_emergency', 'manual'],
      default: 'post_call_extraction',
    },
    extractedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

clientMemorySchema.index({ clientId: 1, extractedAt: -1 });
clientMemorySchema.index({ clientId: 1, category: 1, extractedAt: -1 });
clientMemorySchema.index({ clientId: 1, priority: 1, extractedAt: -1 });

clientMemorySchema.plugin(toJSON);
clientMemorySchema.plugin(paginate);

const ClientMemory = mongoose.model('ClientMemory', clientMemorySchema);

module.exports = { ClientMemory };
