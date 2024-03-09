const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const lineItemSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'User'
    },
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true
    }
  },
  {
    _id: false
  }
);

const invoiceSchema = mongoose.Schema(
  {
    caregiverId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'User'
    },
    date: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      required: true
    },
    lineItems: [lineItemSchema],
    totalAmount: {
      type: Number,
      required: true
    },
    paymentMethod: {
      type: String,
      required: true
    },
    transactionId: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
  }
);

invoiceSchema.plugin(toJSON);
invoiceSchema.plugin(paginate);

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;