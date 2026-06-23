const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const familyResidentLinkSchema = mongoose.Schema(
  {
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
      required: true,
      index: true,
    },
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Org',
      required: true,
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    /** _id from client.familyDigestRecipients[] */
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    portalEnabled: {
      type: Boolean,
      default: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
      default: null,
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'familyresidentlinks',
  }
);

familyResidentLinkSchema.index(
  { caregiver: 1, client: 1, recipientId: 1 },
  { unique: true, partialFilterExpression: { revokedAt: null } }
);
familyResidentLinkSchema.index({ caregiver: 1, revokedAt: 1 });
familyResidentLinkSchema.index({ client: 1, recipientId: 1 });

familyResidentLinkSchema.plugin(toJSON);

const FamilyResidentLink = mongoose.model('FamilyResidentLink', familyResidentLinkSchema);

module.exports = FamilyResidentLink;
