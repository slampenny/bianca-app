const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { conversationService } = require('../services');

const { ConversationDTO } = require('../dtos');

const createConversationForPatient = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const conversation = await conversationService.createConversationForPatient(patientId);
  res.status(httpStatus.CREATED).send(ConversationDTO(conversation));
});

const addMessageToConversation = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { role, message } = req.body;
  const conversation = await conversationService.addMessageToConversation(conversationId, role, message);
  res.status(httpStatus.OK).send(ConversationDTO(conversation));
});

const getConversation = catchAsync(async (req, res) => {
  const conversation = await conversationService.getConversationById(req.params.conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  res.send(ConversationDTO(conversation));
});

module.exports = {
  createConversationForPatient,
  addMessageToConversation,
  getConversation,
};
