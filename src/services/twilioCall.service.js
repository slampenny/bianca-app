const twilio = require('twilio');
const httpStatus = require('http-status');
const moment = require('moment');

const config = require('../config/config');
const logger = require('../config/logger');
const { Conversation, Message, Patient } = require('../models');
const ApiError = require('../utils/ApiError');
const { chatService, alertService } = require('.');

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
const { VoiceResponse } = twilio.twiml;

const initiateCall = async (patientId) => {
  logger.info(`[Twilio Service] Attempting to initiate call (Realtime) for patient ID: ${patientId}`);
  let patient;
  let conversation;

  try {
    patient = await Patient.findById(patientId);
    if (!patient || !patient.phone) {
      logger.error(`[Twilio Service] Patient not found or phone missing for ID: ${patientId}`);
      throw new ApiError(httpStatus.NOT_FOUND, 'Patient or phone number not found');
    }
    logger.info(`[Twilio Service] Found patient ${patient.name} with phone ${patient.phone}`);

    const initialTwiMLUrl = `${config.twilio.apiUrl}/v1/twilio/start-stream/${patientId}`;
    const statusCallbackUrl = `${config.twilio.apiUrl}/v1/twilio/end-call`;
    logger.info(`[Twilio Service] TwiML URL for call start: ${initialTwiMLUrl}`);
    logger.info(`[Twilio Service] Status Callback URL: ${statusCallbackUrl}`);

    const call = await twilioClient.calls.create({
      url: initialTwiMLUrl,
      to: patient.phone,
      from: config.twilio.phone,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      record: true,
      answerOnBridge: true,
    });
    logger.info(`[Twilio Service] Call initiated with SID: ${call.sid} for patient ID: ${patientId}`);

    conversation = new Conversation({
      callSid: call.sid,
      patientId: patient._id,
      startTime: new Date(),
      history: null,
    });
    await conversation.save();
    logger.info(`[Twilio Service] Conversation record created in DB for call SID: ${call.sid}`);

    return call.sid;
  } catch (error) {
    logger.error(`[Twilio Service] Error initiating call for patient ID ${patientId}:`, error);
    if (conversation && conversation._id) {
      logger.warn(
        `[Twilio Service] Attempting to clean up conversation record ${conversation._id} due to call initiation error.`
      );
      await Conversation.findByIdAndDelete(conversation._id).catch((delErr) =>
        logger.error(`[Twilio Service] Failed to clean up conversation record ${conversation._id}:`, delErr)
      );
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to initiate call: ${error.message}`);
  }
};

const generateStreamTwiML = (req) => {
  const { CallSid } = req.body;
  logger.info(`[Twilio Service] Generating <Connect><Stream> TwiML for CallSid: ${CallSid}`);
  const twiml = new VoiceResponse();

  try {
    const webSocketUrl = `${config.twilio.websocketUrl}/twiliostream/${CallSid}`;
    logger.info(`[Twilio Service] WebSocket Stream URL: ${webSocketUrl}`);

    twiml.say('This is Bianca. Please hold while we connect you to your assistant.');
    const connect = twiml.connect();
    connect.stream({
      url: webSocketUrl,
      track: 'both_tracks',
    });

    // twiml.pause({ length: 60 });

    logger.info(`[Twilio Service] Generated <Connect><Stream> TwiML for ${CallSid}.`);

    const twimlString = twiml.toString();
    logger.info(`[Twilio Service] TwiML being sent to Twilio: ${twimlString}`);
    return twimlString;
  } catch (error) {
    logger.error(`[Twilio Service] Error generating <Connect><Stream> TwiML for ${CallSid}:`, error);
    const errorTwiml = new VoiceResponse();
    errorTwiml.say('Sorry, there was an error connecting to the service. Please hang up.');
    errorTwiml.hangup();
    return errorTwiml.toString();
  }
};

const endCall = async (req) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  logger.info(`[Twilio Service] In endCall for CallSid: ${CallSid} with Status: ${CallStatus}, Duration: ${CallDuration}s`);

  // Only process completed or failed calls
  if (!['completed', 'failed', 'busy', 'no-answer'].includes(CallStatus)) {
    logger.info(`[Twilio Service] Call ${CallSid} status update: ${CallStatus} (not terminal state, skipping processing)`);
    return;
  }

  let conversation;
  try {
    conversation = await Conversation.findOne({ callSid: CallSid }).populate('messages').populate('patientId');

    if (!conversation) {
      logger.error(`[Twilio Service] endCall: No conversation found for CallSid: ${CallSid}. Cannot process further.`);
      return;
    }

    conversation.endTime = new Date();
    conversation.duration = parseInt(CallDuration, 10) || 0;

    const patient = conversation.patientId;
    const patientName = patient ? patient.name : 'Unknown Patient';
    const patientDbId = patient ? patient.id : null;

    switch (CallStatus) {
      case 'completed':
        logger.info(`[Twilio Service] Call ${CallSid} completed. Attempting summarization.`);
        try {
          conversation.history = await chatService.summarize(conversation);
          logger.info(`[Twilio Service] Summarization successful for CallSid: ${CallSid}`);
        } catch (summaryError) {
          logger.error(`[Twilio Service] Failed to summarize conversation for CallSid: ${CallSid}:`, summaryError);
          conversation.history = 'Error during summarization.';
        }
        break;

      case 'no-answer':
      case 'busy':
      case 'failed':
        logger.warn(`[Twilio Service] Call ${CallSid} ended with status: ${CallStatus} for ${patientName}`);
        if (patientDbId) {
          try {
            await alertService.createAlert({});
            logger.info(`[Twilio Service] '${CallStatus}' alert created for patient ${patientName} (${CallSid})`);
          } catch (alertError) {
            logger.error(`[Twilio Service] Failed to create '${CallStatus}' alert...`, alertError);
          }
        }
        break;

      default:
        logger.warn(`[Twilio Service] Call ${CallSid} ended with unhandled status: ${CallStatus}`);
    }

    await conversation.save();
    logger.info(`[Twilio Service] Final conversation state saved for CallSid: ${CallSid}`);
  } catch (error) {
    logger.error(`[Twilio Service] Error in endCall handler for CallSid: ${CallSid}:`, error);
  }
};

module.exports = {
  initiateCall,
  generateStreamTwiML,
  endCall,
};
