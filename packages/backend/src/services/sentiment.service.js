const { Conversation } = require('../models');
const logger = require('../config/logger');

/**
 * Calculate linear trend from sentiment scores
 * @param {Array<number>} scores - Array of sentiment scores
 * @returns {string} - 'improving', 'declining', or 'stable'
 */
const calculateLinearTrend = (scores) => {
  if (scores.length < 2) return 'stable';
  
  const n = scores.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = scores;
  
  // Calculate means
  const xMean = x.reduce((sum, val) => sum + val, 0) / n;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate slope (m)
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += Math.pow(x[i] - xMean, 2);
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  
  // Determine trend direction
  if (slope > 0.05) return 'improving';
  if (slope < -0.05) return 'declining';
  return 'stable';
};

/**
 * Calculate variance of sentiment scores
 * @param {Array<number>} scores - Array of sentiment scores
 * @returns {number} - Variance value
 */
const calculateVariance = (scores) => {
  if (scores.length < 2) return 0;
  
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  
  return variance;
};

/**
 * Get sentiment trend data for a patient over a specified time range
 * @param {string} patientId - The patient ID
 * @param {string} timeRange - Time range: 'lastCall', 'month', or 'lifetime'
 * @returns {Promise<Object>} Sentiment trend data
 */
const getSentimentTrend = async (patientId, timeRange = 'lastCall') => {
  try {
    const now = new Date();
    let startDate;

    // Calculate start date based on time range
    switch (timeRange) {
      case 'lastCall':
        // For lastCall, we'll get the most recent conversation with sentiment analysis
        // Use Call's endTime by populating callId
        const lastConversation = await Conversation.findOne({
          patientId,
          'analyzedData.sentiment': { $exists: true }
        })
        .populate('callId', 'endTime')
        .select('callId')
        .lean();
        
        if (lastConversation?.callId?.endTime) {
          // Get conversations from the last call date to now
          startDate = lastConversation.callId.endTime;
        } else {
          // No conversations with sentiment analysis, return empty data
          return {
            patientId,
            timeRange,
            startDate: now.toISOString(),
            endDate: now.toISOString(),
            totalConversations: 0,
            analyzedConversations: 0,
            dataPoints: [],
            summary: {
              averageSentiment: 0,
              sentimentDistribution: {},
              trendDirection: 'stable',
              confidence: 0,
              keyInsights: []
            }
          };
        }
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'lifetime':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }

    // Get conversations with sentiment analysis for the patient
    // Use Call's endTime by populating callId
    let conversations = await Conversation.find({
      patientId,
      'analyzedData.sentiment': { $exists: true }
    })
      .populate('callId', 'endTime startTime duration status')
      .select('_id analyzedData callId')
      .lean();
    
    // Filter by Call's endTime
    conversations = conversations.filter(conv => {
      const callEndTime = conv.callId?.endTime;
      return callEndTime && callEndTime >= startDate && callEndTime <= now;
    });
    
    // Sort by Call's endTime
    conversations.sort((a, b) => {
      const aTime = a.callId?.endTime || 0;
      const bTime = b.callId?.endTime || 0;
      return aTime - bTime;
    });

    // Get all conversations (including those without sentiment) for total count
    // Count conversations where Call's endTime is within range
    const allConversations = await Conversation.find({ patientId })
      .populate('callId', 'endTime')
      .lean();
    const totalConversations = allConversations.filter(conv => {
      const callEndTime = conv.callId?.endTime;
      return callEndTime && callEndTime >= startDate && callEndTime <= now;
    }).length;

    // Return raw conversation data for DTO transformation
    const dataPoints = conversations; // Return raw conversations, let DTO handle transformation

    logger.debug('SentimentTrend sample data', {
      sampleConversation: dataPoints[0] ? {
        id: dataPoints[0]._id,
        date: dataPoints[0].date
      } : null,
      sampleSentiment: dataPoints[0]?.analyzedData?.sentiment
    });

    // Calculate summary statistics
    const sentimentScores = conversations
      .map(conv => conv.analyzedData.sentiment?.sentimentScore)
      .filter(score => score !== undefined);

    const averageSentiment = sentimentScores.length > 0 
      ? sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length 
      : 0;

    // Calculate sentiment distribution
    const sentimentDistribution = conversations.reduce((dist, conv) => {
      const sentiment = conv.analyzedData.sentiment?.overallSentiment || 'unknown';
      dist[sentiment] = (dist[sentiment] || 0) + 1;
      return dist;
    }, {});

    // Calculate trend direction using linear regression
    let trendDirection = 'stable';
    let confidence = 0;
    
    logger.debug('SentimentTrend processing', {
      patientId,
      dataPointCount: dataPoints.length
    });
    
    if (dataPoints.length >= 3) {
      // Sort data points by Call's endTime (oldest first) for proper trend calculation
      const sortedDataPoints = dataPoints.sort((a, b) => {
        const aTime = a.callId?.endTime || 0;
        const bTime = b.callId?.endTime || 0;
        return aTime - bTime;
      });
      const sentimentScores = sortedDataPoints.map(point => point.analyzedData?.sentiment?.sentimentScore || 0);
      
      logger.debug('SentimentTrend sorted scores', {
        patientId,
        sentimentScores
      });
      
      // Use linear regression to calculate trend
      trendDirection = calculateLinearTrend(sentimentScores);
      
      logger.debug('SentimentTrend calculated direction', {
        patientId,
        trendDirection
      });
      
      // Calculate confidence based on data quality and quantity
      const scoreVariance = calculateVariance(sentimentScores);
      const dataQuality = Math.min(1, dataPoints.length / 8); // Max at 8+ data points
      const trendStrength = Math.min(1, scoreVariance * 2); // Higher variance = stronger trend
      confidence = Math.min(0.95, (dataQuality + trendStrength) / 2);
    } else if (dataPoints.length >= 2) {
      // For 2 data points, use simple comparison with lower threshold
      const sortedDataPoints = dataPoints.sort((a, b) => {
        const aTime = a.callId?.endTime || 0;
        const bTime = b.callId?.endTime || 0;
        return aTime - bTime;
      });
      const firstScore = sortedDataPoints[0].analyzedData?.sentiment?.sentimentScore || 0;
      const lastScore = sortedDataPoints[sortedDataPoints.length - 1].analyzedData?.sentiment?.sentimentScore || 0;
      const difference = lastScore - firstScore;
      
      logger.debug('SentimentTrend 2-point comparison', {
        patientId,
        firstScore,
        lastScore,
        difference
      });
      
      if (difference > 0.05) trendDirection = 'improving';
      else if (difference < -0.05) trendDirection = 'declining';
      
      logger.debug('SentimentTrend 2-point direction', {
        patientId,
        trendDirection
      });
      
      confidence = Math.min(0.6, dataPoints.length / 5); // Lower confidence for small datasets
    } else if (dataPoints.length === 1) {
      confidence = 0.2; // Very low confidence for single data point
    } else {
      // No data points, confidence should be 0
      confidence = 0;
    }

    // Generate key insights
    const keyInsights = [];
    if (averageSentiment > 0.3) keyInsights.push('Patient shows generally positive sentiment');
    else if (averageSentiment < -0.3) keyInsights.push('Patient shows generally negative sentiment');
    
    if (trendDirection === 'improving') keyInsights.push('Sentiment trend is improving over time');
    else if (trendDirection === 'declining') keyInsights.push('Sentiment trend is declining over time');
    
    if (sentimentDistribution.negative > sentimentDistribution.positive) {
      keyInsights.push('Patient has more negative than positive conversations');
    }

    return {
      patientId,
      timeRange,
      startDate,
      endDate: now,
      totalConversations,
      analyzedConversations: conversations.length,
      dataPoints,
      summary: {
        averageSentiment,
        sentimentDistribution,
        trendDirection,
        confidence,
        keyInsights
      }
    };

  } catch (error) {
    logger.error(`[Sentiment Trend] Error getting sentiment trend for patient ${patientId}: ${error.message}`);
    throw error;
  }
};

/**
 * Get sentiment summary for a patient
 * @param {string} patientId - The patient ID
 * @returns {Promise<Object>} Sentiment summary data
 */
const getSentimentSummary = async (patientId) => {
  try {
    // Get recent conversations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get recent conversations using Call's endTime (date/duration live on Call, not Conversation)
    let recentConversations = await Conversation.find({
      patientId
    })
      .populate('callId', 'endTime startTime duration callDuration status')
      .select('_id analyzedData callId')
      .lean();
    
    // Filter by Call's endTime
    recentConversations = recentConversations.filter(conv => {
      const callEndTime = conv.callId?.endTime;
      return callEndTime && callEndTime >= thirtyDaysAgo;
    });
    
    // Sort by Call's endTime (most recent first)
    recentConversations.sort((a, b) => {
      const aTime = a.callId?.endTime || 0;
      const bTime = b.callId?.endTime || 0;
      return bTime - aTime;
    });
    
    // Limit to 10
    recentConversations = recentConversations.slice(0, 10);

    const analyzedConversations = recentConversations.filter(conv => conv.analyzedData?.sentiment);
    
    // Calculate summary statistics
    const sentimentScores = analyzedConversations
      .map(conv => conv.analyzedData.sentiment?.sentimentScore)
      .filter(score => score !== undefined);

    const averageSentiment = sentimentScores.length > 0 
      ? sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length 
      : 0;

    // Calculate sentiment distribution
    const sentimentDistribution = analyzedConversations.reduce((dist, conv) => {
      const sentiment = conv.analyzedData.sentiment?.overallSentiment || 'unknown';
      dist[sentiment] = (dist[sentiment] || 0) + 1;
      return dist;
    }, {});

    // Calculate trend direction from recent conversations
    let trendDirection = 'stable';
    if (analyzedConversations.length >= 3) {
      const recent = analyzedConversations.slice(0, 3);
      const older = analyzedConversations.slice(3, 6);
      
      if (recent.length > 0 && older.length > 0) {
        const recentAvg = recent.reduce((sum, conv) => sum + (conv.analyzedData.sentiment?.sentimentScore || 0), 0) / recent.length;
        const olderAvg = older.reduce((sum, conv) => sum + (conv.analyzedData.sentiment?.sentimentScore || 0), 0) / older.length;
        
        if (recentAvg > olderAvg + 0.1) trendDirection = 'improving';
        else if (recentAvg < olderAvg - 0.1) trendDirection = 'declining';
      }
    }

    // Calculate confidence
    const confidence = Math.min(1, analyzedConversations.length / 5);

    // Generate key insights
    const keyInsights = [];
    if (averageSentiment > 0.3) keyInsights.push('Recent conversations show positive sentiment');
    else if (averageSentiment < -0.3) keyInsights.push('Recent conversations show negative sentiment');
    
    if (trendDirection === 'improving') keyInsights.push('Recent sentiment trend is improving');
    else if (trendDirection === 'declining') keyInsights.push('Recent sentiment trend is declining');

    return {
      totalConversations: recentConversations.length,
      analyzedConversations: analyzedConversations.length,
      averageSentiment,
      sentimentDistribution,
      trendDirection,
      confidence,
      keyInsights,
      recentTrend: analyzedConversations.slice(0, 5) // Last 5 analyzed conversations
    };

  } catch (error) {
    logger.error(`[Sentiment Summary] Error getting sentiment summary for patient ${patientId}: ${error.message}`);
    throw error;
  }
};


module.exports = {
  getSentimentTrend,
  getSentimentSummary,
};

