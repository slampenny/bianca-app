const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { chatService, testService, twilioCallService } = require('../services');
const { Patient } = require('../models');
const twilioController = require('./twilioCall.controller');
const logger = require('../config/logger');


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
  const sid = await twilioCallService.initiateCall(patient.id);
  logger.info(`[Test] Call initiated, SID: ${sid}`);
  
  // wait briefly to ensure Twilio calls webhook
  setTimeout(() => {
    logger.info(`[Test] Call should be active now`);
    res.status(httpStatus.OK).send({ sid });
  }, 5000); // allow Twilio 5s to fetch TwiML and connect to stream
});


module.exports = {
  testCall,
  testChatWith,
  testSummarize,
  testCleanDB,
};