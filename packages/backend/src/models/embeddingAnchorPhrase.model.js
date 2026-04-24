const mongoose = require('mongoose');

const DETECTORS = [
  'emergencyDetector',
  'abuseNeglectDetector',
  'financialExploitationDetector',
  'relationshipPatternDetector',
];

const embeddingAnchorPhraseSchema = new mongoose.Schema(
  {
    detector: {
      type: String,
      required: true,
      enum: DETECTORS,
      index: true,
    },
    /** abuseNeglectDetector: physical | emotional | neglect; otherwise null */
    category: {
      type: String,
      default: null,
      index: true,
    },
    bucket: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    phrase: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /** Only for emergencyDetector (mirrors ANCHOR_TREE bucket metadata) */
    emergencySeverity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM'],
    },
    emergencyCategory: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

embeddingAnchorPhraseSchema.index(
  { detector: 1, category: 1, bucket: 1, phrase: 1 },
  { unique: true }
);

const EmbeddingAnchorPhrase = mongoose.model('EmbeddingAnchorPhrase', embeddingAnchorPhraseSchema);

module.exports = { EmbeddingAnchorPhrase, DETECTORS };
