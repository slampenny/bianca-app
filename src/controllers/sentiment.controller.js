const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { conversationService } = require('../services');
const { Caregiver } = require('../models');

const { SentimentTrendDTO, SentimentSummaryDTO } = require('../dtos');

/**
 * Get sentiment trend for a patient over time
 */
const getSentimentTrend = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const { timeRange = 'lastCall' } = req.query;

  // Validate timeRange parameter
  if (!['lastCall', 'month', 'lifetime'].includes(timeRange)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid timeRange. Must be one of: lastCall, month, lifetime');
  }

  // Check if the caregiver has access to this patient
  if (req.caregiver.role === 'staff') {
    const caregiver = await Caregiver.findById(req.caregiver.id);
    if (!caregiver.patients.includes(patientId)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this patient');
    }
  }

  const trendData = await conversationService.getSentimentTrend(patientId, timeRange);
  res.send(SentimentTrendDTO(trendData));
});

/**
 * Get sentiment summary for a patient
 */
const getSentimentSummary = catchAsync(async (req, res) => {
  const { patientId } = req.params;

  // Check if the caregiver has access to this patient
  if (req.caregiver.role === 'staff') {
    const caregiver = await Caregiver.findById(req.caregiver.id);
    if (!caregiver.patients.includes(patientId)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this patient');
    }
  }

  const summaryData = await conversationService.getSentimentSummary(patientId);
  res.send(SentimentSummaryDTO(summaryData));
});

/**
 * Get sentiment analysis for a specific conversation
 */
const getConversationSentiment = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  // Get the conversation first to check access
  const conversation = await conversationService.getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }

  // Check if the caregiver has access to this conversation
  if (req.caregiver.role === 'staff') {
    const caregiver = await Caregiver.findById(req.caregiver.id);
    if (!caregiver.patients.includes(conversation.patientId)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this conversation');
    }
  }

  // Return sentiment data if available
  const sentimentData = conversation.analyzedData?.sentiment || null;
  const sentimentAnalyzedAt = conversation.analyzedData?.sentimentAnalyzedAt || null;

  res.send({
    conversationId,
    sentiment: sentimentData,
    sentimentAnalyzedAt: sentimentAnalyzedAt ? new Date(sentimentAnalyzedAt).toISOString() : null,
    hasSentimentAnalysis: !!sentimentData
  });
});

/**
 * Trigger sentiment analysis for a specific conversation
 */
const analyzeConversationSentiment = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  // Get the conversation first to check access
  const conversation = await conversationService.getConversationById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }

  // Check if the caregiver has access to this conversation
  if (req.caregiver.role === 'staff') {
    const caregiver = await Caregiver.findById(req.caregiver.id);
    if (!caregiver.patients.includes(conversation.patientId)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this conversation');
    }
  }

  // Check if conversation is completed
  if (conversation.status !== 'completed') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Can only analyze sentiment for completed conversations');
  }

  // Trigger sentiment analysis
  const { getOpenAISentimentServiceInstance } = require('../services/openai.sentiment.service');
  const sentimentService = getOpenAISentimentServiceInstance();
  
  const analysisResult = await sentimentService.analyzeConversationSentiment(conversationId, {
    detailed: true
  });

  if (analysisResult.success) {
    res.send({
      success: true,
      conversationId,
      sentiment: analysisResult.data,
      analyzedAt: new Date().toISOString()
    });
  } else {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Sentiment analysis failed: ${analysisResult.error}`);
  }
});

module.exports = {
  getSentimentTrend,
  getSentimentSummary,
  getConversationSentiment,
  analyzeConversationSentiment
};

