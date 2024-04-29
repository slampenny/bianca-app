const httpStatus = require('http-status');
const { Conversation, Message } = require('../models');
const ApiError = require('../utils/ApiError');

const createConversationForPatient = async (patientId) => {
  const conversation = new Conversation({ patientId });
  await conversation.save();
  return conversation;
};

const addMessageToConversation = async (conversationId, role, content) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  const message = new Message({ role, content });
  await message.save();

  conversation.messages.push(message._id);
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

const getConversationsByPatient = async (patientId) => {
  const conversations = await Conversation.find({ patientId });
  if (!conversations) {
    throw new ApiError(httpStatus.NOT_FOUND, `No conversation found for patient <${patientId}>`);
  }
  return conversations;
};

module.exports = {
  createConversationForPatient,
  addMessageToConversation,
  getConversationById,
  getConversationsByPatient,
};
