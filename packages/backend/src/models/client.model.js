const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');
const validator = require('validator');
const { toJSON, paginate } = require('./plugins');
const { splitFullName, fullNameFromParts } = require('../utils/clientName.util');

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true },
    /** Optional; required to email weekly family call digests to an authorized contact. */
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      validate(value) {
        if (value && String(value).trim() !== '' && !validator.isEmail(value)) {
          throw new Error('Invalid emergency contact email');
        }
      },
    },
  },
  { _id: false }
);

// Client Schema
const clientSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
      default: '',
    },
    avatar: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: true,
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
        if (!validator.isMobilePhone(value)) {
          throw new Error('Invalid phone number');
        }
      },
    },
    preferredName: {
      type: String,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
      max: 150,
    },
    notes: {
      type: String,
    },
    preferredLanguage: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'ko', 'hu'],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    consented: {
      type: Boolean,
      default: true,
    },
    consentedAt: {
      type: Date,
      required: false,
    },
    consentEmailVersion: {
      type: String,
      required: false,
      trim: true,
    },
    room: {
      type: String,
      required: false,
      trim: true,
    },
    moveInDate: {
      type: Date,
      required: false,
    },
    emergencyContact: emergencyContactSchema,
    org: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Org',
      required: true,
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
    collection: 'clients',
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.deleted;
        return ret;
      },
    },
  }
);

clientSchema.index({ org: 1 });
clientSchema.index({ caregivers: 1 });
clientSchema.index({ org: 1, createdAt: -1 });

clientSchema.plugin(toJSON);
clientSchema.plugin(paginate);
clientSchema.plugin(mongooseDelete, { deletedAt: true });

clientSchema.statics.isEmailTaken = async function (email, excludeClientId) {
  const client = await this.findOne({ email, _id: { $ne: excludeClientId } });
  return !!client;
};

clientSchema.pre('validate', function (next) {
  if (this.isModified('name') && !this.isModified('firstName') && !this.isModified('lastName') && this.name) {
    const s = splitFullName(this.name);
    this.firstName = s.firstName;
    this.lastName = s.lastName;
  } else {
    const fn0 = this.firstName != null ? String(this.firstName).trim() : '';
    if (!fn0 && this.name) {
      const s = splitFullName(this.name);
      this.firstName = s.firstName;
      this.lastName = s.lastName;
    }
  }
  this.name = fullNameFromParts(
    this.firstName != null ? String(this.firstName).trim() : '',
    this.lastName != null ? String(this.lastName).trim() : ''
  );
  if (!this.name) {
    this.invalidate('name', 'First name and last name (or a full name) are required');
  }
  next();
});

clientSchema.pre('find', function () {
  this.where({ $or: [{ deleted: { $ne: true } }, { deleted: { $exists: false } }] });
});

clientSchema.pre('findOne', function () {
  this.where({ $or: [{ deleted: { $ne: true } }, { deleted: { $exists: false } }] });
});

const Client = mongoose.model('Client', clientSchema);
module.exports = Client;
