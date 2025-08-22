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
    conversation.callStatus = 'ringing';
    conversation.callStartTime = new Date();
    conversation.callType = 'outbound';
    await conversation.save();

    logger.info(`[CallWorkflow] Call initiated for patient ${patient.name}, SID: ${callSid}`);

    res.status(httpStatus.CREATED).send({
      success: true,
      data: {
        conversationId: conversation._id,
        callSid,
        patientId: patient._id,
        patientName: patient.name,
        patientPhone: patient.phone,
        agentId: agent._id,
        agentName: agent.name,
        callStatus: conversation.callStatus,
      },
      message: 'Call initiated successfully'
    });

  } catch (error) {
    logger.error(`[CallWorkflow] Failed to initiate call for patient ${patient.name}:`, error);
    
    // Update conversation status to failed
    if (conversation) {
      conversation.callStatus = 'failed';
      conversation.callOutcome = 'failed';
      conversation.callEndTime = new Date();
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
  
  const status = {
    conversationId: conversation._id,
    callStatus: conversation.callStatus,
    callStartTime: conversation.callStartTime,
    callEndTime: conversation.callEndTime,
    callDuration: conversation.callDuration,
    callOutcome: conversation.callOutcome,
    callNotes: conversation.callNotes,
    patient: conversation.patientId,
    agent: conversation.agentId,
    status: conversation.status
  };
  
  res.status(httpStatus.OK).send({
    success: true,
    data: status
  });
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

  // Update call status
  conversation.callStatus = status;
  if (outcome) conversation.callOutcome = outcome;
  if (notes) conversation.callNotes = notes;

  // Handle call end
  if (['ended', 'failed', 'busy', 'no_answer'].includes(status)) {
    conversation.callEndTime = new Date();
    if (conversation.callStartTime) {
      conversation.callDuration = Math.round((conversation.callEndTime - conversation.callStartTime) / 1000);
    }
  }

  await conversation.save();

  logger.info(`[CallWorkflow] Updated call status for conversation ${conversationId} to ${status}`);

  res.status(httpStatus.OK).send({
    success: true,
    data: ConversationDTO(conversation),
    message: 'Call status updated successfully'
  });
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

  conversation.callStatus = 'ended';
  conversation.callOutcome = outcome;
  conversation.callEndTime = new Date();
  if (notes) conversation.callNotes = notes;
  conversation.status = 'completed';

  if (conversation.callStartTime) {
    conversation.callDuration = Math.round((conversation.callEndTime - conversation.callStartTime) / 1000);
  }

  await conversation.save();
  logger.info(`[CallWorkflow] Ended call for conversation ${conversationId} with outcome: ${outcome}`);

  res.status(httpStatus.OK).send({
    success: true,
    data: ConversationDTO(conversation),
    message: 'Call ended successfully'
  });
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
    callStatus: { $in: ['initiating', 'ringing', 'answered', 'connected'] }
  })
  .populate('patientId', 'name phone')
  .populate('agentId', 'name')
  .limit(50)
  .lean();
  
  res.status(httpStatus.OK).send({
    success: true,
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
    callStatus: conversation.callStatus,
    callStartTime: conversation.callStartTime,
    callEndTime: conversation.callEndTime,
    callDuration: conversation.callDuration,
    callOutcome: conversation.callOutcome,
    callNotes: conversation.callNotes,
    patient: conversation.patientId,
    agent: conversation.agentId,
    status: conversation.status
  };
  
  res.status(httpStatus.OK).send({
    success: true,
    data: callDetails
  });
});

module.exports = {
  initiateCall,
  getCallStatus,
  updateCallStatus,
  endCall,
  getActiveCalls,
  getConversationWithCallDetails,
};
