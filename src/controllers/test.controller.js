const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { chatService, testService, twilioCallService } = require('../services');
const { Patient } = require('../models');
const twilioController = require('./twilioCall.controller');

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

const testCall = catchAsync(async (req, res) => {
  const patient = await Patient.findOne().sort({ createdAt: 1 }).exec();
  await twilioCallService.initiateCall(patient.id);
  res.status(httpStatus.OK).send();
});

module.exports = {
  testCall,
  testChatWith,
  testSummarize,
  testCleanDB,
};