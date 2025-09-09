// twilioCall.service.js
const twilio = require('twilio');
const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const { Conversation, Patient } = require('../models');
const ApiError = require('../utils/ApiError');
const { chatService, alertService } = require('.');

// Create Twilio client
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
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

      // Create call with Twilio
      const call = await twilioClient.calls.create({
        url: initialTwiMLUrl,
        to: patient.phone,
        from: config.twilio.phone,
        statusCallback: statusCallbackUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: true,
        answerOnBridge: true,
        machineDetection: 'DetectMessageEnd', // Detect answering machines
        machineDetectionTimeout: 10, // Wait 10 seconds for detection
        timeout: 30 // Ring for 30 seconds before giving up
      });
      
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
      
      // Clean up conversation if created but call failed
      if (conversation && conversation._id) {
        logger.warn(`[Twilio Service] Cleaning up conversation ${conversation._id} due to error`);
        await Conversation.findByIdAndDelete(conversation._id).catch(err => 
          logger.error(`[Twilio Service] Failed to clean up conversation: ${err.message}`)
        );
      }
      
      // Re-throw appropriate error
      if (error instanceof ApiError) throw error;
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to initiate call: ${error.message}`);
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
        
        // Update conversation record
        this.updateConversationStatus(CallSid, 'machine');
        
        return twiml.toString();
      }

      // For human answer, connect to Asterisk SIP endpoint
      
      // Add initial message so user knows Twilio is working
      twiml.say({
        voice: 'alice',
        language: 'en-US'
      }, "Hello, connecting you to Bianca");
      
      // Determine SIP endpoint based on environment
      let sipHost, sipPort;
      if (config.env === 'staging') {
        // Staging: Use staging SIP endpoint
        sipHost = 'staging-sip.myphonefriend.com';
        sipPort = 5061;
      } else {
        // Production: Use direct Asterisk SIP
        sipHost = 'sip.myphonefriend.com';
        sipPort = config.asterisk.externalPort || 5061;
      }
      
      const sipUser = config.asterisk.sipUserName; // Or make dynamic if needed
      const sipUri = `sip:${sipUser}@${sipHost}:${sipPort};transport=tcp;callSid=${encodeURIComponent(CallSid)};patientId=${encodeURIComponent(patientId)}`;

      // Connect to Asterisk SIP endpoint with patientId as a parameter
      // CRITICAL FIX: Remove answerOnBridge to prevent initial audio cutoff
      const dial = twiml.dial({
        callerId: config.twilio.phone, // Use configured Twilio number
        record: 'record-from-answer',
        timeLimit: 1800, // Example: 30 mins
        timeout: 20, // Example: Ring Asterisk for 20 secs
        // answerOnBridge: true, // REMOVED: This was causing initial audio cutoff
        // Add media stream configuration
        mediaStream: {
          track: 'both_tracks', // Enable both inbound and outbound audio
          format: 'mulaw', // Use μ-law format to match Asterisk
          sampleRate: 8000 // 8kHz sample rate to match Asterisk
        }
      });
      
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
   * Handle call status updates
   * @param {Object} req - Express request object
   */
  async handleCallStatus(req) {
    const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;
    logger.info(`[Twilio Service] Call status update for ${CallSid}: ${CallStatus} (${AnsweredBy || 'unknown'})`);
    
    try {
      // Find the conversation
      const conversation = await Conversation.findOne({ callSid: CallSid });
      if (!conversation) {
        logger.warn(`[Twilio Service] No conversation found for CallSid: ${CallSid}`);
        return;
      }
      
      // Update conversation with new status
      conversation.lastStatus = CallStatus;
      
      switch (CallStatus) {
        case 'completed':
          // Call ended normally
          conversation.endTime = new Date();
          conversation.duration = parseInt(CallDuration, 10) || 0;
          conversation.status = 'completed';
          
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
          break;
          
        case 'busy':
        case 'failed':
        case 'no-answer':
          // Call was not successful
          conversation.endTime = new Date();
          conversation.status = 'failed';
          conversation.failureReason = CallStatus;
          
          // Create alert for failed call
          try {
            await alertService.createAlert({
              message: `Wellness check call failed: ${CallStatus}`,
              importance: 'medium',
              alertType: 'patient',
              relatedPatient: conversation.patientId,
              relatedConversation: conversation._id,
              createdBy: conversation.patientId, // Using patient as creator since it's about their call
              createdModel: 'Patient',
              visibility: 'assignedCaregivers',
              relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
            });
            logger.info(`[Twilio Service] Created alert for failed call ${CallSid}`);
          } catch (alertError) {
            logger.error(`[Twilio Service] Failed to create alert: ${alertError.message}`);
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
}

// Create and export singleton instance
const twilioCallService = new TwilioCallService();
module.exports = {
  initiateCall: twilioCallService.initiateCall.bind(twilioCallService),
  generateCallTwiML: twilioCallService.generateCallTwiML.bind(twilioCallService),
  handleCallStatus: twilioCallService.handleCallStatus.bind(twilioCallService)
};