const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { twilioCallService } = require('../services/twilioCall.service');

const initiateCall = catchAsync(async (req, res) => {
    const { userId } = req.body;
    await twilioCallService.initiateCall(userId);
    res.status(httpStatus.OK).json({ message: 'Call initiated successfully' });
});

const handleIncomingCall = catchAsync(async (req, res) => {
    const responseTwiML = await twilioCallService.handleIncomingCall(req.body);
    res.type('text/xml').send(responseTwiML);
});

const prepareCallForTranscription = catchAsync(async (req, res) => {
    const responseTwiML = await twilioCallService.prepareCallForTranscription(req.body);
    res.type('text/xml').send(responseTwiML);
});

const handleRealTimeInteraction = catchAsync(async (req, res) => {
    const responseTwiML = await twilioCallService.handleRealTimeInteraction(req.body);
    res.type('text/xml').send(responseTwiML);
});

module.exports = {
    initiateCall,
    handleIncomingCall,
    handleRealTimeInteraction,
    prepareCallForTranscription
};
