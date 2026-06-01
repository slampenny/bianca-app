const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');
const {
  familyWeeklyDigestImmutabilityPlugin,
  wrapCollectionMutators,
} = require('./plugins/familyWeeklyDigestImmutability.plugin');

/**
 * Weekly family call digest — high-level recap derived from calls/conversations.
 * Persisted for audit; email is sent only through an explicit send action.
 *
 * IMMUTABILITY: Sent digests are immutable. Writes must go through
 * familyWeeklyDigest.service helpers — see familyWeeklyDigestImmutability.plugin.js.
 */
const familyWeeklyDigestSchema = mongoose.Schema(
  {
    org: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Org',
      required: true,
      index: true,
    },
    client: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    /** Org-local Monday 00:00:00 as a UTC instant (week identity anchor) */
    weekStart: {
      type: Date,
      required: true,
      index: true,
    },
    weekEnd: {
      type: Date,
      required: true,
    },
    /** Org-local Monday date key (YYYY-MM-DD) for the digest week */
    localWeekKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    /** IANA timezone used when the digest was built */
    timezoneAtBuild: {
      type: String,
      default: null,
      trim: true,
    },
    /** True when weekStart/localWeekKey reflect legacy UTC Monday–Sunday semantics */
    legacyUtcWeek: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'sent'],
      default: 'draft',
    },
    /** Snapshot of recipient at generation (minimum necessary for send + audit). */
    recipient: {
      name: { type: String, trim: true, default: '' },
      relationship: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, lowercase: true, default: '' },
    },
    /** Structured payload returned to clients and used for email body. */
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    payloadHash: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Caregiver',
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
    collection: 'familyweeklydigests',
  }
);

familyWeeklyDigestSchema.index({ client: 1, localWeekKey: 1 }, { unique: true });
familyWeeklyDigestSchema.index({ org: 1, createdAt: -1 });
familyWeeklyDigestSchema.index({ client: 1, phiRedactedAt: 1 });
familyWeeklyDigestSchema.index({ org: 1, weekStart: 1, phiRedactedAt: 1 });
familyWeeklyDigestSchema.index({ org: 1, localWeekKey: 1, phiRedactedAt: 1 });
familyWeeklyDigestSchema.index({ client: 1, weekStart: 1, status: 1 });

familyWeeklyDigestSchema.plugin(familyWeeklyDigestImmutabilityPlugin);
familyWeeklyDigestSchema.plugin(toJSON);
familyWeeklyDigestSchema.plugin(paginate);

const FamilyWeeklyDigest = mongoose.model('FamilyWeeklyDigest', familyWeeklyDigestSchema);
wrapCollectionMutators(FamilyWeeklyDigest);

module.exports = FamilyWeeklyDigest;
