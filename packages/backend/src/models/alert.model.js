const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const alertSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },
    importance: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'low',
    },
    alertType: {
      type: String,
      enum: ['conversation', 'client', 'system'],
      required: true,
    },
    relatedClient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: function() {
        return this.alertType === 'conversation' || this.alertType === 'client';
      },
    },
    relatedConversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: function() {
        return this.alertType === 'conversation';
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'createdModel',
    },
    createdModel: {
      type: String,
      required: true,
      enum: ['Client', 'Caregiver', 'Org', 'Schedule'],
    },
    visibility: {
      type: String,
      enum: ['orgAdmin', 'allCaregivers', 'assignedCaregivers'],
      required: true,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Caregiver',
      },
    ],
    relevanceUntil: Date, // Indicates until when the alert is considered relevant
    /** Structured evidence for operators (US-3): transcript snippet, detector, confidence, conversation link */
    evidence: {
      type: new mongoose.Schema(
        {
          snippet: { type: String },
          conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
          },
          messageIds: [{ type: mongoose.Schema.Types.ObjectId }],
          detector: { type: String },
          confidence: { type: Number },
          language: { type: String },
        },
        { _id: false }
      ),
      default: undefined,
    },
    /** Suggested next steps (US-7); labelKey is resolved in the app i18n */
    recommendedActions: [
      {
        type: new mongoose.Schema(
          {
            id: { type: String, required: true },
            labelKey: { type: String, required: true },
            actionType: { type: String, required: true },
          },
          { _id: false }
        ),
      },
    ],
    /** How staff resolved this alert (set only via PATCH with resolutionNote; resolvedBy set server-side) */
    resolutionNote: {
      type: String,
      trim: true,
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
alertSchema.index({ createdBy: 1 });
alertSchema.index({ relevanceUntil: 1 }); // For relevance filtering
alertSchema.index({ createdBy: 1, relevanceUntil: 1 }); // Compound for alert queries
alertSchema.index({ readBy: 1 }); // For read status queries
alertSchema.index({ createdAt: -1 }); // For sorting
alertSchema.index({ resolvedBy: 1 });

// Plugin to convert mongoose to JSON, and paginate results
alertSchema.plugin(toJSON);
alertSchema.plugin(paginate);

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
