const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { conversationService, twilioCallService, patientService, caregiverService } = require('../services');
const { ConversationDTO } = require('../dtos');
const { Call, Conversation } = require('../models');
const logger = require('../config/logger');

/**
 * Initiate a call to a patient
 * @route POST /api/v1/calls/initiate
 */
const initiateCall = catchAsync(async (req, res) => {
  const { patientId, callNotes } = req.body;
  const agentId = req.caregiver.id; // Get agent ID from authenticated user
  let conversation; // Declare conversation variable for error handling

  // Validate patient exists and has phone number
  const patient = await patientService.getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }
  if (!patient.phone) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Patient does not have a phone number');
  }

  // Validate agent exists
  const agent = await caregiverService.getCaregiverById(agentId);
  if (!agent) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Agent not found');
  }

  try {
    // Initiate the call via Twilio
    const callSid = await twilioCallService.initiateCall(patient.id);
    
    // Find the Call record created by Twilio service
    let call = await Call.findOne({ callSid });
    if (!call) {
      // Create Call if Twilio service didn't create one (e.g., in test environment)
      call = await Call.create({
        callSid,
        patientId: patient.id,
        startTime: new Date(),
        callStartTime: new Date(),
        callType: 'outbound',
        status: 'initiated',
        callStatus: 'initiating',
      });
    }
    
    // Add call workflow-specific fields
    call.agentId = agentId;
    call.callNotes = callNotes;
    call.status = 'in-progress';
    call.callStatus = 'ringing';
    call.callType = 'outbound';
    await call.save();
    
    // Note: Conversation will be created when call is answered and messages start
    // For now, we return the call ID - frontend can use this to track the call

    logger.info(`[CallWorkflow] Call initiated for patient ${patient.name}, SID: ${callSid}`);

    res.status(httpStatus.CREATED).send({
      callId: call._id,
      callSid,
      patientId: patient._id,
      patientName: patient.name,
      patientPhone: patient.phone,
      agentId: agent._id,
      agentName: agent.name,
      callStatus: call.callStatus,
    });

  } catch (error) {
    logger.error(`[CallWorkflow] Failed to initiate call for patient ${patient.name}:`, error);
    
    // Update call status to failed if we have a call record
    if (call) {
      call.status = 'failed';
      call.callStatus = 'failed';
      await call.save();
    }
    
    throw error;
  }
});

/**
 * Get call status for a conversation
 * @route GET /api/v1/calls/:conversationId/status
 */
const getCallStatus = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  
  const conversation = await conversationService.getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  
  // Get the Call record for call status/metadata
  const call = await Call.findById(conversation.callId);
  if (!call) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Call not found for conversation');
  }
  
  // Populate patient and agent details
  await conversation.populate('patientId', 'name phone');
  await conversation.populate('agentId', 'name');
  await call.populate('patientId', 'name phone');
  await call.populate('agentId', 'name');
  
  // CRITICAL: conversation.messages IS THE QUEUE - use it as-is, don't touch it
  // Messages are added via $push which maintains FIFO order
  // Just populate it if needed and use it directly - NO MERGING, NO SORTING, NO REORDERING
  if (conversation.messages && conversation.messages.length > 0) {
    // Check if messages are already populated (have content property) or are just ObjectIds
    const firstMessage = conversation.messages[0];
    if (!firstMessage || !firstMessage.content) {
      // Messages are not populated, populate them now
      await conversation.populate('messages');
    }
  }
  
  // Use conversation.messages directly - it's the queue, in the correct order
  const allMessages = conversation.messages || [];
  
  // Get AI speaking status from OpenAI realtime service
  let aiSpeakingStatus = {
    isSpeaking: false,
    userIsSpeaking: false,
    conversationState: 'unknown'
  };
  
  try {
    const openAIService = require('../services/openai.realtime.service');
    // Find the connection by conversationId (callSid)
    for (const [callId, conn] of openAIService.connections.entries()) {
      if (conn.conversationId === conversationId) {
        aiSpeakingStatus = {
          isSpeaking: conn._aiIsSpeaking || false,
          userIsSpeaking: conn._userIsSpeaking || false,
          conversationState: conn.status || 'unknown',
          lastAiSpeechStart: conn._lastAiSpeechStart || null,
          lastUserSpeechStart: conn._lastUserSpeechStart || null
        };
        break;
      }
    }
  } catch (error) {
    logger.warn(`[CallStatus] Could not get AI speaking status: ${error.message}`);
  }
  
  // Convert messages to plain objects to ensure proper JSON serialization
  // This ensures all messages (including patient messages) are included
  const messages = allMessages.map(msg => {
    // If message is a Mongoose document, convert to plain object
    if (msg.toObject) {
      return msg.toObject();
    }
    // If already a plain object, return as-is
    return msg;
  });
  
  // Log message details for debugging with ordering information
  logger.info(`[MESSAGE ORDERING] Returning ${messages.length} messages for conversation ${conversationId}`);
  logger.info(`[MESSAGE ORDERING] Message breakdown: ${messages.filter(m => m.role === 'patient').length} patient, ${messages.filter(m => m.role === 'assistant').length} assistant`);
  
  // Log message order with timestamps to verify chronological ordering
  if (messages.length > 0) {
    const messageOrder = messages.map((msg, index) => ({
      index,
      role: msg.role,
      timestamp: msg.createdAt ? new Date(msg.createdAt).toISOString() : 'unknown',
      contentPreview: msg.content ? msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '') : 'empty',
      messageId: msg._id
    }));
    logger.info(`[MESSAGE ORDERING] Message chronological order:`, JSON.stringify(messageOrder, null, 2));
    
    // Verify ordering is correct (each message should have timestamp >= previous)
    let orderingCorrect = true;
    for (let i = 1; i < messages.length; i++) {
      const prevTime = messages[i-1].createdAt ? new Date(messages[i-1].createdAt).getTime() : 0;
      const currTime = messages[i].createdAt ? new Date(messages[i].createdAt).getTime() : 0;
      if (currTime < prevTime) {
        orderingCorrect = false;
        logger.error(`[MESSAGE ORDERING] ⚠️ ORDERING ISSUE DETECTED: Message ${i} (${messages[i].role}) has timestamp ${new Date(messages[i].createdAt).toISOString()} which is BEFORE message ${i-1} (${messages[i-1].role}) with timestamp ${new Date(messages[i-1].createdAt).toISOString()}`);
      }
    }
    if (orderingCorrect) {
      logger.info(`[MESSAGE ORDERING] ✅ Message ordering verified: all messages are in chronological order`);
    } else {
      logger.error(`[MESSAGE ORDERING] ❌ Message ordering is INCORRECT - timestamps are out of order!`);
    }
  }
  
  const status = {
    conversationId: conversation._id,
    callId: call._id,
    status: call.status,
    callStatus: call.callStatus,
    startTime: call.startTime,
    endTime: call.endTime,
    duration: call.duration,
    patient: conversation.patientId || call.patientId,
    agent: call.agentId,
    // Include all messages (patient and assistant) for live call display
    messages: messages,
    // Include AI speaking status
    aiSpeaking: aiSpeakingStatus
  };
  
  res.status(httpStatus.OK).send({ data: status });
});

/**
 * Update call status (for webhooks)
 * @route POST /api/v1/calls/:conversationId/status
 */
const updateCallStatus = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { status, outcome, notes } = req.body;

  const conversation = await conversationService.getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }

  // Get the Call record
  const call = await Call.findById(conversation.callId);
  if (!call) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Call not found for conversation');
  }

  // Map call status to our status enum
  const statusMapping = {
    'initiating': 'initiated',
    'ringing': 'in-progress', 
    'answered': 'in-progress',
    'connected': 'in-progress',
    'ended': 'completed',
    'failed': 'failed',
    'busy': 'failed',
    'no_answer': 'failed'
  };
  
  const callStatus = statusMapping[status] || 'in-progress';
  call.status = callStatus;
  call.callStatus = status;
  if (notes) call.callNotes = notes;
  if (outcome) call.callOutcome = outcome;

  // Handle call end
  if (['ended', 'failed', 'busy', 'no_answer'].includes(status)) {
    call.endTime = new Date();
    call.callEndTime = new Date();
    if (call.startTime) {
      call.duration = Math.round((call.endTime - call.startTime) / 1000);
      call.callDuration = call.duration;
    }
  }

  await call.save();

  logger.info(`[CallWorkflow] Updated call status for conversation ${conversationId} to ${status}`);

  // Return conversation with call data populated
  await conversation.populate('callId');
  res.status(httpStatus.OK).send(ConversationDTO(conversation));
});

/**
 * End a call
 * @route POST /api/v1/calls/:conversationId/end
 */
const endCall = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { outcome, notes } = req.body;
  
  logger.info(`[CallWorkflow] endCall endpoint called`, {
    conversationId,
    outcome,
    notes,
    body: req.body,
    user: req.caregiver?.id,
    timestamp: new Date().toISOString()
  });

  const conversation = await conversationService.getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }

  // Get the Call record
  const call = await Call.findById(conversation.callId);
  if (!call) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Call not found for conversation');
  }

  // Actually terminate the call by finding the connection and disconnecting everything
  try {
    const { getOpenAIServiceInstance } = require('../services/openai.realtime.service');
    const openAIService = getOpenAIServiceInstance();
    
    // Find the connection by conversationId (same approach as getCallStatus)
    let connectionFound = false;
    let callIdToDisconnect = null;
    
    for (const [callId, conn] of openAIService.connections.entries()) {
      if (conn.conversationId && conn.conversationId.toString() === conversationId.toString()) {
        callIdToDisconnect = callId;
        connectionFound = true;
        logger.info(`[CallWorkflow] Found connection for conversation ${conversationId} with callId: ${callId}`);
        break;
      }
    }
    
    if (callIdToDisconnect) {
      // Step 1: Cancel OpenAI response and disconnect OpenAI WebSocket
      // This ensures any active AI responses are canceled and the WebSocket is closed cleanly
      // Note: channelTracker.cleanupCall will also try to disconnect OpenAI, but that's fine - disconnect is idempotent
      await openAIService.disconnect(callIdToDisconnect);
      logger.info(`[CallWorkflow] Disconnected OpenAI WebSocket for callId ${callIdToDisconnect}`);
      
      // Step 2: Cleanup Asterisk channels (RTP listeners, RTP sender, ports, etc.)
      // This should happen before hanging up Twilio to ensure all resources are released
      // channelTracker.cleanupCall will also disconnect OpenAI again (idempotent) and update the call
      if (call.asteriskChannelId) {
        try {
          const { channelTracker } = require('../services');
          await channelTracker.cleanupCall(call.asteriskChannelId, 'Call ended by agent');
          logger.info(`[CallWorkflow] Cleaned up Asterisk channel ${call.asteriskChannelId}`);
        } catch (err) {
          logger.warn(`[CallWorkflow] Error cleaning up Asterisk channel: ${err.message}`);
          // Continue with Twilio hangup even if Asterisk cleanup fails
        }
      }
      
      // Step 3: Hang up the Twilio call (this terminates the actual phone call)
      // This should be last because it's the final step that ends the call
      // After this, Twilio will send webhooks indicating the call has ended
      if (call.callSid) {
        try {
          logger.info(`[CallWorkflow] Attempting to hang up Twilio call ${call.callSid}`);
          await twilioCallService.hangupCall(call.callSid);
          logger.info(`[CallWorkflow] Successfully hung up Twilio call ${call.callSid}`);
        } catch (err) {
          logger.error(`[CallWorkflow] FAILED to hang up Twilio call ${call.callSid}: ${err.message}`);
          logger.error(`[CallWorkflow] Twilio hangup error stack: ${err.stack}`);
          // Continue with call update even if Twilio hangup fails, but log as error
        }
      } else {
        logger.warn(`[CallWorkflow] No callSid found in call ${call._id} - cannot hang up Twilio call`);
      }
    } else {
      logger.warn(`[CallWorkflow] No active connection found for conversation ${conversationId}`);
      // Try fallback: disconnect by callSid or asteriskChannelId if connection not found by conversationId
      if (call.callSid) {
        try {
          await openAIService.disconnect(call.callSid);
          logger.info(`[CallWorkflow] Disconnected OpenAI WebSocket using callSid fallback: ${call.callSid}`);
        } catch (err) {
          logger.warn(`[CallWorkflow] Fallback disconnect by callSid failed: ${err.message}`);
        }
      } else if (call.asteriskChannelId) {
        try {
          await openAIService.disconnect(call.asteriskChannelId);
          logger.info(`[CallWorkflow] Disconnected OpenAI WebSocket using asteriskChannelId fallback: ${call.asteriskChannelId}`);
        } catch (err) {
          logger.warn(`[CallWorkflow] Fallback disconnect by asteriskChannelId failed: ${err.message}`);
        }
      }
      
      // Even if connection not found, still try to hangup Twilio and cleanup Asterisk
      if (call.asteriskChannelId) {
        try {
          const { channelTracker } = require('../services');
          await channelTracker.cleanupCall(call.asteriskChannelId, 'Call ended by agent');
          logger.info(`[CallWorkflow] Cleaned up Asterisk channel ${call.asteriskChannelId} (fallback)`);
        } catch (err) {
          logger.warn(`[CallWorkflow] Error cleaning up Asterisk channel (fallback): ${err.message}`);
        }
      }
      
      if (call.callSid) {
        try {
          await twilioCallService.hangupCall(call.callSid);
          logger.info(`[CallWorkflow] Hung up Twilio call ${call.callSid} (fallback)`);
        } catch (err) {
          logger.error(`[CallWorkflow] Error hanging up Twilio call (fallback): ${err.message}`);
          // Don't swallow the error - log it as error so we can see it
        }
      }
    }
  } catch (err) {
    logger.error(`[CallWorkflow] Error terminating call: ${err.message}`);
    // Continue with call update even if disconnect fails
  }

  // Update call status
  call.status = 'completed';
  call.callStatus = 'ended';
  if (notes) call.callNotes = notes;
  if (outcome) call.callOutcome = outcome;

  if (call.startTime) {
    call.endTime = new Date();
    call.callEndTime = new Date();
    call.duration = Math.round((call.endTime - call.startTime) / 1000);
    call.callDuration = call.duration;
  }

  await call.save();
  logger.info(`[CallWorkflow] Ended call for conversation ${conversationId} with outcome: ${outcome}`);

  // Return conversation with call data populated
  await conversation.populate('callId');
  res.status(httpStatus.OK).send(ConversationDTO(conversation));
});

/**
 * Get active calls for the current agent
 * @route GET /api/v1/calls/active
 */
const getActiveCalls = catchAsync(async (req, res) => {
  const agentId = req.caregiver.id;
  
  // Get active calls for this agent (Call model tracks call status)
  const activeCalls = await Call.find({
    agentId,
    status: { $in: ['initiated', 'in-progress'] }
  })
  .populate('patientId', 'name phone')
  .populate('agentId', 'name')
  .populate('conversationId')
  .limit(50)
  .lean();
  
  // Map to include conversation data if it exists
  const callsWithConversations = await Promise.all(
    activeCalls.map(async (call) => {
      if (call.conversationId) {
        const conversation = await Conversation.findById(call.conversationId).lean();
        return { ...call, conversation };
      }
      return call;
    })
  );
  
  res.status(httpStatus.OK).send({
    data: callsWithConversations,
    count: callsWithConversations.length
  });
});

/**
 * Get conversation with call details
 * @route GET /api/v1/calls/:conversationId/conversation
 */
const getConversationWithCallDetails = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  
  const conversation = await conversationService.getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  
  // Get the Call record for call details
  const call = await Call.findById(conversation.callId);
  if (!call) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Call not found for conversation');
  }
  
  // Populate patient and agent details
  await conversation.populate('patientId', 'name phone');
  await call.populate('patientId', 'name phone');
  await call.populate('agentId', 'name');
  
  const callDetails = {
    conversationId: conversation._id,
    callId: call._id,
    status: call.status,
    callStatus: call.callStatus,
    startTime: call.startTime,
    endTime: call.endTime,
    duration: call.duration,
    patient: conversation.patientId || call.patientId,
    agent: call.agentId
  };
  
  res.status(httpStatus.OK).send({ data: callDetails });
});

module.exports = {
  initiateCall,
  getCallStatus,
  updateCallStatus,
  endCall,
  getActiveCalls,
  getConversationWithCallDetails,
};
