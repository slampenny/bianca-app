const mongoose = require('mongoose');

const emergencyPhraseSchema = new mongoose.Schema({
  phrase: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  language: {
    type: String,
    required: true,
    enum: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar', 'hi', 'zh-cn'],
    default: 'en',
    index: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM'],
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Medical', 'Safety', 'Physical', 'Request'],
    index: true
  },
  pattern: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Caregiver',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Caregiver',
    required: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  tags: [{
    type: String,
    trim: true
  }],
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
emergencyPhraseSchema.index({ language: 1, isActive: 1 });
emergencyPhraseSchema.index({ severity: 1, category: 1, isActive: 1 });
emergencyPhraseSchema.index({ createdBy: 1, language: 1 });

// Text index for phrase searching (removed due to language support limitations)
// emergencyPhraseSchema.index({ phrase: 'text', description: 'text' });

// Virtual for regex pattern compilation
emergencyPhraseSchema.virtual('compiledPattern').get(function() {
  try {
    return new RegExp(this.pattern, 'i');
  } catch (error) {
    console.error(`Invalid regex pattern for phrase ${this.phrase}: ${this.pattern}`, error);
    return null;
  }
});

// Method to increment usage count
emergencyPhraseSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Method to validate regex pattern
emergencyPhraseSchema.methods.validatePattern = function() {
  try {
    new RegExp(this.pattern, 'i');
    return { isValid: true, error: null };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
};

// Static method to get phrases by language and severity
emergencyPhraseSchema.statics.getPhrasesByLanguage = function(language, severity = null, category = null) {
  const query = { language, isActive: true };
  if (severity) query.severity = severity;
  if (category) query.category = category;
  
  return this.find(query).sort({ severity: 1, category: 1, phrase: 1 });
};

// Static method to get all active phrases for emergency detection
emergencyPhraseSchema.statics.getActivePhrases = function(language = 'en') {
  return this.find({ language, isActive: true }).sort({ severity: -1, category: 1 });
};

// Pre-save validation
emergencyPhraseSchema.pre('save', function(next) {
  // Validate regex pattern
  const validation = this.validatePattern();
  if (!validation.isValid) {
    return next(new Error(`Invalid regex pattern: ${validation.error}`));
  }
  
  next();
});

const EmergencyPhrase = mongoose.model('EmergencyPhrase', emergencyPhraseSchema);

module.exports = EmergencyPhrase;
