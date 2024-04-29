const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { toJSON, paginate } = require('./plugins');
const { roles } = require('../config/roles');

// Patient Schema
const patientSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
    password: {
      type: String,
      required: function required() {
        return this.role === 'caregiver';
      },
      trim: true,
      minlength: 8,
      validate(value) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new Error('Password must contain at least one letter and one number');
        }
      },
      private: true, // used by the toJSON plugin
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

// Method to check password match
patientSchema.methods.isPasswordMatch = async function (password) {
  const patient = this;
  return bcrypt.compare(password, patient.password);
};

// Pre-save middleware to hash password
patientSchema.pre('save', async function (next) {
  const patient = this;
  if (patient.isModified('password')) {
    patient.password = await bcrypt.hash(patient.password, 8);
  }
  next();
});

/**
 * @typedef Patient
 */
const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
