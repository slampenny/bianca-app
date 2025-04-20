const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const lineItemSchema = mongoose.Schema(
  {
    patientId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Patient',
    },
    invoiceId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Invoice',
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    periodStart: {
      type: Date,
    },
    periodEnd: {
      type: Date,
    },
    quantity: {
      type: Number,
      default: 1,
    },
    unitPrice: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const invoiceSchema = mongoose.Schema(
  {
    org: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Org',
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    issueDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'pending', 'paid', 'void', 'overdue'],
      default: 'draft',
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'PaymentMethod',
    },
    stripePaymentIntentId: {
      type: String,
    },
    stripeInvoiceId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for line items associated with this invoice
invoiceSchema.virtual('lineItems', {
  ref: 'LineItem',
  localField: '_id',
  foreignField: 'invoiceId',
});

// Add a method to calculate the total from line items
invoiceSchema.methods.calculateTotal = async function () {
  const lineItems = await LineItem.find({ invoiceId: this._id });
  this.totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
  return this.totalAmount;
};

invoiceSchema.plugin(toJSON);
invoiceSchema.plugin(paginate);

const Invoice = mongoose.model('Invoice', invoiceSchema);
const LineItem = mongoose.model('LineItem', lineItemSchema);

module.exports = {
  Invoice,
  LineItem,
};
