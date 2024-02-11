const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const messageSchema = new mongoose.Schema({
  role: String,
  content: String,
});

// Conversation Schema
const conversationSchema = mongoose.Schema(
  {
    callSid: {
      type: String,
      index: true
    },
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'User'
    },
    messages: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    }],
    history: {
      type: String,
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

/**
 * @typedef Message
 */
const Message = mongoose.model('Message', messageSchema);

module.exports = { Message, Conversation };
