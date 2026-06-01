const mongoose = require('mongoose');
const { toJSON } = require('./plugins');
const { tokenTypes } = require('../config/tokens');

const isClientScopedTokenType = (type) =>
  type === tokenTypes.CLIENT_CONSENT || type === tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY;

const tokenSchema = mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      index: true,
    },
    caregiver: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Caregiver',
      required: function() {
        return !isClientScopedTokenType(this.type);
      },
    },
    client: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Client',
      required: function() {
        return isClientScopedTokenType(this.type);
      },
    },
    type: {
      type: String,
      enum: [
        tokenTypes.REFRESH,
        tokenTypes.RESET_PASSWORD,
        tokenTypes.VERIFY_EMAIL,
        tokenTypes.INVITE,
        tokenTypes.SUPERADMIN_INVITE,
        tokenTypes.CLIENT_CONSENT,
        tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY,
      ],
      required: true,
    },
    expires: {
      type: Date,
      required: true,
    },
    blacklisted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
tokenSchema.plugin(toJSON);

/**
 * @typedef Token
 */
const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
