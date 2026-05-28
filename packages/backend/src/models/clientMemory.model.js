const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const decayPolicySchema = new mongoose.Schema(
  {
    halfLifeDays: { type: Number, required: true },
    minConfidence: { type: Number, required: true },
  },
  { _id: false }
);

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
      required: false,
    },
    fact: {
      type: String,
      required: true,
      maxlength: 500,
    },
    category: {
      type: String,
      enum: [
        'preference',
        'relationship',
        'health',
        'mood',
        'concern',
        'life_event',
        'cognitive',
        'safety',
        'general',
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
    status: {
      type: String,
      enum: ['provisional', 'active', 'stale', 'conflicted', 'archived'],
      default: 'provisional',
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.55,
    },
    reinforcementCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    contradictionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    firstObservedAt: {
      type: Date,
      default: Date.now,
    },
    lastObservedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    normalizedKey: {
      type: String,
      trim: true,
      index: true,
    },
    sensitivity: {
      type: String,
      enum: ['normal', 'elevated', 'high'],
      default: 'normal',
    },
    sourceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
      },
    ],
    decayPolicy: {
      type: decayPolicySchema,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedReason: {
      type: String,
      enum: ['erasure_request', 'client_deleted', 'org_deleted', 'retention_expired'],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

clientMemorySchema.index(
  { deletedAt: 1 },
  { partialFilterExpression: { deletedAt: { $exists: true, $ne: null } } }
);
clientMemorySchema.index({ clientId: 1, extractedAt: -1 });
clientMemorySchema.index({ clientId: 1, category: 1, extractedAt: -1 });
clientMemorySchema.index({ clientId: 1, priority: 1, extractedAt: -1 });
clientMemorySchema.index({ clientId: 1, normalizedKey: 1, status: 1 });
clientMemorySchema.index(
  { clientId: 1, normalizedKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      normalizedKey: { $type: 'string' },
      status: { $in: ['provisional', 'active', 'stale'] },
    },
  }
);

clientMemorySchema.plugin(toJSON);
clientMemorySchema.plugin(paginate);

const ClientMemory = mongoose.model('ClientMemory', clientMemorySchema);

module.exports = { ClientMemory };
