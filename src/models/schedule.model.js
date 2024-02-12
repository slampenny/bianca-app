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
    intervals: {
      type: [{
        day: { type: Number }, // 0-6 for days of the week if weekly, 1-31 for days of the month if monthly
        weeks: { type: Number } // number of weeks between each run for weekly schedules
      }],
      validate: {
        validator: function (v) {
          return this.frequency === 'daily' || (Array.isArray(v) && v.length > 0);
        },
        message: props => `intervals is required for weekly and monthly frequencies`
      }
    },
    isActive: {
      type: Boolean,
      default: true,
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

scheduleSchema.methods.calculateNextCallDate = async function() {
  // Get the current date
  const now = new Date();

  // Check if the schedule should run based on the intervals field
  const interval = this.intervals.find(i => i.day === (this.frequency === 'weekly' ? now.getDay() : now.getDate()));
  if (!interval) {
    return;
  }

  // Run the schedule
  // This could be a function call, a request to another service, etc.
  console.log(`Running schedule ${this.id}`);

  // Update the nextCallDate based on the frequency and interval
  switch (this.frequency) {
    case 'daily':
      this.nextCallDate.setDate(this.nextCallDate.getDate() + 1);
      break;
    case 'weekly':
      this.nextCallDate.setDate(this.nextCallDate.getDate() + 7 * interval.weeks);
      break;
    case 'monthly':
      this.nextCallDate.setMonth(this.nextCallDate.getMonth() + 1);
      break;
  }
};

scheduleSchema.plugin(toJSON);
scheduleSchema.plugin(paginate);

/**
 * @typedef Schedule
 */
const Schedule = mongoose.model('Schedule', scheduleSchema);

module.exports = Schedule;