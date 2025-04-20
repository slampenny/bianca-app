const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const paymentMethodSchema = mongoose.Schema(
  {
    stripePaymentMethodId: {
      type: String,
      required: true,
      unique: true,
    },
    org: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Org',
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      required: true,
      enum: ['card', 'bank_account', 'us_bank_account'],
    },
    // Card details
    brand: String,
    last4: String,
    expMonth: Number,
    expYear: Number,
    // Bank account details
    bankName: String,
    accountType: String,
    // Common metadata
    billingDetails: {
      name: String,
      email: String,
      phone: String,
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        postal_code: String,
        country: String,
      },
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
paymentMethodSchema.plugin(toJSON);

/**
 * @typedef PaymentMethod
 */
const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

module.exports = PaymentMethod;
