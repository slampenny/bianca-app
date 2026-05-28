/**
 * Erasure Completion Record
 *
 * Evidence of GDPR Article 17 erasure completion — retained as compliance proof.
 */

const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const erasureCompletionRecordSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrivacyRequest',
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    jurisdiction: {
      type: String,
      required: true,
      enum: ['GDPR', 'PIPEDA', 'HIPAA', 'OTHER'],
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    subjectModel: {
      type: String,
      required: true,
      enum: ['Caregiver', 'Client'],
    },
    scope: {
      clientRecord: { type: Boolean, default: false },
      conversations: { type: Number, default: 0 },
      messages: { type: Number, default: 0 },
      clientMemory: { type: Number, default: 0 },
      s3AudioObjects: { type: Number, default: 0 },
      consentRecordsAnonymized: { type: Number, default: 0 },
      auditLogsSuppressed: { type: Number, default: 0 },
      calls: { type: Number, default: 0 },
      medicalAnalysis: { type: Number, default: 0 },
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
    },
  },
  { timestamps: true }
);

erasureCompletionRecordSchema.plugin(toJSON);

const ErasureCompletionRecord = mongoose.model('ErasureCompletionRecord', erasureCompletionRecordSchema);

module.exports = ErasureCompletionRecord;
