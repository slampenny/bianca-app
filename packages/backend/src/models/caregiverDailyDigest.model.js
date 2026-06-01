const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');
const {
  caregiverDailyDigestImmutabilityPlugin,
  wrapCollectionMutators,
} = require('./plugins/caregiverDailyDigestImmutability.plugin');

/**
 * Per-caregiver daily digest — versioned, immutable once sent.
 *
 * IMMUTABILITY: Sent digests are immutable. All writes must go through
 * caregiverDailyDigest.service helpers — never mutate sent records via
 * direct model/collection updates. See caregiverDailyDigestImmutability.plugin.js.
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
    /** Start of org-local calendar day as a UTC instant (see localDateKey + timezoneAtBuild) */
    digestDate: {
      type: Date,
      required: true,
      index: true,
    },
    /** Org-local calendar date YYYY-MM-DD used for day identity */
    localDateKey: {
      type: String,
      trim: true,
      index: true,
    },
    /** IANA timezone snapshot when the digest was built */
    timezoneAtBuild: {
      type: String,
      trim: true,
      default: null,
    },
    /** True when digestDate was keyed to UTC calendar day (pre org-local migration) */
    legacyUtcDay: {
      type: Boolean,
      default: false,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    builtAt: {
      type: Date,
      required: true,
      default: Date.now,
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
    /** Localized labels + per-client rows for UI / email */
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    payloadHash: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    sentPayloadHash: {
      type: String,
      default: null,
    },
    emailMessageId: {
      type: String,
      default: null,
    },
    emailRecipient: {
      type: String,
      default: null,
    },
    emailSubject: {
      type: String,
      default: null,
    },
    sendInProgressAt: {
      type: Date,
      default: null,
    },
    previousDigest: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'CaregiverDailyDigest',
      default: null,
    },
    supersedesDigest: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'CaregiverDailyDigest',
      default: null,
    },
    /** When payload PHI was redacted for retention / deletion compliance */
    phiRedactedAt: {
      type: Date,
      default: null,
    },
    phiRedactedReason: {
      type: String,
      enum: [
        'client_deleted',
        'caregiver_deleted',
        'org_deleted',
        'retention_expired',
        'erasure_request',
        'orphaned',
        null,
      ],
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'caregiverdailydigests',
  }
);

caregiverDailyDigestSchema.index({ caregiver: 1, digestDate: 1, version: 1 }, { unique: true });
caregiverDailyDigestSchema.index({ caregiver: 1, localDateKey: 1 });
caregiverDailyDigestSchema.index({ caregiver: 1, digestDate: 1, status: 1 });
caregiverDailyDigestSchema.index({ org: 1, digestDate: -1 });
caregiverDailyDigestSchema.index({ previousDigest: 1 });

caregiverDailyDigestSchema.plugin(caregiverDailyDigestImmutabilityPlugin);
caregiverDailyDigestSchema.plugin(toJSON);
caregiverDailyDigestSchema.plugin(paginate);

const CaregiverDailyDigest = mongoose.model('CaregiverDailyDigest', caregiverDailyDigestSchema);
wrapCollectionMutators(CaregiverDailyDigest);

module.exports = CaregiverDailyDigest;
