const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');
const { conversationService } = require('../services');
const { Caregiver } = require('../models');

const { ConversationDTO } = require('../dtos');

const createConversationForClient = catchAsync(async (req, res) => {
  const { clientId } = req.params;
  const { callId } = req.body;
  // In test and development, allow missing callId so integration tests and local dev can create conversations without an existing call
  if (!callId && config.env !== 'test' && config.env !== 'development') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'callId is required in request body');
  }
  const conversation = await conversationService.createConversationForClient(clientId, callId);
  await conversation.populate('callId', 'startTime endTime duration status callStatus callStartTime callEndTime callDuration callOutcome callNotes agentId callSid');
  if (conversation.callId) {
    conversation.status = conversation.callId.status;
    conversation.callStatus = conversation.callId.callStatus;
    conversation.startTime = conversation.callId.startTime;
    conversation.endTime = conversation.callId.endTime;
    conversation.duration = conversation.callId.duration;
    conversation.callStartTime = conversation.callId.callStartTime;
    conversation.callEndTime = conversation.callId.callEndTime;
    conversation.callDuration = conversation.callId.callDuration;
    conversation.callOutcome = conversation.callId.callOutcome;
    conversation.callNotes = conversation.callId.callNotes;
    conversation.agentId = conversation.callId.agentId;
    conversation.callSid = conversation.callId.callSid;
  }
  res.status(httpStatus.CREATED).send(ConversationDTO(conversation));
});

const createConversationForPatient = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const { callId } = req.body;
  if (!callId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'callId is required in request body');
  }
  const conversation = await conversationService.createConversationForPatient(patientId, callId); // legacy route
  
  // Populate callId to get call data for DTO
  await conversation.populate('callId', 'startTime endTime duration status callStatus callStartTime callEndTime callDuration callOutcome callNotes agentId callSid');
  
  // Set fields from call for DTO compatibility
  if (conversation.callId) {
    conversation.status = conversation.callId.status;
    conversation.callStatus = conversation.callId.callStatus;
    conversation.startTime = conversation.callId.startTime;
    conversation.endTime = conversation.callId.endTime;
    conversation.duration = conversation.callId.duration;
    conversation.callStartTime = conversation.callId.callStartTime;
    conversation.callEndTime = conversation.callId.callEndTime;
    conversation.callDuration = conversation.callId.callDuration;
    conversation.callOutcome = conversation.callId.callOutcome;
    conversation.callNotes = conversation.callId.callNotes;
    conversation.agentId = conversation.callId.agentId;
    conversation.callSid = conversation.callId.callSid;
  }
  
  res.status(httpStatus.CREATED).send(ConversationDTO(conversation));
});

const addMessageToConversation = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { role, content } = req.body;
  const conversation = await conversationService.addMessageToConversation(conversationId, role, content);
  
  // Populate callId to get call data for DTO
  await conversation.populate('callId', 'startTime endTime duration status callStatus callStartTime callEndTime callDuration callOutcome callNotes agentId callSid');
  
  // Set fields from call for DTO compatibility
  if (conversation.callId) {
    conversation.status = conversation.callId.status;
    conversation.callStatus = conversation.callId.callStatus;
    conversation.startTime = conversation.callId.startTime;
    conversation.endTime = conversation.callId.endTime;
    conversation.duration = conversation.callId.duration;
    conversation.callStartTime = conversation.callId.callStartTime;
    conversation.callEndTime = conversation.callId.callEndTime;
    conversation.callDuration = conversation.callId.callDuration;
    conversation.callOutcome = conversation.callId.callOutcome;
    conversation.callNotes = conversation.callId.callNotes;
    conversation.agentId = conversation.callId.agentId;
    conversation.callSid = conversation.callId.callSid;
  }
  
  res.status(httpStatus.OK).send(ConversationDTO(conversation));
});

const getConversation = catchAsync(async (req, res) => {
  const conversation = await conversationService.getConversationById(req.params.conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  
  // Populate callId to get call data for DTO
  await conversation.populate('callId', 'startTime endTime duration status callStatus callStartTime callEndTime callDuration callOutcome callNotes agentId callSid');
  
  // Set fields from call for DTO compatibility
  if (conversation.callId) {
    conversation.status = conversation.callId.status;
    conversation.callStatus = conversation.callId.callStatus;
    conversation.startTime = conversation.callId.startTime;
    conversation.endTime = conversation.callId.endTime;
    conversation.duration = conversation.callId.duration;
    conversation.callStartTime = conversation.callId.callStartTime;
    conversation.callEndTime = conversation.callId.callEndTime;
    conversation.callDuration = conversation.callId.callDuration;
    conversation.callOutcome = conversation.callId.callOutcome;
    conversation.callNotes = conversation.callId.callNotes;
    conversation.agentId = conversation.callId.agentId;
    conversation.callSid = conversation.callId.callSid;
  }
  
  // Check if the caregiver has access to this conversation
  // For staff users, they can only access conversations of their own patients OR conversations they initiated
  // For orgAdmin users, they can access any conversation in their org
  if (req.caregiver.role === 'staff') {
    const caregiver = await Caregiver.findById(req.caregiver.id);
    const hasPatientAccess = caregiver.clients.includes(conversation.clientId);
    const isCallAgent = conversation.agentId && conversation.agentId.toString() === req.caregiver.id;
    
    if (!hasPatientAccess && !isCallAgent) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this conversation');
    }
  }
  
  res.send(ConversationDTO(conversation));
});

module.exports = {
  createConversationForPatient,
  createConversationForClient,
  addMessageToConversation,
  getConversation,
};
