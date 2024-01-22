const httpStatus = require('http-status');
const { Conversation } = require('../models');
const ApiError = require('../utils/ApiError');

const storeConversation = async (conversationBody) => {
  const conversation = new Conversation(conversationBody);
  await conversation.save();
  return conversation;
};

const getConversationById = async (id) => {
  const conversation = await Conversation.findById(id);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  return conversation;
};

module.exports = {
  storeConversation,
  getConversationById,
};
