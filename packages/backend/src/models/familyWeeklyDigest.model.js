const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

/**
 * Weekly family call digest — high-level recap derived from calls/conversations.
 * Persisted for audit; email is sent only through an explicit send action.
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
    /** Monday 00:00:00.000 UTC for the digest week */
    weekStart: {
      type: Date,
      required: true,
      index: true,
    },
    weekEnd: {
      type: Date,
      required: true,
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
    createdBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Caregiver',
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'familyweeklydigests',
  }
);

familyWeeklyDigestSchema.index({ client: 1, weekStart: 1 }, { unique: true });
familyWeeklyDigestSchema.index({ org: 1, createdAt: -1 });

familyWeeklyDigestSchema.plugin(toJSON);
familyWeeklyDigestSchema.plugin(paginate);

const FamilyWeeklyDigest = mongoose.model('FamilyWeeklyDigest', familyWeeklyDigestSchema);

module.exports = FamilyWeeklyDigest;
