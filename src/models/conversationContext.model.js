const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const conversationContextSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'User'
    },
    contextData: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true,
  }
);

conversationContextSchema.plugin(toJSON);
conversationContextSchema.plugin(paginate);

/**
 * @typedef ConversationContext
 */
const ConversationContext = mongoose.model('ConversationContext', conversationContextSchema);

module.exports = ConversationContext;
