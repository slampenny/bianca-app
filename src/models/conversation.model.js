const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const messageSchema = mongoose.Schema({
  role: String,
  content: String,
});

// Conversation Schema
const conversationSchema = mongoose.Schema(
  {
    callSid: {
      type: String,
      index: true,
    },
    patientId: {
      type: mongoose.SchemaTypes.ObjectId,
      required: true,
      ref: 'Patient',
    },
    lineItemId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'LineItem',
      default: null, // Indicates that the conversation has not been billed yet
    },
    messages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
      },
    ],
    history: {
      type: String,
    },
    callType: {
      type: String,
      enum: ['inbound', 'wellness-check', 'follow-up'],
      default: 'inbound',
    },
    
    status: {
      type: String,
      enum: ['initiated', 'in-progress', 'completed', 'failed', 'machine'],
      default: 'initiated',
    },
    
    asteriskChannelId: {
      type: String,
      // For tracking the Asterisk side of the call
    },
    analyzedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Metadata such as speaker distinction
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    startTime: {
      type: Date,
      default: Date.now, // Defaults to the current time
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.pre('save', function (next) {
  if (this.startTime && this.endTime) {
    this.duration = (this.endTime.getTime() - this.startTime.getTime()) / 1000; // duration in seconds
  }
  next();
});

conversationSchema.statics.aggregateUnchargedConversations = async function (patientId) {
  return await this.aggregate([
    {
      $match: {
        patientId: mongoose.Types.ObjectId(patientId),
        lineItemId: null,
      },
    },
    {
      $group: {
        _id: '$patientId',
        totalDuration: { $sum: '$duration' },
        conversationIds: { $push: '$_id' },
      },
    },
    {
      $project: {
        patientId: '$_id',
        totalDuration: 1,
        conversationIds: 1,
        _id: 0,
      },
    },
  ]);
};

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
