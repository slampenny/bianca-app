const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const accessControlSchema = mongoose.Schema(
  {
    reportId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Report'
    },
    allowedCaregivers: [{
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Caregiver'
    }]
  },
  {
    timestamps: true,
  }
);

accessControlSchema.plugin(toJSON);
accessControlSchema.plugin(paginate);

/**
 * @typedef AccessControl
 */
const AccessControl = mongoose.model('AccessControl', accessControlSchema);

module.exports = AccessControl;
