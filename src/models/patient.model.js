const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');
const validator = require('validator');
const { toJSON, paginate } = require('./plugins');

// Patient Schema
const patientSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isMobilePhone (value)) {
          throw new Error('Invalid phone number');
        }
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    org: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Org',
      default: null,
    },
    caregivers: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Caregiver',
      },
    ],
    schedules: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Schedule',
      },
    ],
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

// Plugin to convert mongoose to JSON, and paginate results
patientSchema.plugin(toJSON);
patientSchema.plugin(paginate);
patientSchema.plugin(mongooseDelete, { deletedAt : true });

// Static method to check if email is taken
patientSchema.statics.isEmailTaken = async function (email, excludePatientId) {
  const patient = await this.findOne({ email, _id: { $ne: excludePatientId } });
  return !!patient;
};

patientSchema.pre('find', function() {
  this.where({ $or: [{ deleted: { $ne: true } }, { deleted: { $exists: false } }] });
});

patientSchema.pre('findOne', function() {
  this.where({ $or: [{ deleted: { $ne: true } }, { deleted: { $exists: false } }] });
});

/**
 * @typedef Patient
 */
const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
