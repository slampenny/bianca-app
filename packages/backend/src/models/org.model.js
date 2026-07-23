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
    avatar: {
      type: String,
      required: false,
      trim: true,
    },
    logo: {
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
      required: false, // Phone number will be set when user completes profile
      trim: true,
      lowercase: true,
      validate(value) {
        if (value && !validator.isMobilePhone(value)) {
          throw new Error('Invalid phone number');
        }
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // Stripe integration fields
    stripeCustomerId: {
      type: String,
      trim: true,
    },
    stripeSubscriptionId: {
      type: String,
      trim: true,
    },
    stripeSubscriptionItemId: {
      type: String,
      trim: true,
    },
    paymentMethods: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentMethod',
      },
    ],
    // Organization timezone (IANA timezone identifier, e.g., 'America/Los_Angeles', 'Europe/London')
    // Used for converting schedule times to/from UTC
    timezone: {
      type: String,
      default: 'America/Los_Angeles',
      trim: true,
    },
    // Organization country (ISO 3166-1 alpha-2 country code, e.g., 'US', 'CA')
    // Used for determining applicable privacy regulations (HIPAA, PIPEDA, etc.)
    country: {
      type: String,
      required: false,
      trim: true,
      uppercase: true,
      enum: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'CH', 'JP', 'CN', 'HK', 'SG', 'AE', 'IN', 'MX', 'BR', 'OTHER'],
      validate(value) {
        if (value && value.length !== 2 && value !== 'OTHER') {
          throw new Error('Country must be a 2-letter ISO code or "OTHER"');
        }
      },
    },
    // Call retry settings for the organization
    callRetrySettings: {
      retryCount: {
        type: Number,
        default: 2,
        min: [0, 'Retry count cannot be negative'],
        max: [10, 'Retry count cannot exceed 10'],
        validate: {
          validator: Number.isInteger,
          message: 'Retry count must be an integer',
        },
      },
      retryIntervalMinutes: {
        type: Number,
        default: 15,
        min: [1, 'Retry interval must be at least 1 minute'],
        max: [1440, 'Retry interval cannot exceed 1440 minutes (24 hours)'],
        validate: {
          validator: Number.isInteger,
          message: 'Retry interval must be an integer',
        },
      },
      alertOnAllMissedCalls: {
        type: Boolean,
        default: true,
      },
    },
    caregivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Caregiver' }],
    clients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Client' }],
    // Privacy Officer (PIPEDA/HIPAA requirement)
    // Defaults to org creator (first caregiver), but can be reassigned
    privacyOfficerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
      required: false,
    },
    // Require Client Consent for Recording
    // When enabled, organization must obtain explicit consent from clients before recording calls
    // Used in double-party consent jurisdictions (e.g., California, Florida)
    requireClientConsent: {
      type: Boolean,
      default: false,
    },
    // SCIM 2.0 provisioning (Bearer token + /v1/scim/orgs/:orgId/v2/...)
    scimEnabled: {
      type: Boolean,
      default: false,
    },
    scimBearerTokenHash: {
      type: String,
      required: false,
      select: false,
    },
    /** Last few characters of the current token (for admin UI only; token is never stored in plain text). */
    scimTokenHint: {
      type: String,
      required: false,
      trim: true,
    },
    /**
     * When true, full-call debug ulaw/PCM is written locally and, on hangup, uploaded to the S3 debug bucket.
     * Default false — super admins can enable per org in the admin portal. Set OPENAI_DEBUG_AUDIO=true in env to force for all calls (e.g. local dev).
     */
    debugAudioUploadEnabled: {
      type: Boolean,
      default: false,
    },
    /**
     * Per-org resident voice onboarding plan. When useDefault is true (default), the built-in Day 0–4 plan applies.
     * When useDefault is false, days[] defines the org-specific call sequence and questions.
     */
    voiceOnboarding: {
      useDefault: {
        type: Boolean,
        default: true,
      },
      days: [
        {
          dayNumber: { type: Number, min: 0 },
          theme: { type: String, trim: true },
          opening: { type: String, trim: true },
          questions: [
            {
              id: { type: String, required: true, trim: true },
              prompt: { type: String, required: true, trim: true },
              compressionPriority: { type: Boolean, default: false },
            },
          ],
        },
      ],
    },
    /**
     * Questions Bianca must ask on every wellness call (not voice onboarding sessions).
     * Org admins configure prompts; answers are captured from transcripts post-call.
     */
    requiredCallQuestions: {
      enabled: {
        type: Boolean,
        default: false,
      },
      questions: [
        {
          id: { type: String, required: true, trim: true },
          prompt: { type: String, required: true, trim: true },
        },
      ],
    },
    /** Facility family mobile app access (digest recipients invited as read-only app users). */
    familyPortalSettings: {
      enabled: {
        type: Boolean,
        default: false,
      },
      allowInviteAfterDigestVerify: {
        type: Boolean,
        default: true,
      },
    },
    /** Automated Daily Wellness Digest email scheduling (org-local send time). */
    dailyDigestSettings: {
      enabled: {
        type: Boolean,
        default: false,
      },
      /** Org-local HH:mm; null uses platform default from config. */
      sendTime: {
        type: String,
        trim: true,
        default: null,
        validate: {
          validator(v) {
            if (v == null || String(v).trim() === '') {
              return true;
            }
            const { isValidHHmm } = require('../utils/digestScheduler.utils');
            return isValidHHmm(v);
          },
          message: 'dailyDigestSettings.sendTime must be HH:mm (24-hour)',
        },
      },
    },
    /**
     * When true, this org may be wiped/reseeded via admin "refresh demo data".
     * Default false. Only settable through gated admin endpoints (never public PATCH).
     */
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** Last successful demo seed run (admin refresh). */
    demoSeededAt: {
      type: Date,
      required: false,
    },
    /** historyDays used on last demo seed. */
    demoHistoryDays: {
      type: Number,
      required: false,
      min: 1,
    },
    demoSeedVersion: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Plugin to convert mongoose to JSON, and paginate results
orgSchema.plugin(toJSON);
orgSchema.plugin(paginate);
orgSchema.plugin(mongooseDelete, { deletedAt: true });

orgSchema.pre('find', function () {
  this.where({ $or: [{ deleted: { $ne: true } }, { deleted: { $exists: false } }] });
});

orgSchema.pre('findOne', function () {
  this.where({ $or: [{ deleted: { $ne: true } }, { deleted: { $exists: false } }] });
});

// Static method to check if email is taken
orgSchema.statics.isEmailTaken = async function (email, excludeOrgId) {
  const org = await this.findOne({ email, _id: { $ne: excludeOrgId } });
  return !!org;
};

orgSchema.statics.createOrgAndCaregiver = async function (orgBody, caregiverBody) {
  if (await this.isEmailTaken(orgBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Org Email already taken');
  }

  const Caregiver = this.model('Caregiver');
  if (await Caregiver.isEmailTaken(caregiverBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Caregiver Email already taken');
  }
  
  // Create org first so we can assign it to caregiver at creation time
  // Set privacy officer to org creator (first caregiver) by default
  const org = await this.create({
    ...orgBody,
    caregivers: [], // Will add caregiver after creation
    privacyOfficerId: null // Will set after caregiver is created
  });

  // Create caregiver WITH org assigned from the start
  const caregiver = await Caregiver.create({
    ...caregiverBody,
    role: caregiverBody.role || 'orgAdmin',
    org: org._id // CRITICAL: Set org at creation time
  });

  // Update org with caregiver and privacy officer using findByIdAndUpdate.
  await this.findByIdAndUpdate(org._id, {
    $push: { caregivers: caregiver._id },
    $set: { privacyOfficerId: caregiver._id }
  });
  const updatedOrg = await this.findById(org._id);
  if (updatedOrg) return { org: updatedOrg, caregiver };
  org.caregivers = [caregiver._id];
  org.privacyOfficerId = caregiver._id;
  return { org, caregiver };
};

/**
 * @typedef Org
 */
const Org = mongoose.model('Org', orgSchema);

module.exports = Org;
