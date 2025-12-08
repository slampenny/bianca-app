const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

// Call Schema
const callSchema = mongoose.Schema(
  {
    patientId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Patient',
    },
    dateTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    // Field to store call details or metadata
    callDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Plugins for JSON conversion and pagination
callSchema.plugin(toJSON);
callSchema.plugin(paginate);

/**
 * @typedef Call
 */
const Call = mongoose.model('Call', callSchema);

module.exports = Call;
