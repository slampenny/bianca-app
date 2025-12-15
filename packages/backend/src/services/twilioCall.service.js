// twilioCall.service.js
const twilio = require('twilio');
const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const { Call, Conversation, Patient, Org } = require('../models');
const ApiError = require('../utils/ApiError');
const { chatService, alertService } = require('.');
const { agenda } = require('../config/agenda');

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

/**
 * Service for handling Twilio call operations
 */
class TwilioCallService {
  /**
   * Initiate an outbound call to a patient
   * @param {string} patientId - Database ID of the patient
   * @returns {Promise<string>} - The call SID
   */
  async initiateCall(patientId) {
    logger.info(`[Twilio Service] Initiating call for patient ID: ${patientId}`);
    let patient;
    let conversation;

    try {
      // Get patient information
      patient = await Patient.findById(patientId);
      if (!patient || !patient.phone) {
        logger.error(`[Twilio Service] Patient not found or phone missing for ID: ${patientId}`);
        throw new ApiError(httpStatus.NOT_FOUND, 'Patient or phone number not found');
      }
      
      logger.info(`[Twilio Service] Found patient ${patient.name} with phone ${patient.phone}`);

      // Set up TwiML and callback URLs
      const initialTwiMLUrl = `${config.twilio.apiUrl}/v1/twilio/start-call/${patientId}`;
      const statusCallbackUrl = `${config.twilio.apiUrl}/v1/twilio/call-status`;
      
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
        to: patient.phone,
        from: config.twilio.phone,
        statusCallback: statusCallbackUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        // answerOnBridge: true, // REMOVED: This was causing Twilio to skip the initial TwiML "Connecting you to Bianca" message
        machineDetection: 'DetectMessageEnd', // Detect answering machines
        machineDetectionTimeout: 10, // Wait 10 seconds for detection
        timeout: 30 // Ring for 30 seconds before giving up
      };
      
      // Only add record option if enabled in config (staging/dev only)
      if (config.twilio.recordCalls) {
        callOptions.record = true;
        logger.info(`[Twilio Service] Call recording enabled for ${config.env} environment`);
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
        } else if (twilioError.code === 21211) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Invalid phone number format: ${patient.phone}`);
        } else if (twilioError.code === 21212) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Invalid caller ID: ${config.twilio.phone}`);
        } else {
          throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Twilio API error: ${twilioError.message || 'Unknown error'}`);
        }
      }
      
      logger.info(`[Twilio Service] Call initiated with SID: ${call.sid}`);

      // Create Call record (not Conversation - Conversation is only created when call is answered)
      const callRecord = await Call.create({
        callSid: call.sid,
        patientId: patient._id,
        startTime: new Date(),
        callStartTime: new Date(),
        callType: 'wellness-check',
        status: 'initiated',
        callStatus: 'initiating',
      });
      
      logger.info(`[Twilio Service] Call record created: ${callRecord._id}`);

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
   * Generate TwiML for connecting to Asterisk SIP server
   * @param {Object} req - Express request object
   * @returns {string} - TwiML markup
   */
  generateCallTwiML(req) {
    const { CallSid, AnsweredBy } = req.body;
    const { patientId } = req.params;
    
    logger.info(`[Twilio Service] Generating Asterisk SIP TwiML for CallSid: ${CallSid}, AnsweredBy: ${AnsweredBy || 'unknown'}, PatientId: ${patientId}`);
    
    const twiml = new VoiceResponse();
    
    try {
      // Customize greeting based on answering machine detection
      if (AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end') {
        // Leave a message on answering machine
        twiml.say({
          voice: 'alice',
          language: 'en-US'
        }, "Hello, this is a wellness check from your care team. " +
           "We're calling to check on you. " +
           "Please call us back at your convenience. " +
           "Thank you and have a good day.");
        
        twiml.hangup();
        logger.info(`[Twilio Service] Generated answering machine message for ${CallSid}`);
        
        // Update call record
        this.updateCallStatus(CallSid, 'machine');
        
        return twiml.toString();
      }

      // For human answer, connect to Asterisk SIP endpoint
      // Say "Connecting you to Bianca" to cover the delay while connecting to Asterisk and setting up Bianca
      twiml.say({
        voice: 'Polly.Joanna', // Most human-sounding voice for US English
        language: 'en-US'
      }, "Connecting you to Bianca");
      
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
      const sipUri = `sip:${sipUser}@${sipHost}:${sipPort};transport=tcp;callSid=${encodeURIComponent(CallSid)};patientId=${encodeURIComponent(patientId)}`;

      // Connect to Asterisk SIP endpoint with patientId as a parameter
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

  /**
   * Calculate call cost based on duration and billing rate
   * @param {number} duration - Call duration in seconds
   * @returns {number} - Calculated cost
   */
  calculateCallCost(duration) {
    const minimumBillableDuration = config.billing.minimumBillableDuration || 30; // Configurable minimum
    const billableDuration = Math.max(duration, minimumBillableDuration);
    const totalMinutes = billableDuration / 60;
    return totalMinutes * config.billing.ratePerMinute;
  }

  /**
   * Update call status in the database
   * @param {string} callSid - The call SID
   * @param {string} status - New status
   */
  async updateCallStatus(callSid, status) {
    try {
      await Call.findOneAndUpdate(
        { callSid },
        { status, callStatus: status === 'in-progress' ? 'answered' : status }
      );
      logger.info(`[Twilio Service] Updated call status to ${status} for ${callSid}`);
    } catch (err) {
      logger.error(`[Twilio Service] Failed to update call status: ${err.message}`);
    }
  }

  /**
   * Handle call status updates
   * @param {Object} req - Express request object
   */
  async handleCallStatus(req) {
    const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;
    logger.info(`[Twilio Service] Call status update for ${CallSid}: ${CallStatus} (${AnsweredBy || 'unknown'})`);
    
    try {
      // Find the call record
      const call = await Call.findOne({ callSid: CallSid });
      if (!call) {
        logger.warn(`[Twilio Service] No call found for CallSid: ${CallSid}`);
        return;
      }
      
      // Check if this is a voicemail/answering machine (can come as completed status with AnsweredBy)
      const isVoicemail = AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end' || CallStatus === 'machine';
      
      switch (CallStatus) {
        case 'completed':
          // Check if this was actually a voicemail (completed but answered by machine)
          if (isVoicemail) {
            // Treat as voicemail - same logic as machine case
            call.endTime = new Date();
            call.callEndTime = new Date();
            call.status = 'failed';
            call.callOutcome = 'voicemail';
            call.duration = parseInt(CallDuration, 10) || 0;
            call.callDuration = call.duration;
            
            // Calculate cost for failed calls (minimum billable duration)
            call.cost = this.calculateCallCost(call.duration);
            
            // Save call first
            await call.save();
            
            // Get patient and org for retry logic
            const voicemailPatient = await Patient.findById(call.patientId).populate('org');
            const voicemailOrg = voicemailPatient?.org;
            
            // Schedule retry if org has retry settings enabled
            if (voicemailOrg && voicemailOrg.callRetrySettings && voicemailOrg.callRetrySettings.retryCount > 0) {
              try {
                await this.scheduleRetryCall(call, voicemailOrg);
              } catch (retryError) {
                logger.error(`[Twilio Service] Failed to schedule retry: ${retryError.message}`);
              }
            }
            
            // Create alert for voicemail call
            const voicemailAlertOnAllMissedCalls = voicemailOrg?.callRetrySettings?.alertOnAllMissedCalls !== false;
            const voicemailCurrentRetryAttempt = call.retryAttempt || 0;
            const voicemailMaxRetries = voicemailOrg?.callRetrySettings?.retryCount || 2;
            const voicemailShouldAlert = voicemailAlertOnAllMissedCalls || voicemailCurrentRetryAttempt >= voicemailMaxRetries;
            
            if (voicemailShouldAlert) {
              try {
                await alertService.createAlert({
                  message: `Wellness check call went to voicemail`,
                  importance: 'medium',
                  alertType: 'patient',
                  relatedPatient: call.patientId,
                  relatedCall: call._id,
                  createdBy: call.patientId,
                  createdModel: 'Patient',
                  visibility: 'assignedCaregivers',
                  relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                });
                logger.info(`[Twilio Service] Created alert for voicemail call ${CallSid}`);
              } catch (alertError) {
                logger.error(`[Twilio Service] Failed to create alert: ${alertError.message}`);
              }
            }
          } else {
            // Call ended normally - answered and had conversation
            call.endTime = new Date();
            call.callEndTime = new Date();
            call.duration = parseInt(CallDuration, 10) || 0;
            call.callDuration = call.duration;
            call.status = 'completed';
            call.callStatus = 'ended';
            call.callOutcome = 'answered';
            
            // Calculate cost based on duration and billing rate
            call.cost = this.calculateCallCost(call.duration);
            
            // If this is a successful retry call, cancel any remaining retry jobs
            if (call.originalCallId && call.retryAttempt > 0) {
              try {
                const remainingJobs = await agenda.jobs({
                  name: 'retryMissedCall',
                  'data.originalCallId': call.originalCallId.toString(),
                });
                
                for (const job of remainingJobs) {
                  await job.remove();
                  logger.info(`[Twilio Service] Cancelled remaining retry job ${job.attrs._id} for successful retry call ${CallSid}`);
                }
              } catch (cancelError) {
                logger.error(`[Twilio Service] Failed to cancel remaining retries: ${cancelError.message}`);
              }
            }
            
            // Summarize the conversation if it exists and has messages
            if (call.conversationId) {
              const conversation = await Conversation.findById(call.conversationId);
              if (conversation && conversation.messages && conversation.messages.length > 0) {
                try {
                  conversation.summary = await chatService.summarize(conversation);
                  await conversation.save();
                  logger.info(`[Twilio Service] Created summary for call ${CallSid}`);
                } catch (summaryError) {
                  logger.error(`[Twilio Service] Failed to summarize: ${summaryError.message}`);
                }
              }
            }
          }
          break;
          
        case 'busy':
        case 'failed':
        case 'no-answer':
          // Call was not successful
          call.endTime = new Date();
          call.callEndTime = new Date();
          call.status = 'failed';
          call.callStatus = CallStatus === 'no-answer' ? 'no_answer' : CallStatus;
          // Map Twilio CallStatus to callOutcome
          call.callOutcome = CallStatus === 'no-answer' ? 'no_answer' : CallStatus;
          
          // Calculate cost for failed calls (minimum billable duration)
          call.cost = this.calculateCallCost(call.duration);
          
          // Save call first to ensure it's persisted before scheduling retry
          await call.save();
          
          // Get patient and org for retry logic
          const patient = await Patient.findById(call.patientId).populate('org');
          const org = patient?.org;
          
          // Schedule retry if org has retry settings enabled
          if (org && org.callRetrySettings && org.callRetrySettings.retryCount > 0) {
            try {
              await this.scheduleRetryCall(call, org);
            } catch (retryError) {
              logger.error(`[Twilio Service] Failed to schedule retry: ${retryError.message}`);
            }
          }
          
          // Create alert for failed call
          // Alert logic: if alertOnAllMissedCalls is false, only alert when all retries are exhausted
          // Otherwise, alert on every missed call
          const alertOnAllMissedCalls = org?.callRetrySettings?.alertOnAllMissedCalls !== false; // Default to true
          const currentRetryAttempt = call.retryAttempt || 0;
          const maxRetries = org?.callRetrySettings?.retryCount || 2;
          const shouldAlert = alertOnAllMissedCalls || currentRetryAttempt >= maxRetries;
          
          if (shouldAlert) {
            try {
              await alertService.createAlert({
                message: `Wellness check call failed: ${CallStatus}`,
                importance: 'medium',
                alertType: 'patient',
                relatedPatient: call.patientId,
                relatedCall: call._id,
                createdBy: call.patientId, // Using patient as creator since it's about their call
                createdModel: 'Patient',
                visibility: 'assignedCaregivers',
                relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
              });
              logger.info(`[Twilio Service] Created alert for failed call ${CallSid}`);
            } catch (alertError) {
              logger.error(`[Twilio Service] Failed to create alert: ${alertError.message}`);
            }
          }
          break;
        
        case 'machine':
          // Answering machine detected - treat as voicemail
          call.endTime = new Date();
          call.callEndTime = new Date();
          call.status = 'failed';
          call.callOutcome = 'voicemail';
          
          // Calculate cost for failed calls (minimum billable duration)
          call.cost = this.calculateCallCost(call.duration);
          
          // Save call first
          await call.save();
          
          // Get patient and org for retry logic
          const machinePatient = await Patient.findById(call.patientId).populate('org');
          const machineOrg = machinePatient?.org;
          
          // Schedule retry if org has retry settings enabled
          if (machineOrg && machineOrg.callRetrySettings && machineOrg.callRetrySettings.retryCount > 0) {
            try {
              await this.scheduleRetryCall(call, machineOrg);
            } catch (retryError) {
              logger.error(`[Twilio Service] Failed to schedule retry: ${retryError.message}`);
            }
          }
          
          // Create alert for voicemail call (same logic as other failed calls)
          const machineAlertOnAllMissedCalls = machineOrg?.callRetrySettings?.alertOnAllMissedCalls !== false;
          const machineCurrentRetryAttempt = call.retryAttempt || 0;
          const machineMaxRetries = machineOrg?.callRetrySettings?.retryCount || 2;
          const machineShouldAlert = machineAlertOnAllMissedCalls || machineCurrentRetryAttempt >= machineMaxRetries;
          
          if (machineShouldAlert) {
            try {
              await alertService.createAlert({
                message: `Wellness check call went to voicemail`,
                importance: 'medium',
                alertType: 'patient',
                relatedPatient: call.patientId,
                relatedCall: call._id,
                createdBy: call.patientId,
                createdModel: 'Patient',
                visibility: 'assignedCaregivers',
                relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              });
              logger.info(`[Twilio Service] Created alert for voicemail call ${CallSid}`);
            } catch (alertError) {
              logger.error(`[Twilio Service] Failed to create alert: ${alertError.message}`);
            }
          }
          break;
          
        default:
          // Map Twilio statuses to our call statuses
          switch (CallStatus) {
            case 'ringing':
              call.status = 'in-progress';
              call.callStatus = 'ringing';
              break;
            case 'initiated':
              call.status = 'initiated';
              call.callStatus = 'initiating';
              break;
            case 'in-progress':
              call.status = 'in-progress';
              call.callStatus = 'connected';
              break;
            case 'answered':
              call.status = 'in-progress';
              call.callStatus = 'answered';
              break;
            default:
              // For any other status, keep as initiated
              call.status = 'initiated';
              call.callStatus = 'initiating';
              logger.warn(`[Twilio Service] Unknown call status: ${CallStatus}, defaulting to initiated`);
          }
      }
      
      // Save the updated call (if not already saved in case blocks above)
      if (!call.isNew && call.isModified()) {
        await call.save();
      }
      logger.info(`[Twilio Service] Updated call for ${CallSid} with status ${CallStatus}`);
    } catch (error) {
      logger.error(`[Twilio Service] Error handling call status: ${error.message}`);
    }
  }

  /**
   * Schedule a retry call for a missed call
   * @param {Object} call - Call object
   * @param {Object} org - Organization object with retry settings
   * @returns {Promise<void>}
   */
  async scheduleRetryCall(call, org) {
    try {
      // Get retry settings from org
      const retrySettings = org.callRetrySettings || {};
      const maxRetries = retrySettings.retryCount || 2;
      const retryIntervalMinutes = retrySettings.retryIntervalMinutes || 15;

      // Determine current retry attempt
      const currentRetryAttempt = call.retryAttempt || 0;
      const originalCallId = call.originalCallId || call._id;

      // Check if we've reached max retries
      if (currentRetryAttempt >= maxRetries) {
        logger.info(`[Twilio Service] Max retries (${maxRetries}) reached for call ${call._id}, not scheduling retry`);
        return;
      }

      // Calculate next retry attempt
      const nextRetryAttempt = currentRetryAttempt + 1;

      // Calculate retry time
      const retryTime = new Date(Date.now() + retryIntervalMinutes * 60 * 1000);

      // Schedule the retry job
      await agenda.schedule(retryTime, 'retryMissedCall', {
        callId: call._id.toString(),
        patientId: call.patientId.toString(),
        retryAttempt: nextRetryAttempt,
        originalCallId: originalCallId.toString(),
      });

      // Update call with retry info
      call.retryScheduledAt = retryTime;
      call.retryAttempt = nextRetryAttempt;
      call.originalCallId = originalCallId;
      call.maxRetries = maxRetries;
      await call.save();

      logger.info(`[Twilio Service] Scheduled retry call #${nextRetryAttempt} for call ${call._id} at ${retryTime.toISOString()}`);
    } catch (error) {
      logger.error(`[Twilio Service] Error scheduling retry call: ${error.message}`);
      throw error;
    }
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

// Create and export singleton instance
const twilioCallService = new TwilioCallService();
module.exports = {
  initiateCall: twilioCallService.initiateCall.bind(twilioCallService),
  generateCallTwiML: twilioCallService.generateCallTwiML.bind(twilioCallService),
  hangupCall: twilioCallService.hangupCall.bind(twilioCallService),
  handleCallStatus: twilioCallService.handleCallStatus.bind(twilioCallService),
  scheduleRetryCall: twilioCallService.scheduleRetryCall.bind(twilioCallService)
};