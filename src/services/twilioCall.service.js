// twilioCall.service.js
const twilio = require('twilio');
const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const { Conversation, Patient, Org } = require('../models');
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
        answerOnBridge: true,
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

      // Create conversation record
      conversation = new Conversation({
        callSid: call.sid,
        patientId: patient._id,
        startTime: new Date(),
        callType: 'wellness-check',
        status: 'initiated'
      });
      
      await conversation.save();
      logger.info(`[Twilio Service] Conversation record created: ${conversation._id}`);

      return call.sid;
    } catch (error) {
      logger.error(`[Twilio Service] Error initiating call: ${error.message}`);
      logger.error(`[Twilio Service] Error stack: ${error.stack}`);
      
      // Clean up conversation if created but call failed
      if (conversation && conversation._id) {
        logger.warn(`[Twilio Service] Cleaning up conversation ${conversation._id} due to error`);
        await Conversation.findByIdAndDelete(conversation._id).catch(err => 
          logger.error(`[Twilio Service] Failed to clean up conversation: ${err.message}`)
        );
      }
      
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
        
        // Update conversation record - mark as machine/voicemail
        // This will be checked in handleCallStatus to create an alert
        this.updateConversationStatus(CallSid, 'machine');
        logger.info(`[Twilio Service] Call ${CallSid} detected as answering machine/voicemail - will create alert when call completes`);
        
        return twiml.toString();
      }

      // For human answer, connect to Asterisk SIP endpoint
      
      // Say "Connecting you to Bianca" to make the pause less noticeable
      // This greeting plays before connecting to the SIP endpoint
      // CRITICAL: Add a pause after the say command to ensure it completes before dial
      twiml.say({
        voice: 'alice', // Standard Twilio voice that's always available
        language: 'en-US'
      }, "Connecting you to Bianca");
      
      // Add a brief pause to ensure the message completes before dialing
      // This prevents the message from being cut off when the SIP connection starts
      twiml.pause({
        length: 1 // 1 second pause to ensure message completes
      });
      
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
      
      // Update conversation record
      this.updateConversationStatus(CallSid, 'in-progress');
      
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
   * Update conversation status in the database
   * @param {string} callSid - The call SID
   * @param {string} status - New status
   */
  async updateConversationStatus(callSid, status) {
    try {
      await Conversation.findOneAndUpdate(
        { callSid },
        { status, lastUpdated: new Date() }
      );
      logger.info(`[Twilio Service] Updated conversation status to ${status} for ${callSid}`);
    } catch (err) {
      logger.error(`[Twilio Service] Failed to update conversation status: ${err.message}`);
    }
  }

  /**
   * Schedule a retry call for a missed call
   * @param {Object} conversation - The failed conversation
   * @param {Object} org - The organization with retry settings
   * @returns {Promise<void>}
   */
  async scheduleRetryCall(conversation, org) {
    try {
      const retrySettings = org.callRetrySettings || {};
      const maxRetries = retrySettings.retryCount || 2;
      const retryIntervalMinutes = retrySettings.retryIntervalMinutes || 15;
      const currentRetryAttempt = conversation.retryAttempt || 0;
      
      // Check if we've exceeded max retries
      if (currentRetryAttempt >= maxRetries) {
        logger.info(`[Twilio Service] Max retries (${maxRetries}) already reached for conversation ${conversation._id}, not scheduling retry`);
        return;
      }
      
      // Calculate next retry time
      const nextRetryTime = new Date(Date.now() + (retryIntervalMinutes * 60 * 1000));
      const nextRetryAttempt = currentRetryAttempt + 1;
      
      // Determine original call ID (if this is already a retry, use the original)
      const originalCallId = conversation.originalCallId || conversation._id;
      
      // Schedule the retry using agenda
      await agenda.schedule(nextRetryTime, 'retryMissedCall', {
        conversationId: conversation._id.toString(),
        patientId: conversation.patientId.toString(),
        retryAttempt: nextRetryAttempt,
        originalCallId: originalCallId.toString()
      });
      
      // Update conversation with retry info
      conversation.retryScheduledAt = nextRetryTime;
      await conversation.save();
      
      logger.info(`[Twilio Service] ✅ Scheduled retry ${nextRetryAttempt} for conversation ${conversation._id} at ${nextRetryTime.toISOString()}`);
    } catch (error) {
      logger.error(`[Twilio Service] ❌ Failed to schedule retry call: ${error.message}`, error);
    }
  }

  /**
   * Handle call status updates
   * @param {Object} req - Express request object
   */
  async handleCallStatus(req) {
    const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;
    logger.info(`[Twilio Service] Call status update for ${CallSid}: ${CallStatus} (AnsweredBy: ${AnsweredBy || 'unknown'})`);
    
    try {
      // Find the conversation
      const conversation = await Conversation.findOne({ callSid: CallSid }).populate('patientId');
      if (!conversation) {
        logger.warn(`[Twilio Service] No conversation found for CallSid: ${CallSid}`);
        return;
      }
      
      // Get patient and org for retry settings
      const patient = await Patient.findById(conversation.patientId).populate('org');
      const org = patient?.org;
      
      // Log conversation status for debugging
      logger.info(`[Twilio Service] Conversation status before update: ${conversation.status}, failureReason: ${conversation.failureReason}`);
      
      // Update conversation with new status
      conversation.lastStatus = CallStatus;
      
      switch (CallStatus) {
        case 'completed':
          // Call ended - check if it was actually answered by a human or went to voicemail
          conversation.endTime = new Date();
          conversation.duration = parseInt(CallDuration, 10) || 0;
          
          // CRITICAL: Check if call went to voicemail/answering machine BEFORE setting status
          // If AnsweredBy is 'machine_start' or 'machine_end', patient didn't answer with their voice
          // Also check if conversation was previously marked as 'machine' status
          const wentToVoicemail = AnsweredBy === 'machine_start' || 
                                   AnsweredBy === 'machine_end' || 
                                   conversation.status === 'machine' || 
                                   conversation.failureReason === 'machine' ||
                                   conversation.failureReason === 'voicemail';
          
          if (wentToVoicemail) {
            // Call went to voicemail - this counts as a missed call (patient didn't answer with their voice)
            conversation.status = 'failed';
            conversation.failureReason = 'voicemail';
            conversation.endTime = new Date();
            conversation.duration = parseInt(CallDuration, 10) || 0;
            logger.info(`[Twilio Service] Call ${CallSid} went to voicemail (AnsweredBy: ${AnsweredBy}, conversation.status: ${conversation.status}) - treating as missed call`);
            
            // Get retry settings
            const retrySettings = org?.callRetrySettings || {};
            const alertOnAllMissedCalls = retrySettings.alertOnAllMissedCalls !== false; // Default to true
            const currentRetryAttempt = conversation.retryAttempt || 0;
            
            // Create alert if setting allows (alert on all missed calls) OR if all retries are exhausted
            const shouldAlert = alertOnAllMissedCalls || (currentRetryAttempt >= (retrySettings.retryCount || 2));
            
            if (shouldAlert) {
              try {
                const retryText = currentRetryAttempt > 0 ? ` (Retry attempt ${currentRetryAttempt})` : '';
                logger.info(`[Twilio Service] Creating alert for voicemail call ${CallSid} for patient ${conversation.patientId}${retryText}`);
                const alert = await alertService.createAlert({
                  message: `Wellness check call went to voicemail: Patient did not answer with their voice${retryText}`,
                  importance: 'medium',
                  alertType: 'patient',
                  relatedPatient: conversation.patientId,
                  relatedConversation: conversation._id,
                  createdBy: conversation.patientId,
                  createdModel: 'Patient',
                  visibility: 'assignedCaregivers',
                  relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
                });
                logger.info(`[Twilio Service] ✅ Successfully created alert ${alert._id} for voicemail call ${CallSid} - visible to all assigned caregivers`);
              } catch (alertError) {
                logger.error(`[Twilio Service] ❌ Failed to create alert for voicemail call ${CallSid}: ${alertError.message}`, alertError);
              }
            } else {
              logger.info(`[Twilio Service] Skipping alert for voicemail call ${CallSid} - alertOnAllMissedCalls is false and retries remaining`);
            }
            
            // Save conversation to persist failureReason before scheduling retry
            await conversation.save();
            
            // Schedule retry if org settings allow
            if (org) {
              await this.scheduleRetryCall(conversation, org);
            }
          } else {
            // Call completed normally with actual conversation
            conversation.status = 'completed';
            // Calculate cost based on duration and billing rate
            conversation.cost = this.calculateCallCost(conversation.duration);
            
            // If this was a retry that succeeded, cancel any remaining scheduled retries
            if (conversation.retryAttempt > 0 && conversation.originalCallId) {
              try {
                // Find and cancel any remaining retry jobs for this original call
                const retryJobs = await agenda.jobs({
                  name: 'retryMissedCall',
                  'data.originalCallId': conversation.originalCallId.toString()
                });
                
                for (const job of retryJobs) {
                  if (job.attrs.data.retryAttempt > conversation.retryAttempt) {
                    await job.remove();
                    logger.info(`[Twilio Service] Cancelled remaining retry ${job.attrs.data.retryAttempt} for original call ${conversation.originalCallId} - retry ${conversation.retryAttempt} succeeded`);
                  }
                }
              } catch (error) {
                logger.error(`[Twilio Service] Error cancelling remaining retries: ${error.message}`);
              }
            }
            
            // Summarize the conversation if there are messages
            if (conversation.messages && conversation.messages.length > 0) {
              try {
                conversation.summary = await chatService.summarize(conversation);
                logger.info(`[Twilio Service] Created summary for call ${CallSid}`);
              } catch (summaryError) {
                logger.error(`[Twilio Service] Failed to summarize: ${summaryError.message}`);
                conversation.summary = 'Error generating summary';
              }
            } else {
              conversation.summary = 'No conversation recorded';
            }
          }
          break;
          
        case 'busy':
        case 'failed':
        case 'no-answer':
        case 'canceled':
          // Call was not successful - patient did not answer with their voice
          conversation.endTime = new Date();
          conversation.status = 'failed';
          conversation.failureReason = CallStatus;
          conversation.duration = parseInt(CallDuration, 10) || 0;
          
          // Calculate cost for failed calls (minimum billable duration)
          conversation.cost = this.calculateCallCost(conversation.duration);
          
          // Get retry settings from org
          const retrySettings = org?.callRetrySettings || {};
          const alertOnAllMissedCalls = retrySettings.alertOnAllMissedCalls !== false; // Default to true
          const currentRetryAttempt = conversation.retryAttempt || 0;
          
          // Create alert if setting allows (alert on all missed calls) OR if all retries are exhausted
          const shouldAlert = alertOnAllMissedCalls || (currentRetryAttempt >= (retrySettings.retryCount || 2));
          
          if (shouldAlert) {
            try {
              const retryText = currentRetryAttempt > 0 ? ` (Retry attempt ${currentRetryAttempt})` : '';
              const alertMessage = CallStatus === 'no-answer' 
                ? `Patient did not answer the wellness check call${retryText}`
                : CallStatus === 'busy' 
                ? `Patient line was busy during wellness check call${retryText}`
                : CallStatus === 'canceled'
                ? `Wellness check call was canceled before patient could answer${retryText}`
                : `Wellness check call failed${retryText}`;
                
              logger.info(`[Twilio Service] Creating alert for missed call ${CallSid} (status: ${CallStatus}) for patient ${conversation.patientId}${retryText}`);
              const alert = await alertService.createAlert({
                message: alertMessage,
                importance: 'medium',
                alertType: 'patient',
                relatedPatient: conversation.patientId,
                relatedConversation: conversation._id,
                createdBy: conversation.patientId, // Using patient as creator since it's about their call
                createdModel: 'Patient',
                visibility: 'assignedCaregivers',
                relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
              });
              logger.info(`[Twilio Service] ✅ Successfully created alert ${alert._id} for missed call ${CallSid} (${CallStatus}) - visible to all assigned caregivers`);
            } catch (alertError) {
              logger.error(`[Twilio Service] ❌ Failed to create alert for missed call ${CallSid}: ${alertError.message}`, alertError);
              logger.error(`[Twilio Service] Alert error stack:`, alertError.stack);
            }
          } else {
            logger.info(`[Twilio Service] Skipping alert for missed call ${CallSid} - alertOnAllMissedCalls is false and retries remaining`);
          }
          
          // Save conversation to persist failureReason before scheduling retry
          await conversation.save();
          
          // Schedule retry if org settings allow
          if (org) {
            await this.scheduleRetryCall(conversation, org);
          }
          break;
          
        default:
          // Map Twilio statuses to our conversation statuses
          switch (CallStatus) {
            case 'ringing':
              conversation.status = 'in-progress';
              break;
            case 'initiated':
              conversation.status = 'initiated';
              break;
            case 'in-progress':
              conversation.status = 'in-progress';
              break;
            case 'answered':
              conversation.status = 'in-progress';
              break;
            default:
              // For any other status, keep as initiated
              conversation.status = 'initiated';
              logger.warn(`[Twilio Service] Unknown call status: ${CallStatus}, defaulting to initiated`);
          }
      }
      
      // Save the updated conversation
      await conversation.save();
      logger.info(`[Twilio Service] Updated conversation for ${CallSid} with status ${CallStatus}`);
    } catch (error) {
      logger.error(`[Twilio Service] Error handling call status: ${error.message}`);
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