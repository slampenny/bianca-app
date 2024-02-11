const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { twilioCallService } = require('../services');
const logger = require('../config/logger');

const initiateCall = catchAsync(async (req, res) => {
    const { userId } = req.body;
    await twilioCallService.initiateCall(userId);
    res.status(httpStatus.OK).json({ message: 'Call initiated successfully' });
});

const prepareCall = catchAsync(async (req, res) => {
    const responseTwiML = await twilioCallService.prepareCall();
    res.type('text/xml').send(responseTwiML);
});

const handleRealTimeInteraction = catchAsync(async (req, res) => {
    const { CallSid, SpeechResult } = req.body;
    logger.info(`CallSid: ${CallSid}, SpeechResult: ${SpeechResult}`);
    const responseTwiML = await twilioCallService.handleRealTimeInteraction(CallSid, SpeechResult);
    res.type('text/xml').send(responseTwiML);
});

const endCall = catchAsync(async (req, res) => {
    const { CallSid } = req.body;
    logger.info(`CallSid: ${CallSid}`);
    const responseTwiML = await twilioCallService.endCall(CallSid);
    res.type('text/xml').send(responseTwiML);
});

module.exports = {
    endCall,
    initiateCall,
    handleRealTimeInteraction,
    prepareCall
};
