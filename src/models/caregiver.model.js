const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { toJSON, paginate } = require('./plugins');
const { roles } = require('../config/roles');

// Caregiver Schema
const caregiverSchema = mongoose.Schema(
  {
    org: { type: mongoose.Schema.Types.ObjectId, ref: 'Org' },
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
      required: function required() {
        return this.role !== 'unverified';
      },
      trim: true,
      validate(value) {
        if (value && !validator.isMobilePhone(value)) {
          throw new Error('Invalid phone number');
        }
      },
    },
    password: {
      type: String,
      required: function required() {
        return this.role !== 'invited' && !this.ssoProvider;
      },
      trim: true,
      minlength: 8,
      validate(value) {
        if (value && (!value.match(/\d/) || !value.match(/[a-zA-Z]/))) {
          throw new Error('Password must contain at least one letter and one number');
        }
      },
      private: true, // used by the toJSON plugin
    },
    // SSO fields
    ssoProvider: {
      type: String,
      enum: ['google', 'microsoft'],
      required: false,
    },
    ssoProviderId: {
      type: String,
      required: false,
      trim: true,
    },
    role: {
      type: String,
      enum: roles, // assuming roles is an array of valid roles
      default: 'staff',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // HIPAA Compliance: Multi-Factor Authentication
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      private: true, // Exclude from toJSON
    },
    mfaBackupCodes: {
      type: [String],
      private: true, // Exclude from toJSON
    },
    mfaEnrolledAt: {
      type: Date,
    },
    // HIPAA Compliance: Account Security
    accountLocked: {
      type: Boolean,
      default: false,
    },
    lockedReason: {
      type: String,
    },
    lockedAt: {
      type: Date,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lastFailedLogin: {
      type: Date,
    },
    patients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Patient' }],
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
caregiverSchema.plugin(toJSON);
caregiverSchema.plugin(paginate);
caregiverSchema.plugin(mongooseDelete, { deletedAt: true });

caregiverSchema.pre('find', function () {
  this.where({ $or: [{ deleted: { $ne: true } }, { deleted: { $exists: false } }] });
});

caregiverSchema.pre('findOne', function () {
  this.where({ $or: [{ deleted: { $ne: true } }, { deleted: { $exists: false } }] });
});

// Static method to check if email is taken
caregiverSchema.statics.isEmailTaken = async function (email, excludeCaregiverId) {
  const caregiver = await this.findOne({ email, _id: { $ne: excludeCaregiverId } });
  return !!caregiver;
};

// Method to check password match
caregiverSchema.methods.isPasswordMatch = async function (password) {
  const caregiver = this;
  return bcrypt.compare(password, caregiver.password);
};

// Pre-save middleware to hash password
caregiverSchema.pre('save', async function (next) {
  const caregiver = this;
  if (caregiver.isModified('password') && caregiver.password) {
    caregiver.password = await bcrypt.hash(caregiver.password, 8);
  }
  next();
});

/**
 * @typedef Caregiver
 */
const Caregiver = mongoose.model('Caregiver', caregiverSchema);

module.exports = Caregiver;
