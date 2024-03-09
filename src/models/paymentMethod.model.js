const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const paymentMethodSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'User'
    },
    stripeCustomerId: {
      type: String,
      required: true,
    },
    stripePaymentMethodId: {
      type: String,
      required: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastPaymentDate: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
  }
);

paymentMethodSchema.plugin(toJSON);
paymentMethodSchema.plugin(paginate);

/**
 * @typedef Schedule
 */
const paymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

module.exports = paymentMethodSchema;