const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const accessControlSchema = mongoose.Schema(
  {
    reportId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Report'
    },
    allowedUsers: [{
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User'
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
