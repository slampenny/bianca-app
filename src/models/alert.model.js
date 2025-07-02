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
      enum: ['conversation', 'patient', 'system', 'schedule'],
      required: true,
    },
    // Reference to the related entity (patient or conversation)
    relatedPatient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: function() {
        return this.alertType === 'conversation' || this.alertType === 'patient';
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
      enum: ['Patient', 'Caregiver', 'Org', 'Schedule'],
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
  },
  {
    timestamps: true,
  }
);

// Plugin to convert mongoose to JSON, and paginate results
alertSchema.plugin(toJSON);
alertSchema.plugin(paginate);

const Alert = mongoose.model('Alert', alertSchema);
Alert.createIndexes({
  createdBy: 1,
  visibility: 1,
  dismissedBy: 1,
  relevanceUntil: 1,
});

module.exports = Alert;
