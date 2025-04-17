const twilio = require('twilio');
const httpStatus = require('http-status');
const moment = require('moment'); // Assuming still used for alert relevance

const config = require('../config/config'); // Assume paths are correct
const logger = require('../config/logger'); // Your logger instance
const { Conversation, Message, Patient } = require('../models'); // Your Mongoose models
const ApiError = require('../utils/ApiError'); // Your custom error class
const { chatService, alertService } = require('.'); // Your other services

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Initiates an outbound call to a patient.
 * @param {string} patientId - The ID of the patient to call.
 * @returns {Promise<string>} - The Twilio Call SID.
 * @throws {ApiError} - If patient not found or other errors occur during initiation.
 */
const initiateCall = async (patientId) => {
  logger.info(`[Twilio Service] Attempting to initiate call for patient ID: ${patientId}`);
  let patient;
  let conversation;

  try {
    // 1. Find Patient
    patient = await Patient.findById(patientId);
    if (!patient || !patient.phone) {
      logger.error(`[Twilio Service] Patient not found or phone number missing for ID: ${patientId}`);
      throw new ApiError(httpStatus.NOT_FOUND, 'Patient or phone number not found');
    }
    logger.info(`[Twilio Service] Found patient ${patient.name} with phone ${patient.phone}`);

    // 2. Prepare Call URL and Status Callback
    const initialUrl = `${config.twilio.apiUrl}/v1/twilio/prepare-call?initial=true`;
    const statusCallbackUrl = `${config.twilio.apiUrl}/v1/twilio/end-call`;
    logger.info(`[Twilio Service] Call URL: ${initialUrl}`);
    logger.info(`[Twilio Service] Status Callback URL: ${statusCallbackUrl}`);

    // 3. Create Twilio Call
    const call = await twilioClient.calls.create({
      url: initialUrl, // Twilio fetches this TwiML when call connects
      to: patient.phone,
      from: config.twilio.phone,
      statusCallback: statusCallbackUrl, // Webhook for final call status
      statusCallbackEvent: ['completed', 'failed', 'busy', 'no-answer'], // Listen for all terminal events
      statusCallbackMethod: 'POST',
    });
    logger.info(`[Twilio Service] Call initiated with SID: ${call.sid} for patient ID: ${patientId}`);

    // 4. Create Conversation Record in DB
    // Decide on history: Start fresh unless specific need to copy old summary.
    // const previousConversation = await Conversation.find({ patientId: patientId }).sort({ createdAt: -1 }).limit(1);
    conversation = new Conversation({
      callSid: call.sid,
      patientId: patient._id,
      startTime: new Date(),
      // history: previousConversation.length > 0 ? previousConversation[0].history : null // Option to copy history
      history: null, // Start with no prior history in this specific conversation record
    });
    await conversation.save();
    logger.info(`[Twilio Service] Conversation record created in DB for call SID: ${call.sid}`);

    return call.sid;

  } catch (error) {
    logger.error(`[Twilio Service] Error initiating call for patient ID ${patientId}:`, error);
    // Clean up potentially created conversation if call creation failed after DB save (optional)
    if (error.name !== 'ApiError' && conversation && conversation._id) {
       logger.warn(`[Twilio Service] Attempting to clean up conversation record ${conversation._id} due to call initiation error.`);
       await Conversation.findByIdAndDelete(conversation._id).catch(delErr => logger.error(`[Twilio Service] Failed to clean up conversation record ${conversation._id}:`, delErr));
    }
    // Rethrow as ApiError or handle as needed for the calling function
    if (error instanceof ApiError) {
       throw error;
    } else {
       throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to initiate call: ${error.message}`);
    }
  }
};

/**
 * Generates TwiML to prepare the call (greet/gather).
 * Triggered by Twilio when the call connects or when redirected.
 * @param {object} req - The incoming request object (needed for query params).
 * @returns {string} - The TwiML response string.
 */
const prepareCall = (req) => {
  // !!! IMPORTANT: Webhook validation MUST happen in your router before calling this function !!!
  // Example: router.post('/prepare-call', twilio.validateExpressRequest(options), twilioController.handlePrepareCall);
  logger.info(`[Twilio Service] In prepareCall for request: ${req.originalUrl}`);
  const isInitial = req.query.initial === 'true';
  const twiml = new VoiceResponse();

  try {
    if (isInitial) {
      logger.info('[Twilio Service] prepareCall: Initial call, adding greeting.');
      // Customize greeting as needed
      twiml.say('Hello, this is Bianca calling from your care team. How can I help you today?');
    } else {
      logger.info('[Twilio Service] prepareCall: Subsequent turn, gathering input.');
      // Optionally add a prompt for subsequent turns, e.g., twiml.say("Anything else?");
    }

    twiml.gather({
      input: 'speech dtmf', // Accept both speech and key presses (DTMF)
      numDigits: 1, // If expecting single digit DTMF like '1'
      timeout: 5, // Seconds to wait for input
      speechTimeout: 'auto', // Let Twilio manage speech end detection
      speechModel: 'experimental_conversations',
      action: `${config.twilio.apiUrl}/v1/twilio/real-time-interaction`, // Endpoint to process input
      actionOnEmptyResult: true, // Ensure action is called even on timeout
    });

    // If gather times out or has no input, Twilio will still call the action URL.
    // If you want different behavior (like repeating the prompt), add it after gather.
    // twiml.say("I didn't hear anything. Please tell me how I can help.");
    // twiml.redirect(`${config.twilio.apiUrl}/v1/twilio/prepare-call`); // Redirect back to regather

    const twimlString = twiml.toString();
    logger.info('[Twilio Service] prepareCall: Generated TwiML.');
    // logger.debug('[Twilio Service] prepareCall: TwiML:', twimlString); // Optional: Log full TwiML for debugging
    return twimlString;

  } catch (error) {
      logger.error('[Twilio Service] Error generating TwiML in prepareCall:', error);
      // Fallback TwiML in case of error during generation
      const errorTwiml = new VoiceResponse();
      errorTwiml.say('Sorry, there was an error preparing the call. Please hang up and try again later.');
      errorTwiml.hangup();
      return errorTwiml.toString();
  }
};

/**
 * Handles the real-time interaction input from the user (Speech or DTMF).
 * Triggered by the <Gather> action.
 * @param {object} req - The incoming request object from Twilio.
 * @returns {Promise<string>} - The TwiML response string.
 */
const handleRealTimeInteraction = async (req) => {
  // !!! IMPORTANT: Webhook validation MUST happen in your router before calling this function !!!
  const { CallSid, SpeechResult, Digits, CallStatus } = req.body;
  logger.info(`[Twilio Service] In handleRealTimeInteraction for CallSid: ${CallSid}`);
  logger.info(`[Twilio Service] Received - SpeechResult: '${SpeechResult}', Digits: '${Digits}', CallStatus: ${CallStatus}`);

  let conversation;
  const twiml = new VoiceResponse();

  try {
    // 1. Find the corresponding conversation
    conversation = await Conversation.findOne({ callSid: CallSid });
    if (!conversation) {
      // This shouldn't happen if initiateCall succeeded, but handle defensively.
      logger.error(`[Twilio Service] No conversation found for CallSid: ${CallSid}. Hanging up.`);
      twiml.say('Sorry, I encountered an issue retrieving our conversation. Please call back later.');
      twiml.hangup();
      return twiml.toString();
    }
    logger.info(`[Twilio Service] Found conversation record for CallSid: ${CallSid}`);
    await conversation.populate('patientId'); // Get patient details if needed

    // 2. Check for input (Speech or Digits) vs. Timeout
    const userInput = SpeechResult || Digits;

    if (!userInput) {
      // Timeout or empty input based on actionOnEmptyResult: true
      logger.warn(`[Twilio Service] No speech or digit input received (timeout) for CallSid: ${CallSid}.`);
      // Decide action: Repeat prompt, ask differently, or hang up?
      // Example: Hang up after one timeout
      twiml.say("I didn't receive a response. Goodbye.");
      twiml.hangup();
      // Example: Retry prompt
      // twiml.say("Sorry, I didn't catch that. Could you please repeat?");
      // twiml.redirect(`${config.twilio.apiUrl}/v1/twilio/prepare-call`);
      return twiml.toString();
    }

    logger.info(`[Twilio Service] User input received: '${userInput}'`);

    // 3. Save User Message
    const patientMessage = new Message({
      role: 'patient',
      // Store digits as content too, or handle differently if needed
      content: userInput,
      conversationId: conversation._id
    });
    await patientMessage.save();
    conversation.messages.push(patientMessage._id);
    await conversation.save(); // Save message reference immediately
    logger.info(`[Twilio Service] Saved patient message to DB for CallSid: ${CallSid}`);

    // 4. Process input with Chat Service
    logger.info(`[Twilio Service] Sending input to chatService for CallSid: ${CallSid}`);
    // Refresh conversation with latest message for context
    await conversation.populate('messages');
    const chatGptResponse = await chatService.chatWith(conversation); // Assuming chatService handles context
    logger.info(`[Twilio Service] Received response from chatService for CallSid: ${CallSid}`);

    // 5. Save Assistant Message
    const assistantMessage = new Message({
      role: 'assistant',
      content: chatGptResponse,
      conversationId: conversation._id
    });
    await assistantMessage.save();
    conversation.messages.push(assistantMessage._id);
    await conversation.save(); // Save message reference
    logger.info(`[Twilio Service] Saved assistant message to DB for CallSid: ${CallSid}`);

    // 6. Convert Assistant Response to Speech
    logger.info(`[Twilio Service] Converting assistant response to speech for CallSid: ${CallSid}`);
    const speechUrl = await chatService.textToSpeech(CallSid, chatGptResponse); // Ensure this handles potential errors
    logger.info(`[Twilio Service] Generated speech URL: ${speechUrl} for CallSid: ${CallSid}`);

    // 7. Prepare TwiML for Response and Next Turn
    twiml.play(speechUrl); // Play the generated audio
    // Redirect back to prepareCall to gather the next input (without initial greeting)
    twiml.redirect(`${config.twilio.apiUrl}/v1/twilio/prepare-call`);
    logger.info(`[Twilio Service] Prepared TwiML response with speech and redirect for CallSid: ${CallSid}`);

    return twiml.toString();

  } catch (error) {
    // Log the detailed error
    logger.error(`[Twilio Service] Error during real-time interaction for CallSid: ${CallSid}:`, error);

    // Provide a fallback response to the user
    const errorTwiml = new VoiceResponse();
    errorTwiml.say('I apologize, but I encountered an internal error and cannot continue. Please try calling back later. Goodbye.');
    errorTwiml.hangup();
    return errorTwiml.toString();
  }
};

/**
 * Handles the end of the call (triggered by statusCallback).
 * Performs cleanup, summarization, and alerting based on final status.
 * @param {object} req - The incoming request object from Twilio.
 * @returns {Promise<void>} - Returns nothing (sends 200 OK implicitly via framework).
 */
const endCall = async (req) => {
  // !!! IMPORTANT: Webhook validation MUST happen in your router before calling this function !!!
  const { CallSid, CallStatus, CallDuration } = req.body;
  logger.info(`[Twilio Service] In endCall for CallSid: ${CallSid} with Status: ${CallStatus}, Duration: ${CallDuration}s`);

  let conversation;
  try {
    // 1. Find Conversation
    // Populate messages if needed for summarization, patientId for alerts
    conversation = await Conversation.findOne({ callSid: CallSid }).populate('messages').populate('patientId');

    if (!conversation) {
      logger.error(`[Twilio Service] endCall: No conversation found for CallSid: ${CallSid}. Cannot process further.`);
      // Cannot do much else here, maybe log to an error monitoring service
      return; // Exit gracefully
    }

    // 2. Update Conversation End Time
    conversation.endTime = new Date();
    conversation.duration = parseInt(CallDuration, 10) || 0; // Store duration

    // 3. Handle actions based on final CallStatus
    const patient = conversation.patientId; // Populated patient document
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
          // Decide if you want to save conversation without summary or mark error
          conversation.history = "Error during summarization.";
        }
        // Optional: Alert on successful completion?
        // await alertService.createAlert({ message: `Call with ${patientName} completed successfully.` ... });
        break;

      case 'no-answer':
        logger.warn(`[Twilio Service] Call ${CallSid} was not answered by ${patientName}.`);
        if (patientDbId) {
          try {
             await alertService.createAlert({
               message: `Patient ${patientName} didn't answer the call (${CallSid})`,
               importance: 'medium',
               createdBy: patientDbId,
               createdModel: 'Patient',
               visibility: 'assignedCaregivers', // Adjust visibility as needed
               relevanceUntil: moment().add(2, 'days').toISOString(), // Shorter relevance?
             });
             logger.info(`[Twilio Service] 'no-answer' alert created for patient ${patientName} (${CallSid})`);
          } catch (alertError) {
              logger.error(`[Twilio Service] Failed to create 'no-answer' alert for patient ${patientName} (${CallSid}):`, alertError);
          }
        }
        break;

      case 'failed':
        logger.error(`[Twilio Service] Call ${CallSid} failed. Status: ${CallStatus}.`);
         if (patientDbId) {
            try {
                await alertService.createAlert({
                    message: `Call to ${patientName} failed (${CallSid}). Reason: ${req.body.SipResponseCode || 'Unknown'}`, // Check Twilio docs for failure reasons
                    importance: 'high',
                    createdBy: patientDbId,
                    createdModel: 'Patient',
                    visibility: 'assignedCaregivers',
                    relevanceUntil: moment().add(1, 'day').toISOString(),
                });
                logger.info(`[Twilio Service] 'failed' alert created for patient ${patientName} (${CallSid})`);
            } catch (alertError) {
                logger.error(`[Twilio Service] Failed to create 'failed' alert for patient ${patientName} (${CallSid}):`, alertError);
            }
         }
        break;

      case 'busy':
        logger.warn(`[Twilio Service] Call ${CallSid} received busy signal from ${patientName}.`);
         if (patientDbId) {
            try {
                await alertService.createAlert({
                    message: `Patient ${patientName}'s line was busy during call (${CallSid})`,
                    importance: 'low',
                    createdBy: patientDbId,
                    createdModel: 'Patient',
                    visibility: 'assignedCaregivers',
                    relevanceUntil: moment().add(1, 'day').toISOString(),
                });
                logger.info(`[Twilio Service] 'busy' alert created for patient ${patientName} (${CallSid})`);
            } catch (alertError) {
                logger.error(`[Twilio Service] Failed to create 'busy' alert for patient ${patientName} (${CallSid}):`, alertError);
            }
         }
        break;

      default:
        logger.warn(`[Twilio Service] Call ${CallSid} ended with unhandled status: ${CallStatus}`);
    }

    // 4. Save Final Conversation State
    await conversation.save();
    logger.info(`[Twilio Service] Final conversation state saved for CallSid: ${CallSid}`);

  } catch (error) {
    logger.error(`[Twilio Service] Error in endCall handler for CallSid: ${CallSid}:`, error);
    // Cannot send TwiML here, just log the error. Consider sending to error tracking service.
  } finally {
    // 5. Perform Cleanup (e.g., delete temporary TTS files) - Attempt even if errors occurred above
    try {
      logger.info(`[Twilio Service] Attempting cleanup for CallSid: ${CallSid}`);
      await chatService.cleanup(CallSid); // Ensure cleanup is idempotent and handles non-existent resources gracefully
      logger.info(`[Twilio Service] Cleanup successful for CallSid: ${CallSid}`);
    } catch (cleanupError) {
      logger.error(`[Twilio Service] Error during cleanup for CallSid: ${CallSid}:`, cleanupError);
    }
  }
  // Twilio expects a 200 OK response to the statusCallback.
  // In frameworks like Express, returning successfully from the handler usually does this.
  // If not using a framework, ensure you send `res.status(200).send();` or similar.
};

module.exports = {
  initiateCall,
  prepareCall, // This function needs the `req` object
  handleRealTimeInteraction, // This function needs the `req` object
  endCall, // This function needs the `req` object
};