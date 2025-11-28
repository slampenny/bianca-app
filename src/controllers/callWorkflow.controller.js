const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { conversationService, twilioCallService, patientService, caregiverService } = require('../services');
const { ConversationDTO } = require('../dtos');
const { Conversation } = require('../models');
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
    
    // Find the conversation created by Twilio service, or create one if it doesn't exist
    conversation = await Conversation.findOne({ callSid });
    if (!conversation) {
      // Create conversation if Twilio service didn't create one (e.g., in test environment)
      conversation = new Conversation({
        callSid,
        patientId: patient.id,
        startTime: new Date(),
        callType: 'wellness-check',
        status: 'initiated'
      });
    }
    
    // Add call workflow-specific fields
    conversation.agentId = agentId;
    conversation.callNotes = callNotes;
    conversation.status = 'in-progress';
    conversation.startTime = new Date();
    conversation.callType = 'outbound';
    await conversation.save();

    logger.info(`[CallWorkflow] Call initiated for patient ${patient.name}, SID: ${callSid}`);

    res.status(httpStatus.CREATED).send({
      conversationId: conversation._id,
      callSid,
      patientId: patient._id,
      patientName: patient.name,
      patientPhone: patient.phone,
      agentId: agent._id,
      agentName: agent.name,
      callStatus: conversation.status,
    });

  } catch (error) {
    logger.error(`[CallWorkflow] Failed to initiate call for patient ${patient.name}:`, error);
    
    // Update conversation status to failed
    if (conversation) {
      conversation.status = 'failed';
      await conversation.save();
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
  
  // Populate patient and agent details
  await conversation.populate('patientId', 'name phone');
  await conversation.populate('agentId', 'name');
  
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
    status: conversation.status,
    startTime: conversation.startTime,
    endTime: conversation.endTime,
    duration: conversation.duration,
    patient: conversation.patientId,
    agent: conversation.agentId,
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

  // Map call status to conversation status
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
  
  const conversationStatus = statusMapping[status] || 'in-progress';
  conversation.status = conversationStatus;
  if (notes) conversation.callNotes = notes;

  // Handle call end
  if (['ended', 'failed', 'busy', 'no_answer'].includes(status)) {
    conversation.endTime = new Date();
    if (conversation.startTime) {
      conversation.duration = Math.round((conversation.endTime - conversation.startTime) / 1000);
    }
  }

  await conversation.save();

  logger.info(`[CallWorkflow] Updated call status for conversation ${conversationId} to ${status}`);

  res.status(httpStatus.OK).send(ConversationDTO(conversation));
});

/**
 * End a call
 * @route POST /api/v1/calls/:conversationId/end
 */
const endCall = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { outcome, notes } = req.body;

  const conversation = await conversationService.getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }

  // Actually terminate the call by finding the connection and disconnecting everything
  try {
    const { getOpenAIRealtimeServiceInstance } = require('../services/openai.realtime.service');
    const openAIService = getOpenAIRealtimeServiceInstance();
    
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
      // channelTracker.cleanupCall will also disconnect OpenAI again (idempotent) and update the conversation
      if (conversation.asteriskChannelId) {
        try {
          const { channelTracker } = require('../services');
          await channelTracker.cleanupCall(conversation.asteriskChannelId, 'Call ended by agent');
          logger.info(`[CallWorkflow] Cleaned up Asterisk channel ${conversation.asteriskChannelId}`);
        } catch (err) {
          logger.warn(`[CallWorkflow] Error cleaning up Asterisk channel: ${err.message}`);
          // Continue with Twilio hangup even if Asterisk cleanup fails
        }
      }
      
      // Step 3: Hang up the Twilio call (this terminates the actual phone call)
      // This should be last because it's the final step that ends the call
      // After this, Twilio will send webhooks indicating the call has ended
      if (conversation.callSid) {
        try {
          logger.info(`[CallWorkflow] Attempting to hang up Twilio call ${conversation.callSid}`);
          await twilioCallService.hangupCall(conversation.callSid);
          logger.info(`[CallWorkflow] Successfully hung up Twilio call ${conversation.callSid}`);
        } catch (err) {
          logger.error(`[CallWorkflow] FAILED to hang up Twilio call ${conversation.callSid}: ${err.message}`);
          logger.error(`[CallWorkflow] Twilio hangup error stack: ${err.stack}`);
          // Continue with conversation update even if Twilio hangup fails, but log as error
        }
      } else {
        logger.warn(`[CallWorkflow] No callSid found in conversation ${conversationId} - cannot hang up Twilio call`);
      }
    } else {
      logger.warn(`[CallWorkflow] No active connection found for conversation ${conversationId}`);
      // Try fallback: disconnect by callSid or asteriskChannelId if connection not found by conversationId
      if (conversation.callSid) {
        try {
          await openAIService.disconnect(conversation.callSid);
          logger.info(`[CallWorkflow] Disconnected OpenAI WebSocket using callSid fallback: ${conversation.callSid}`);
        } catch (err) {
          logger.warn(`[CallWorkflow] Fallback disconnect by callSid failed: ${err.message}`);
        }
      } else if (conversation.asteriskChannelId) {
        try {
          await openAIService.disconnect(conversation.asteriskChannelId);
          logger.info(`[CallWorkflow] Disconnected OpenAI WebSocket using asteriskChannelId fallback: ${conversation.asteriskChannelId}`);
        } catch (err) {
          logger.warn(`[CallWorkflow] Fallback disconnect by asteriskChannelId failed: ${err.message}`);
        }
      }
      
      // Even if connection not found, still try to hangup Twilio and cleanup Asterisk
      if (conversation.asteriskChannelId) {
        try {
          const { channelTracker } = require('../services');
          await channelTracker.cleanupCall(conversation.asteriskChannelId, 'Call ended by agent');
          logger.info(`[CallWorkflow] Cleaned up Asterisk channel ${conversation.asteriskChannelId} (fallback)`);
        } catch (err) {
          logger.warn(`[CallWorkflow] Error cleaning up Asterisk channel (fallback): ${err.message}`);
        }
      }
      
      if (conversation.callSid) {
        try {
          await twilioCallService.hangupCall(conversation.callSid);
          logger.info(`[CallWorkflow] Hung up Twilio call ${conversation.callSid} (fallback)`);
        } catch (err) {
          logger.error(`[CallWorkflow] Error hanging up Twilio call (fallback): ${err.message}`);
          // Don't swallow the error - log it as error so we can see it
        }
      }
    }
  } catch (err) {
    logger.error(`[CallWorkflow] Error terminating call: ${err.message}`);
    // Continue with conversation update even if disconnect fails
  }

  conversation.status = 'completed';
  if (notes) conversation.callNotes = notes;

  if (conversation.startTime) {
    conversation.endTime = new Date();
    conversation.duration = Math.round((conversation.endTime - conversation.startTime) / 1000);
  }

  await conversation.save();
  logger.info(`[CallWorkflow] Ended call for conversation ${conversationId} with outcome: ${outcome}`);

  res.status(httpStatus.OK).send(ConversationDTO(conversation));
});

/**
 * Get active calls for the current agent
 * @route GET /api/v1/calls/active
 */
const getActiveCalls = catchAsync(async (req, res) => {
  const agentId = req.caregiver.id;
  
  // Get conversations that are active calls for this agent
  const activeCalls = await Conversation.find({
    agentId,
    status: { $in: ['initiated', 'in-progress'] }
  })
  .populate('patientId', 'name phone')
  .populate('agentId', 'name')
  .limit(50)
  .lean();
  
  res.status(httpStatus.OK).send({
    data: activeCalls.map(call => ConversationDTO(call)),
    count: activeCalls.length
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
  
  // Populate patient and agent details
  await conversation.populate('patientId', 'name phone');
  await conversation.populate('agentId', 'name');
  
  const callDetails = {
    conversationId: conversation._id,
    status: conversation.status,
    startTime: conversation.startTime,
    endTime: conversation.endTime,
    duration: conversation.duration,
    patient: conversation.patientId,
    agent: conversation.agentId
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
