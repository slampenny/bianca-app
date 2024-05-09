const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');
const { toJSON, paginate } = require('./plugins');

const scheduleSchema = mongoose.Schema(
  {
    patientId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Patient'
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
    // Modify the schema
    time: {
      type: String,
      required: true,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/ // Validates time in HH:mm format
    },
    nextCallDate: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.deleted;
        return ret;
      },
    },
  }
);

scheduleSchema.methods.calculateNextCallDate = function() {
  const now = new Date(Date.now());

  // Reset nextCallDate to the start of the next UTC day
  this.nextCallDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  // Set the time for nextCallDate using UTC methods
  const [hours, minutes] = this.time.split(':');
  this.nextCallDate.setUTCHours(Number(hours), Number(minutes), 0, 0);

  switch (this.frequency) {
    case 'daily':
      // For daily, nextCallDate is already set to the tiem field of the next UTC day.
      break;

    case 'weekly':
      let smallestDifference = Infinity; // To find the closest next call date
      this.intervals.forEach(interval => {
        const dayDifference = (interval.day - now.getUTCDay() + 7) % 7 || 7;
        const targetDate = new Date(this.nextCallDate.getTime());
        targetDate.setUTCDate(targetDate.getUTCDate() + dayDifference);
        const weeksToAdd = interval.weeks - 1; // Subtract 1 because we already count this week's day
        targetDate.setUTCDate(targetDate.getUTCDate() + weeksToAdd * 7);
        // Check if this targetDate is the closest one so far
        if (targetDate > now && (targetDate < this.nextCallDate || this.nextCallDate <= now)) {
          this.nextCallDate = new Date(targetDate);
          smallestDifference = dayDifference;
        }
      });
      break;

      case 'monthly':
        this.intervals.forEach(interval => {
          let month = now.getUTCMonth();
          let year = now.getUTCFullYear();
          // Set the target date considering the desired day and adjust for the month's day count
          let day = Math.min(interval.day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
          let targetDate = new Date(Date.UTC(year, month, day));
  
          if (targetDate <= now) {
            // If the target date is past or is today, calculate for the next month
            day = Math.min(interval.day, new Date(Date.UTC(year, month + 2, 0)).getUTCDate()); // Get day count for next month
            targetDate = new Date(Date.UTC(year, month + 1, day));
          }
  
          // Check if this target date is closer than the previously found date
          if (targetDate > now && (targetDate < this.nextCallDate || this.nextCallDate <= now)) {
            this.nextCallDate = new Date(targetDate);
          }
        });
        break;
  }
};


scheduleSchema.plugin(toJSON);
scheduleSchema.plugin(paginate);
scheduleSchema.plugin(mongooseDelete, { deletedAt : true });

scheduleSchema.pre('find', function() {
  this.where({ deleted: { $ne: true } });
});

scheduleSchema.pre('findOne', function() {
  this.where({ deleted: { $ne: true } });
});

// Pre-save middleware to hash password
scheduleSchema.pre('validate', async function (next) {
  const schedule = this;
  schedule.calculateNextCallDate();
  next();
});
/**
 * @typedef Schedule
 */
const Schedule = mongoose.model('Schedule', scheduleSchema);

module.exports = Schedule;