// controllers/twilioCall.controller.js
// Updated based on user's provided controller structure and Realtime API integration needs.

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync'); // Using user's async wrapper
const { twilioCallService } = require('../services'); // Using user's service name
const logger = require('../config/logger');
// const VoiceResponse = require('twilio').twiml.VoiceResponse; // Only needed if constructing complex TwiML here

// Controller to initiate the call
const initiateCall = catchAsync(async (req, res) => {
  logger.info(`[Controller] Initiating call request received.`);
  const { patientId } = req.body; // Assuming patientId comes from req.body
  if (!patientId) {
    // Added basic validation check
    return res.status(httpStatus.BAD_REQUEST).send({ message: 'Patient ID is required' });
  }
  // Assuming initiateCall now sets up the call for <Connect><Stream>
  // It might return callSid or handle errors internally
  await twilioCallService.initiateCall(patientId);
  logger.info(`[Controller] Call initiation request processed for patientId: ${patientId}`);
  // Aligning response with user's example
  res.status(httpStatus.OK).json({ message: 'Call initiated successfully' });
});

// **NEW:** Controller to handle the initial TwiML request for <Connect><Stream>
// This replaces the old 'prepareCall' logic for the main interaction flow.
const handleStartStream = (req, res) => {
  // IMPORTANT: Apply Twilio request validation middleware in the route definition!
  logger.info(`[Controller] handleStartStream invoked. CallSid: ${req.body.CallSid}`);
  // This service function should now generate TwiML with <Connect><Stream>
  const twiml = twilioCallService.generateStreamTwiML(req);
  res.type('text/xml');
  res.send(twiml);
};

// Controller to handle the final status callback
const handleEndCall = catchAsync(async (req, res) => {
  // IMPORTANT: Apply Twilio request validation middleware in the route definition!
  logger.info(`[Controller] endCall invoked. CallSid: ${req.body.CallSid}, Status: ${req.body.CallStatus}`);
  // Service function performs cleanup, summarization, etc.
  await twilioCallService.endCall(req);
  // Acknowledge Twilio's status callback with an empty TwiML response
  logger.info(`[Controller] endCall processing complete for CallSid: ${req.body.CallSid}. Sending ACK response.`);
  res.type('text/xml').send('<Response/>'); // Aligning response with user's example
});

// **OBSOLETE Controllers for Realtime API flow:**
// These handlers are part of the old <Gather> workflow and are replaced by
// handleStartStream and the WebSocket server logic.
/*
const prepareCall = catchAsync(async (req, res) => {
    logger.info(`[Controller] prepareCall invoked (OBSOLETE for stream). CallSid: ${req.body.CallSid || 'N/A - Initial'}`);
    const responseTwiML = await twilioCallService.prepareCall(req); // Old service logic
    res.type('text/xml').send(responseTwiML);
});

const handleRealTimeInteraction = catchAsync(async (req, res) => {
    logger.info(`[Controller] handleRealTimeInteraction invoked (OBSOLETE for stream). CallSid: ${req.body.CallSid}`);
    const responseTwiML = await twilioCallService.handleRealTimeInteraction(req); // Old service logic
    res.type('text/xml').send(responseTwiML);
});
*/

module.exports = {
  initiateCall,
  handleStartStream, // New handler for the streaming TwiML
  handleEndCall,
  // prepareCall, // Obsolete for stream flow
  // handleRealTimeInteraction, // Obsolete for stream flow
};
