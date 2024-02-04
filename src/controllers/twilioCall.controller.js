const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { twilioCallService } = require('../services/twilioCall.service');

const initiateCall = catchAsync(async (req, res) => {
    const { userId } = req.body;
    await twilioCallService.initiateCall(userId);
    res.status(httpStatus.OK).json({ message: 'Call initiated successfully' });
});

// const handleIncomingCall = catchAsync(async (req, res) => {
//     const responseTwiML = await twilioCallService.handleIncomingCall(req.body);
//     res.type('text/xml').send(responseTwiML);
// });

const prepareCall = catchAsync(async () => {
    const responseTwiML = await twilioCallService.prepareCall();
    res.type('text/xml').send(responseTwiML);
});

const handleRealTimeInteraction = catchAsync(async (req, res) => {
    const { CallSid, SpeechResult } = req.body;
    const responseTwiML = await twilioCallService.handleRealTimeInteraction(CallSid, SpeechResult);
    res.type('text/xml').send(responseTwiML);
});

module.exports = {
    initiateCall,
    handleRealTimeInteraction,
    prepareCall
};
