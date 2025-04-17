// ../controllers/twilioCall.controller.js
const httpStatus = require('http-status');
// const ApiError = require('../utils/ApiError'); // Keep if used by catchAsync or error handler
const catchAsync = require('../utils/catchAsync');
const { twilioCallService } = require('../services');
const logger = require('../config/logger');
const VoiceResponse = require('twilio').twiml.VoiceResponse; // Needed for fallback error

const initiateCall = catchAsync(async (req, res) => {
    logger.info(`[Controller] Initiating call request received.`);
    const { patientId } = req.body;
    // Assuming initiateCall throws ApiError on failure which catchAsync handles
    await twilioCallService.initiateCall(patientId);
    logger.info(`[Controller] Call initiation successful for patientId: ${patientId}`);
    res.status(httpStatus.OK).json({ message: 'Call initiated successfully' });
});

const prepareCall = catchAsync(async (req, res) => {
    // Log entry, service function has more detail
    logger.info(`[Controller] prepareCall invoked. CallSid: ${req.body.CallSid || 'N/A - Initial'}`);
    const responseTwiML = await twilioCallService.prepareCall(req);
    res.type('text/xml').send(responseTwiML);
});

const handleRealTimeInteraction = catchAsync(async (req, res) => {
    // Log entry, service function has more detail
    logger.info(`[Controller] handleRealTimeInteraction invoked. CallSid: ${req.body.CallSid}`);
    // --- FIX: Pass the entire req object ---
    const responseTwiML = await twilioCallService.handleRealTimeInteraction(req);
    res.type('text/xml').send(responseTwiML);
});

const endCall = catchAsync(async (req, res) => {
    // Log entry, service function has more detail
    logger.info(`[Controller] endCall invoked. CallSid: ${req.body.CallSid}, Status: ${req.body.CallStatus}`);
    // --- FIX: Pass the entire req object ---
    await twilioCallService.endCall(req);
    // --- FIX: Send empty TwiML response to acknowledge Twilio's status callback ---
    logger.info(`[Controller] endCall processing complete for CallSid: ${req.body.CallSid}. Sending ACK response.`);
    res.type('text/xml').send('<Response/>');
});

module.exports = {
    endCall,
    initiateCall,
    handleRealTimeInteraction,
    prepareCall
};

// Ensure your global error handler (used by catchAsync) also handles errors gracefully.
// For Twilio webhooks, it might need to send a TwiML <Say> error message + <Hangup/>
// Example snippet for error handler:
/*
const errorHandler = (err, req, res, next) => {
  logger.error(err);

  // Check if the request path likely expects TwiML
  const isTwilioWebhook = req.originalUrl.includes('/twilio/'); // Adjust check as needed

  if (isTwilioWebhook && !res.headersSent) {
    const twiml = new VoiceResponse();
    twiml.say('An unexpected application error occurred. Please try again later. Goodbye.');
    twiml.hangup();
    res.status(500).type('text/xml').send(twiml.toString());
  } else if (!res.headersSent) {
    // Default JSON error response
    res.status(err.statusCode || 500).send({
      code: err.statusCode || 500,
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  } else {
      // If headers already sent, delegate to default Express handler
      next(err);
  }
};
*/