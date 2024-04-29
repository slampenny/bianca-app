const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { twilioCallService } = require('../services');
const logger = require('../config/logger');

const initiateCall = catchAsync(async (req, res) => {
    const { patientId } = req.body;
    await twilioCallService.initiateCall(patientId);
    res.status(httpStatus.OK).json({ message: 'Call initiated successfully' });
});

const prepareCall = catchAsync(async (req, res) => {
    const responseTwiML = await twilioCallService.prepareCall(req);
    res.type('text/xml').send(responseTwiML);
});

const handleRealTimeInteraction = catchAsync(async (req, res) => {
    const { CallSid, SpeechResult, CallStatus } = req.body;
    logger.info(`CallSid: ${CallSid}, SpeechResult: ${SpeechResult}, CallStatus: ${CallStatus}`);
    const responseTwiML = await twilioCallService.handleRealTimeInteraction(CallSid, SpeechResult, CallStatus);
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
