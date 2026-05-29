/**
 * Twilio implementation of the voice telephony port (outbound calls, TwiML, status webhooks).
 * @see ../voiceTelephony.service.js
 */
const twilio = require('twilio');
const httpStatus = require('http-status');
const config = require('../../../config/config');
const logger = require('../../../config/logger');
const { Client } = require('../../../models');
const ApiError = require('../../../utils/ApiError');
const {
  getStartCallWebhookUrl,
  getCallStatusWebhookUrl,
} = require('../telephony.webhooks');
const {
  calculateCallCost,
  updateCallStatus,
  createOutboundCallRecord,
  handleNormalizedCallStatus,
  scheduleRetryCall,
} = require('../voiceCallStatus.handler');

// Create Twilio client (will be validated before use)
let twilioClient;
try {
  // Only create client if credentials are available
  if (config.twilio?.accountSid && config.twilio?.authToken) {
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
    logger.info('[Twilio Service] Twilio client initialized');
  } else {
    logger.warn('[Twilio Service] Twilio credentials not available at startup - client will be created on first use');
  }
} catch (error) {
  logger.error(`[Twilio Service] Failed to initialize Twilio client: ${error.message}`);
}

const { VoiceResponse } = twilio.twiml;

class TwilioVoiceProvider {
  /**
   * Initiate an outbound call to a client
   * @param {string} clientId - Database ID of the client
   * @returns {Promise<string>} - The call SID
   */
  async initiateCall(clientId) {
    logger.info(`[Twilio Service] Initiating call for client ID: ${clientId}`);
    let client;
    let conversation;

    try {
      client = await Client.findById(clientId);
      if (!client || !client.phone) {
        logger.error(`[Twilio Service] Client not found or phone missing for ID: ${clientId}`);
        throw new ApiError(httpStatus.NOT_FOUND, 'Client or phone number not found');
      }
      logger.info(`[Twilio Service] Found client ${client.name} with phone ${client.phone}`);

      const initialTwiMLUrl = getStartCallWebhookUrl(clientId);
      const statusCallbackUrl = getCallStatusWebhookUrl();
      
      logger.info(`[Twilio Service] Using TwiML URL: ${initialTwiMLUrl}`);
      logger.info(`[Twilio Service] Using callback URL: ${statusCallbackUrl}`);

      // Validate Twilio configuration before making API call
      if (!config.twilio.accountSid || !config.twilio.authToken) {
        logger.error(`[Twilio Service] Missing Twilio credentials - accountSid: ${!!config.twilio.accountSid}, authToken: ${!!config.twilio.authToken}`);
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Twilio credentials not configured');
      }
      
      if (!config.twilio.phone) {
        logger.error(`[Twilio Service] Missing Twilio phone number`);
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Twilio phone number not configured');
      }

      // Ensure Twilio client is initialized
      if (!twilioClient) {
        logger.info('[Twilio Service] Initializing Twilio client');
        twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
      }

      // Create call with Twilio
      // Only record calls in staging/dev, not in production
      const callOptions = {
        url: initialTwiMLUrl,
        to: client.phone,
        from: config.twilio.phone,
        statusCallback: statusCallbackUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        // answerOnBridge: true, // REMOVED: This was causing initial audio cutoff
        machineDetection: 'DetectMessageEnd', // Detect answering machines
        machineDetectionTimeout: 5000, // Wait up to 5s (milliseconds) for detection
        asyncAmd: true, // Continue AMD in background; don't delay handoff
        asyncAmdStatusCallback: statusCallbackUrl,
        asyncAmdStatusCallbackMethod: 'POST',
        timeout: 30 // Ring for 30 seconds before giving up
      };
      
      const clientService = require('../../client.service');
      const hasConsent = await clientService.checkClientConsent(clientId);
      if (config.twilio.recordCalls && hasConsent) {
        callOptions.record = true;
        logger.info(`[Twilio Service] Call recording enabled for ${config.env} environment (client has consented)`);
      } else if (config.twilio.recordCalls && !hasConsent) {
        logger.warn(`[Twilio Service] Call recording disabled: client ${clientId} has not consented to recording`);
      } else {
        logger.info(`[Twilio Service] Call recording disabled for ${config.env} environment`);
      }
      
      let call;
      try {
        call = await twilioClient.calls.create(callOptions);
      } catch (twilioError) {
        // Log full Twilio error details
        logger.error(`[Twilio Service] Twilio API error: ${twilioError.message}`);
        logger.error(`[Twilio Service] Twilio error code: ${twilioError.code}`);
        logger.error(`[Twilio Service] Twilio error status: ${twilioError.status}`);
        logger.error(`[Twilio Service] Twilio error details: ${JSON.stringify(twilioError, null, 2)}`);
        
        // Provide more helpful error messages
        if (twilioError.code === 20003 || twilioError.status === 401) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'Twilio authentication failed. Please check your Twilio credentials.');
        } else         if (twilioError.code === 21211) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Invalid phone number format: ${client.phone}`);
        } else if (twilioError.code === 21212) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Invalid caller ID: ${config.twilio.phone}`);
        } else {
          throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Twilio API error: ${twilioError.message || 'Unknown error'}`);
        }
      }
      
      logger.info(`[Twilio Service] Call initiated with SID: ${call.sid}`);

      await createOutboundCallRecord(client, clientId, call.sid, '[Twilio Service]');

      return call.sid;
    } catch (error) {
      logger.error(`[Twilio Service] Error initiating call: ${error.message}`);
      logger.error(`[Twilio Service] Error stack: ${error.stack}`);
      
      // Clean up call record if created but call failed
      // Note: We don't need to clean up - failed calls should still be recorded
      
      // Re-throw appropriate error (ApiError instances already have proper status codes)
      if (error instanceof ApiError) throw error;
      
      // For unexpected errors, provide more context
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR, 
        `Failed to initiate call: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Generate answer markup (TwiML) for connecting to Asterisk SIP server
   * @param {Object} req - Express request object
   * @returns {string} - TwiML markup
   */
  generateAnswerMarkup(req) {
    const { CallSid, AnsweredBy } = req.body;
    const clientId = req.params.clientId;
    
    logger.info(`[Twilio Service] Generating Asterisk SIP TwiML for CallSid: ${CallSid}, AnsweredBy: ${AnsweredBy || 'null'}, ClientId: ${clientId}`);
    
    // DEBUG: Log full request body to see all Twilio parameters
    logger.info(`[Twilio Service] Full TwiML request body:`, JSON.stringify(req.body, null, 2));
    
    const twiml = new VoiceResponse();
    
    try {
      // Customize greeting based on answering machine detection
      if (AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end' || AnsweredBy === 'machine_end_beep' || AnsweredBy === 'machine_end_silence') {
        // Leave a message on answering machine
        twiml.say({
          voice: 'alice',
          language: 'en-US'
        }, "Hello, this is a wellness check from your care team. " +
           "We're calling to check on you. " +
           "Please call us back at your convenience. " +
           "Thank you and have a good day.");
        
        twiml.hangup();
        logger.info(`[Twilio Service] Generated answering machine message for ${CallSid} (${AnsweredBy})`);
        
        // Update call record
        this.updateCallStatus(CallSid, 'machine');
        
        return twiml.toString();
      }

      // For human answer, connect to Asterisk SIP endpoint
      
      // Determine SIP endpoint based on environment
      // Use config.primaryDomain to construct SIP host (single source of truth)
      let sipHost, sipPort;
      const primaryDomain = config.primaryDomain || 'biancawellness.com';
      if (config.env === 'staging') {
        // Staging: Use staging SIP endpoint
        sipHost = `staging-sip.${primaryDomain}`;
        sipPort = 5061;
      } else {
        // Production: Use direct Asterisk SIP
        sipHost = `sip.${primaryDomain}`;
        sipPort = config.asterisk.externalPort || 5061;
      }
      
      const sipUser = config.asterisk.sipUserName; // Or make dynamic if needed
      const sipUri = `sip:${sipUser}@${sipHost}:${sipPort};transport=tcp;callSid=${encodeURIComponent(CallSid)};clientId=${encodeURIComponent(clientId)}`;

      // Connect to Asterisk SIP endpoint with clientId as a parameter
      // CRITICAL FIX: Remove answerOnBridge to prevent initial audio cutoff
      const dialOptions = {
        callerId: config.twilio.phone, // Use configured Twilio number
        timeLimit: 1800, // Example: 30 mins
        timeout: 20, // Example: Ring Asterisk for 20 secs
        // answerOnBridge: true, // REMOVED: This was causing initial audio cutoff
        // Note: mediaStream is not supported in Twilio's TwiML Dial verb
        // Media streams are configured via Twilio's Media Streams API, not TwiML
      };
      
      // Only add record option if enabled in config (staging/dev only)
      if (config.twilio.recordCalls) {
        dialOptions.record = 'record-from-answer';
        logger.info(`[Twilio Service] TwiML recording enabled for ${config.env} environment`);
      }
      
      const dial = twiml.dial(dialOptions);
      
      // Add the SIP endpoint
      dial.sip(sipUri);
      
      // Log the complete TwiML for debugging
      const twimlString = twiml.toString();
      logger.info(`[Twilio Service] Complete TwiML: ${twimlString}`);
      
      // Update call record
      this.updateCallStatus(CallSid, 'in-progress');
      
      return twimlString;
    } catch (error) {
      logger.error(`[Twilio Service] Error generating TwiML: ${error.message}`);
      
      // Fallback TwiML in case of error
      const errorTwiml = new VoiceResponse();
      errorTwiml.say({
        voice: 'alice',
        language: 'en-US'
      }, "I'm sorry, we're experiencing technical difficulties. Please try again later.");
      errorTwiml.hangup();
      
      return errorTwiml.toString();
    }
  }

  /** @deprecated use generateAnswerMarkup */
  generateCallTwiML(req) {
    return this.generateAnswerMarkup(req);
  }

  getAnswerMarkupContentType() {
    return 'text/xml';
  }

  sendStatusWebhookAck(res) {
    res.type('text/xml').send('<Response/>');
  }

  /**
   * Generate TwiML for direct SIP connectivity testing
   * @param {Object} req - Express request object
   * @returns {string}
   */
  generateTestSipMarkup(req) {
    const twiml = new VoiceResponse();
    const testClientId = req.query.testClientId || req.query.testPatientId || 'direct-sip-test';
    const testCallSid = req.query.testTwilioSid || req.query.testCallSid || `TEST_SIP_${Date.now()}`;

    const primaryDomain = config.primaryDomain || 'biancawellness.com';
    let sipHost;
    let sipPort;
    if (config.env === 'staging') {
      sipHost = `staging-sip.${primaryDomain}`;
      sipPort = '5061';
    } else {
      sipHost = `sip.${primaryDomain}`;
      sipPort = String(config.asterisk.externalPort || 5061);
    }

    twiml.say('Testing SIP connection to Asterisk from telephony provider.');
    twiml
      .dial({
        callerId: config.twilio.phone || '+19786256514',
        timeout: 15,
      })
      .sip(`sip:bianca@${sipHost}:${sipPort}?clientId=${testClientId}&callSid=${testCallSid}`);

    return twiml.toString();
  }

  /**
   * Calculate call cost based on duration and billing rate
   * @param {number} duration - Call duration in seconds
   * @returns {number} - Calculated cost
   */
  calculateCallCost(duration) {
    return calculateCallCost(duration);
  }

  updateCallStatus(callSid, status) {
    return updateCallStatus(callSid, status, '[Twilio Service]');
  }

  async handleCallStatus(req) {
    const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;
    logger.info(`[Twilio Service] Full status callback body:`, JSON.stringify(req.body, null, 2));

    await handleNormalizedCallStatus(
      {
        callSid: CallSid,
        callStatus: CallStatus,
        callDuration: CallDuration,
        answeredBy: AnsweredBy,
      },
      {
        hangupCall: (id) => this.hangupCall(id),
        logPrefix: '[Twilio Service]',
      }
    );
  }

  scheduleRetryCall(call, org) {
    return scheduleRetryCall(call, org, '[Twilio Service]');
  }

  /**
   * Hang up a Twilio call
   * @param {string} callSid - The Twilio Call SID
   * @returns {Promise<void>}
   */
  async hangupCall(callSid) {
    if (!callSid) {
      logger.warn('[Twilio Service] hangupCall called without callSid');
      return;
    }

    try {
      // Ensure Twilio client is initialized
      if (!twilioClient) {
        if (!config.twilio.accountSid || !config.twilio.authToken) {
          logger.error('[Twilio Service] Cannot hangup call - Twilio credentials not configured');
          throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Twilio credentials not configured');
        }
        twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
        logger.info('[Twilio Service] Twilio client initialized for hangup');
      }

      logger.info(`[Twilio Service] Attempting to hang up call ${callSid}`);
      
      // First, check the current call status
      try {
        const currentCall = await twilioClient.calls(callSid).fetch();
        logger.info(`[Twilio Service] Current call status for ${callSid}: ${currentCall.status}`);
        
        // If call is already completed or ended, no need to update
        if (currentCall.status === 'completed' || currentCall.status === 'busy' || currentCall.status === 'no-answer' || currentCall.status === 'failed' || currentCall.status === 'canceled') {
          logger.info(`[Twilio Service] Call ${callSid} is already in terminal state: ${currentCall.status}. Skipping hangup.`);
          return currentCall;
        }
      } catch (fetchErr) {
        logger.warn(`[Twilio Service] Could not fetch call status for ${callSid}: ${fetchErr.message}. Proceeding with hangup anyway.`);
      }
      
      // Update the call status to 'completed' which will hang up the call
      const updatedCall = await twilioClient.calls(callSid).update({ status: 'completed' });
      logger.info(`[Twilio Service] Successfully hung up Twilio call ${callSid}. New call status: ${updatedCall.status}`);
      
      return updatedCall;
    } catch (err) {
      logger.error(`[Twilio Service] Error hanging up call ${callSid}: ${err.message}`);
      logger.error(`[Twilio Service] Twilio hangup error details:`, {
        callSid,
        errorCode: err.code,
        errorMessage: err.message,
        errorStatus: err.status,
        stack: err.stack
      });
      throw err;
    }
  }
}

module.exports = TwilioVoiceProvider;