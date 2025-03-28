const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const lineItemSchema = mongoose.Schema(
  {
    patientId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Patient'
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
      ref: 'Patient'
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
const LineItem = mongoose.model('LineItem', lineItemSchema);

module.exports.Invoice = Invoice;
module.exports.LineItem = LineItem;
