// controllers/twilioCall.controller.js
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { twilioCallService } = require('../services');
const logger = require('../config/logger');

// Controller to initiate the call
const initiateCall = catchAsync(async (req, res) => {
  logger.info(`[Controller] Initiating call request received.`);
  const { patientId } = req.body;
  
  if (!patientId) {
    return res.status(httpStatus.BAD_REQUEST).send({ message: 'Patient ID is required' });
  }
  
  await twilioCallService.initiateCall(patientId);
  logger.info(`[Controller] Call initiation request processed for patientId: ${patientId}`);
  
  res.status(httpStatus.OK).json({ message: 'Call initiated successfully' });
});

// Controller to handle the initial TwiML request to connect to Asterisk
const handleStartCall = (req, res) => {
  logger.info(`[Controller] handleStartCall invoked. CallSid: ${req.body.CallSid}`);
  
  // This service function generates TwiML with <Dial><Sip> to connect to Asterisk
  const twiml = twilioCallService.generateCallTwiML(req);
  
  res.type('text/xml');
  res.send(twiml);
};

// Controller to handle the final status callback
const handleCallStatus = catchAsync(async (req, res) => {
  logger.info(`[Controller] Call-Status invoked. CallSid: ${req.body.CallSid}, Status: ${req.body.CallStatus}`);
  
  // Service function performs cleanup, summarization, etc.
  await twilioCallService.handleCallStatus(req);
  
  // Acknowledge Twilio's status callback with an empty TwiML response
  logger.info(`[Controller] Call-Status processing complete for CallSid: ${req.body.CallSid}. Sending ACK response.`);
  res.type('text/xml').send('<Response/>');
});

module.exports = {
  initiateCall,
  handleStartCall,
  handleCallStatus
};