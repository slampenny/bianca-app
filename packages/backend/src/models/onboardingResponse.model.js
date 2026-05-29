const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const onboardingResponseSchema = mongoose.Schema(
  {
    clientId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    dayNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 14,
      index: true,
    },
    questionId: {
      type: String,
      required: true,
      trim: true,
    },
    responseType: {
      type: String,
      required: true,
      enum: ['text', 'enum', 'boolean'],
    },
    responseValue: {
      type: mongoose.SchemaTypes.Mixed,
      required: true,
    },
    verbatimTranscript: {
      type: String,
      trim: true,
    },
    callId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Call',
      default: null,
    },
    conversationId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    capturedAt: {
      type: Date,
      default: Date.now,
    },
    safety_flag: { type: Boolean, default: false },
    memory_flag: { type: Boolean, default: false },
    mood_flag: { type: Boolean, default: false },
    distress_flag: { type: Boolean, default: false },
    confusion_flag: { type: Boolean, default: false },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

onboardingResponseSchema.index({ clientId: 1, dayNumber: 1, questionId: 1 });
onboardingResponseSchema.plugin(toJSON);
onboardingResponseSchema.plugin(paginate);

const OnboardingResponse = mongoose.model('OnboardingResponse', onboardingResponseSchema);

module.exports = { OnboardingResponse };
