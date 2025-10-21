// sentiment.dto.js

const SentimentAnalysisDTO = (sentimentData) => {
  if (!sentimentData) return null;

  const {
    overallSentiment,
    sentimentScore,
    confidence,
    patientMood,
    keyEmotions,
    concernLevel,
    satisfactionIndicators,
    summary,
    recommendations,
    fallback
  } = sentimentData;

  return {
    overallSentiment,
    sentimentScore,
    confidence,
    patientMood,
    keyEmotions,
    concernLevel,
    satisfactionIndicators,
    summary,
    recommendations,
    fallback: fallback || false
  };
};

const SentimentTrendPointDTO = (conversation) => {
  const {
    _id,
    startTime,
    endTime,
    duration,
    analyzedData
  } = conversation;

  console.log(`[SentimentTrendPointDTO] Processing conversation:`, {
    _id,
    analyzedData,
    hasSentiment: !!analyzedData?.sentiment,
    sentimentValue: analyzedData?.sentiment
  });

  return {
    conversationId: _id,
    date: endTime || startTime,
    duration,
    sentiment: analyzedData?.sentiment ? SentimentAnalysisDTO(analyzedData.sentiment) : null,
    sentimentAnalyzedAt: analyzedData?.sentimentAnalyzedAt
  };
};

const SentimentTrendDTO = (trendData) => {
  const {
    patientId,
    timeRange,
    startDate,
    endDate,
    totalConversations,
    analyzedConversations,
    dataPoints,
    summary
  } = trendData;

  return {
    patientId,
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


