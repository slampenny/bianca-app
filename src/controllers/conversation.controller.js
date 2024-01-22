const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { conversationService } = require('../services');

const storeConversation = catchAsync(async (req, res) => {
  const conversation = await conversationService.storeConversation(req.body);
  res.status(httpStatus.CREATED).send(conversation);
});

const getConversation = catchAsync(async (req, res) => {
  const conversation = await conversationService.getConversationById(req.params.conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  res.send(conversation);
});

module.exports = {
  storeConversation,
  getConversation,
};
