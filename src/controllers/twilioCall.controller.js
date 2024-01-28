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

const handleRealTimeInteraction = catchAsync(async (req, res) => {
    const responseTwiML = await twilioCallService.handleRealTimeInteraction(req.body);
    res.type('text/xml').send(responseTwiML);
});

const processCallRecording = catchAsync(async (req, res) => {
    await twilioCallService.processCallRecording(req.body);
    res.status(httpStatus.OK).send({ message: 'Call recording processed successfully.' });
});

module.exports = {
    initiateCall,
    handleIncomingCall,
    handleRealTimeInteraction,
    processCallRecording
};
