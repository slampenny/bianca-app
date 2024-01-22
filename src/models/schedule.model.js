const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const scheduleSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'User'
    },
    frequency: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'monthly']
    },
    nextCallDate: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
  }
);

scheduleSchema.plugin(toJSON);
scheduleSchema.plugin(paginate);

/**
 * @typedef Schedule
 */
const Schedule = mongoose.model('Schedule', scheduleSchema);

module.exports = Schedule;
