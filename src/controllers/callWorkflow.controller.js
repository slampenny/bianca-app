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
  
  // Ensure messages are fully populated (in case they weren't from getConversationById)
  // This is important for realtime calls where messages might be added dynamically
  if (conversation.messages && conversation.messages.length > 0) {
    // Check if messages are already populated (have content property) or are just ObjectIds
    const firstMessage = conversation.messages[0];
    if (!firstMessage || !firstMessage.content) {
      // Messages are not populated, populate them now
      await conversation.populate('messages');
    }
  }
  
  // For active calls, also check Message collection directly to ensure we get all latest messages
  // This is important because messages might be saved to Message collection before conversation.messages is updated
  const { Message } = require('../models');
  let allMessages = conversation.messages || [];
  
  // If this is an active call, also query Message collection to ensure we have all messages
  if (conversation.status === 'in-progress' || conversation.status === 'initiated') {
    const directMessages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();
    
    // Merge messages from both sources, removing duplicates by message ID
    const messageMap = new Map();
    
    // Add messages from conversation.messages (populated)
    allMessages.forEach(msg => {
      const msgId = msg._id?.toString() || msg.id?.toString();
      if (msgId) {
        messageMap.set(msgId, msg);
      }
    });
    
    // Add/update with messages from Message collection (might be more up-to-date)
    directMessages.forEach(msg => {
      const msgId = msg._id?.toString();
      if (msgId) {
        messageMap.set(msgId, msg);
      }
    });
    
    // Convert back to array and sort by createdAt
    allMessages = Array.from(messageMap.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return timeA - timeB;
    });
    
    logger.debug(`[CallStatus] Merged messages: ${conversation.messages?.length || 0} from conversation, ${directMessages.length} from Message collection, ${allMessages.length} total`);
  }
  
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
  
  // Log message details for debugging
  logger.debug(`[CallStatus] Returning ${messages.length} messages for conversation ${conversationId}`, {
    messageCount: messages.length,
    patientMessageCount: messages.filter(m => m.role === 'patient').length,
    assistantMessageCount: messages.filter(m => m.role === 'assistant').length,
    messageRoles: messages.map(m => m.role)
  });
  
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
