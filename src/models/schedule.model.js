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
    time: {
      type: Date,
      required: true
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

scheduleSchema.methods.calculateNextCallDate = function() {
  const now = new Date();

  // Reset nextCallDate to the start of the next day
  this.nextCallDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // Set the time for nextCallDate
  this.nextCallDate.setHours(this.time.getHours(), this.time.getMinutes(), this.time.getSeconds());

  switch (this.frequency) {
    case 'daily':
      // No changes needed for daily, as we've already set nextCallDate to the start of the next day
      break;
    case 'weekly':
      const weeklyInterval = this.intervals.find(i => i.day === now.getDay());
      if (weeklyInterval) {
        // Add the number of days until the next scheduled day of the week
        const daysUntilNext = (weeklyInterval.day - now.getDay() + 7) % 7 || 7;
        this.nextCallDate.setDate(this.nextCallDate.getDate() + daysUntilNext);
      }
      break;
    case 'monthly':
      const monthlyInterval = this.intervals.find(i => i.day === now.getDate());
      if (monthlyInterval) {
        // Add the number of days until the next scheduled day of the month
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysUntilNext = (monthlyInterval.day - now.getDate() + daysInMonth) % daysInMonth || daysInMonth;
        this.nextCallDate.setDate(this.nextCallDate.getDate() + daysUntilNext);
      }
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