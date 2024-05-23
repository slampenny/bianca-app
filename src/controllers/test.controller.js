const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { chatService, testService } = require('../services');

const testChatWith = catchAsync(async (req, res) => {
  const response = await chatService.chatWith(req.body);
  res.send(response);
});

const testSummarize = catchAsync(async (req, res) => {
  const { conversationId } = req.body;
  const response = await chatService.summarize(conversationId);
  res.send(response);
});

const testCleanDB = catchAsync(async (req, res) => {
  await testService.cleanDB();
  res.status(httpStatus.OK).send();
});

module.exports = {
  testChatWith,
  testSummarize,
  testCleanDB,
};