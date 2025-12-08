const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

// Report Schema
const reportSchema = mongoose.Schema(
  {
    patientId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Patient',
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    // Additional details for reports
    analysisDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Plugins for JSON conversion and pagination
reportSchema.plugin(toJSON);
reportSchema.plugin(paginate);

/**
 * @typedef Report
 */
const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
