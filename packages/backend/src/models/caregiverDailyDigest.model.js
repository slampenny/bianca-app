const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

/**
 * Per-caregiver daily digest — summarized check-ins and sentiment for assigned clients.
 * Email delivery is reserved for a later phase; persisted for viewing in-app and future send.
 */
const caregiverDailyDigestSchema = mongoose.Schema(
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
    /** Start of digest calendar day (00:00:00.000 UTC) */
    digestDate: {
      type: Date,
      required: true,
      index: true,
    },
    /** BCP-47 style code matching Caregiver.preferredLanguage used when building payload */
    locale: {
      type: String,
      default: 'en',
    },
    status: {
      type: String,
      enum: ['draft', 'sent'],
      default: 'draft',
    },
    /** Localized labels + per-client rows for UI / future email */
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'caregiverdailydigests',
  }
);

caregiverDailyDigestSchema.index({ caregiver: 1, digestDate: 1 }, { unique: true });
caregiverDailyDigestSchema.index({ org: 1, digestDate: -1 });

caregiverDailyDigestSchema.plugin(toJSON);
caregiverDailyDigestSchema.plugin(paginate);

const CaregiverDailyDigest = mongoose.model('CaregiverDailyDigest', caregiverDailyDigestSchema);

module.exports = CaregiverDailyDigest;
