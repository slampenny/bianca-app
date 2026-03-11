// sentiment.dto.js

const SentimentAnalysisDTO = (sentimentData) => {
  if (!sentimentData) return null;

  const {
    overallSentiment,
    sentimentScore,
    confidence,
    clientMood,
    patientMood,
    keyEmotions,
    concernLevel,
    satisfactionIndicators,
    summary,
    recommendations,
    fallback
  } = sentimentData;
  const mood = clientMood ?? patientMood;

  return {
    overallSentiment,
    sentimentScore,
    confidence,
    clientMood: mood,
    patientMood: mood, // legacy alias
    keyEmotions,
    concernLevel,
    satisfactionIndicators,
    summary,
    recommendations,
    fallback: fallback || false
  };
};

const SentimentTrendPointDTO = (conversation) => {
  const { _id, analyzedData } = conversation;
  // Date and duration live on the Call, not Conversation (callId is populated with endTime, startTime, duration)
  const call = conversation.callId;
  const endTime = call?.endTime;
  const startTime = call?.startTime;
  const duration = call?.duration ?? call?.callDuration ?? 0;

  return {
    conversationId: _id,
    date: endTime || startTime,
    duration: typeof duration === 'number' ? duration : 0,
    sentiment: analyzedData?.sentiment ? SentimentAnalysisDTO(analyzedData.sentiment) : null,
    sentimentAnalyzedAt: analyzedData?.sentimentAnalyzedAt
  };
};

const SentimentTrendDTO = (trendData) => {
  const {
    clientId,
    timeRange,
    startDate,
    endDate,
    totalConversations,
    analyzedConversations,
    dataPoints,
    summary
  } = trendData;

  const id = clientId != null ? clientId : trendData.clientId;
  return {
    clientId: id,
    timeRange,
    startDate: startDate ? new Date(startDate).toISOString() : null,
    endDate: endDate ? new Date(endDate).toISOString() : null,
    totalConversations,
    analyzedConversations,
    dataPoints: dataPoints.map(SentimentTrendPointDTO),
    summary: {
      averageSentiment: summary?.averageSentiment || 0,
      sentimentDistribution: summary?.sentimentDistribution || {},
      trendDirection: summary?.trendDirection || 'stable',
      confidence: summary?.confidence || 0,
      keyInsights: summary?.keyInsights || []
    }
  };
};

const SentimentSummaryDTO = (summaryData) => {
  const {
    totalConversations,
    analyzedConversations,
    averageSentiment,
    sentimentDistribution,
    trendDirection,
    confidence,
    keyInsights,
    recentTrend
  } = summaryData;

  return {
    totalConversations,
    analyzedConversations,
    averageSentiment,
    sentimentDistribution,
    trendDirection,
    confidence,
    keyInsights,
    recentTrend: recentTrend ? recentTrend.map(SentimentTrendPointDTO) : []
  };
};

module.exports = {
  SentimentAnalysisDTO,
  SentimentTrendPointDTO,
  SentimentTrendDTO,
  SentimentSummaryDTO
};


