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
      // Allow any payment method type from Stripe, not just the ones we explicitly handle
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
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
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
