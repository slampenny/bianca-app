const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { conversationService } = require('../services');
const { Caregiver } = require('../models');

const { ConversationDTO } = require('../dtos');

const createConversationForPatient = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const conversation = await conversationService.createConversationForPatient(patientId);
  res.status(httpStatus.CREATED).send(ConversationDTO(conversation));
});

const addMessageToConversation = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { role, content } = req.body;
  const conversation = await conversationService.addMessageToConversation(conversationId, role, content);
  res.status(httpStatus.OK).send(ConversationDTO(conversation));
});

const getConversation = catchAsync(async (req, res) => {
  const conversation = await conversationService.getConversationById(req.params.conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  
  // Check if the caregiver has access to this conversation
  // For staff users, they can only access conversations of their own patients
  // For orgAdmin users, they can access any conversation in their org
  if (req.caregiver.role === 'staff') {
    const caregiver = await Caregiver.findById(req.caregiver.id);
    if (!caregiver.patients.includes(conversation.patientId)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this conversation');
    }
  }
  
  res.send(ConversationDTO(conversation));
});

module.exports = {
  createConversationForPatient,
  addMessageToConversation,
  getConversation,
};
