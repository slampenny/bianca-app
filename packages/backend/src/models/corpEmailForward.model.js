const mongoose = require('mongoose');

const corpEmailForwardSchema = new mongoose.Schema(
  {
    corpEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    forwardToEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
      default: null,
    },
  },
  { timestamps: true },
);

corpEmailForwardSchema.index({ caregiverId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('CorpEmailForward', corpEmailForwardSchema);
