const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');
const validator = require('validator');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { toJSON, paginate } = require('./plugins');

// Org Schema
const orgSchema = mongoose.Schema(
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
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    caregivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Caregiver' }],
    patients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Patient' }],
  },
  {
    timestamps: true,
  }
);

// Plugin to convert mongoose to JSON, and paginate results
orgSchema.plugin(toJSON);
orgSchema.plugin(paginate);
orgSchema.plugin(mongooseDelete, { deletedAt : true });

orgSchema.pre('find', function() {
  this.where({ deleted: { $ne: true } });
});

orgSchema.pre('findOne', function() {
  this.where({ deleted: { $ne: true } });
});

// Static method to check if email is taken
orgSchema.statics.isEmailTaken = async function (email, excludeOrgId) {
  const org = await this.findOne({ email, _id: { $ne: excludeOrgId } });
  return !!org;
};

orgSchema.statics.createOrgAndCaregiver = async function (orgBody, caregiverBody) {
  if (await this.isEmailTaken(orgBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  const Caregiver = this.model('Caregiver');
  if (await Caregiver.isEmailTaken(caregiverBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  const caregiver = await Caregiver.create({ ...caregiverBody, role: 'orgAdmin' });
  const org = await this.create({ ...orgBody, caregivers: [caregiver] });

  return org;
};

/**
 * @typedef Org
 */
const Org = mongoose.model('Org', orgSchema);

module.exports = Org;
