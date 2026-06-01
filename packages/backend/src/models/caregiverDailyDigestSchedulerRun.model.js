const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

/**
 * Ledger row for one automated Daily Wellness Digest send attempt per caregiver/org-local day.
 * Unique on caregiver + localDateKey for idempotent scheduling.
 */
const caregiverDailyDigestSchedulerRunSchema = mongoose.Schema(
  {
    org: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Org',
      required: true,
      index: true,
    },
    caregiver: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Caregiver',
      required: true,
      index: true,
    },
    localDateKey: {
      type: String,
      required: true,
      trim: true,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
    },
    digestDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'skipped', 'failed'],
      default: 'pending',
      required: true,
    },
    skipReason: {
      type: String,
      default: null,
    },
    digestId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'CaregiverDailyDigest',
      default: null,
    },
    agendaJobId: {
      type: String,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    emailMessageId: {
      type: String,
      default: null,
    },
    digestPayloadHash: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    trigger: {
      type: String,
      enum: ['manual_backfill', 'scheduled', 'manual_test'],
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'caregiverdailydigestschedulerruns',
  }
);

caregiverDailyDigestSchedulerRunSchema.index({ caregiver: 1, localDateKey: 1 }, { unique: true });
caregiverDailyDigestSchedulerRunSchema.index({ org: 1, localDateKey: 1, status: 1 });

caregiverDailyDigestSchedulerRunSchema.plugin(toJSON);
caregiverDailyDigestSchedulerRunSchema.plugin(paginate);

const CaregiverDailyDigestSchedulerRun = mongoose.model(
  'CaregiverDailyDigestSchedulerRun',
  caregiverDailyDigestSchedulerRunSchema
);

module.exports = CaregiverDailyDigestSchedulerRun;
