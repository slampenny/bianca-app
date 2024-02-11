const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { chatService } = require('../services');

const testChatWith = catchAsync(async (req, res) => {
  const response = await chatService.chatWith(req.body);
  res.send(response);
});

const testSummarize = catchAsync(async (req, res) => {
  const { conversationId } = req.body;
  const response = await chatService.summarize(conversationId);
  res.send(response);
});

module.exports = {
  testChatWith,
  testSummarize,
};