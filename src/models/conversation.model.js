const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

// Conversation Schema
const conversationSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'User'
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    analyzedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Metadata such as speaker distinction
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
  }
);

// Plugins for JSON conversion and pagination
conversationSchema.plugin(toJSON);
conversationSchema.plugin(paginate);

/**
 * @typedef Conversation
 */
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
