const mongoose = require('mongoose');
const { toJSON } = require('./plugins');
const { tokenTypes } = require('../config/tokens');

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
        // Caregiver is required for all token types except CLIENT_CONSENT
        return this.type !== tokenTypes.CLIENT_CONSENT;
      },
    },
    client: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Client',
      required: function() {
        return this.type === tokenTypes.CLIENT_CONSENT;
      },
    },
    type: {
      type: String,
      enum: [tokenTypes.REFRESH, tokenTypes.RESET_PASSWORD, tokenTypes.VERIFY_EMAIL, tokenTypes.INVITE, tokenTypes.CLIENT_CONSENT],
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
