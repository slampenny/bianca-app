const httpStatus = require('http-status');
const { Conversation, Message, Patient } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

    // Generate summary using your existing LangChain service
    const { langChainAPI } = require('../api/langChainAPI');
const { prompts } = require('../templates/prompts'); // Your Bianca system prompt

// ===== EXISTING METHODS (unchanged) =====
const createConversationForPatient = async (patientId) => {
  // Validate that the patient exists
  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }
  
  const conversation = new Conversation({ patientId });
  await conversation.save();
  return conversation;
};

const addMessageToConversation = async (conversationId, role, content) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  const message = new Message({ 
    role, 
    content, 
    conversationId 
  });
  await message.save();
  conversation.messages.push(message._id);
  await conversation.save();
  
  // Populate messages before returning
  const populatedConversation = await Conversation.findById(conversationId).populate('messages');
  return populatedConversation;
};

const getConversationById = async (id) => {
  const conversation = await Conversation.findById(id).populate('messages');
  if (!conversation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
  }
  
  // Debug logging for message retrieval
  logger.info(`[Conversation Service] Retrieved conversation ${id} with ${conversation.messages?.length || 0} messages`);
  if (conversation.messages && conversation.messages.length > 0) {
    logger.info(`[Conversation Service] Latest message: ${conversation.messages[conversation.messages.length - 1]?.content?.substring(0, 50)}...`);
  }
  
  return conversation;
};

const getConversationsByPatient = async (patientId) => {
  const conversations = await Conversation.find({ patientId }).populate('messages');
  if (!conversations) {
    throw new ApiError(httpStatus.NOT_FOUND, `No conversation found for patient <${patientId}>`);
  }
  return conversations;
};

/**
 * Query conversations by patient with pagination
 * @param {ObjectId} patientId
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryConversationsByPatient = async (patientId, options) => {
  const filter = { patientId };
  
  // Debug logging
  logger.info(`[Conversation Service] Querying conversations for patient ${patientId} with filter:`, filter);
  logger.info(`[Conversation Service] Options:`, options);
  
  const result = await Conversation.paginate(filter, {
    ...options,
    populate: 'messages',
    sortBy: options.sortBy || 'startTime:desc',
  });
  
  // Debug logging
  logger.info(`[Conversation Service] Found ${result.totalResults} total conversations, returning ${result.results.length} for page ${result.page}`);
  logger.info(`[Conversation Service] Conversation IDs:`, result.results.map(c => ({ id: c._id, status: c.status, startTime: c.startTime })));
  
  return result;
};

// ===== NEW ENHANCED METHODS =====

/**
 * Get conversation history formatted for context
 */
const getConversationHistory = async (patientId, limit = 5) => {
  try {
    const recentConversations = await Conversation.find({
      patientId: patientId,
      endTime: { $exists: true }, // Completed conversations
      $or: [
        { history: { $exists: true, $ne: null, $ne: '' } }, // Has summary in history field
        { 'messages.0': { $exists: true } } // Or has messages
      ]
    })
    .sort({ endTime: -1 })
    .limit(limit)
    .select('history callType endTime duration')
    .lean();

    if (!recentConversations || recentConversations.length === 0) {
      return null;
    }

    // Format using your existing history field
    const historyText = recentConversations
      .reverse() // Oldest first
      .map((conv, index) => {
        const date = conv.endTime ? new Date(conv.endTime).toLocaleDateString() : 'Recently';
        const callTypeText = conv.callType === 'wellness-check' ? 'wellness check' : 'conversation';
        const summary = conv.history || `${Math.round(conv.duration || 0)}s conversation`;
        
        return `${date} ${callTypeText}: ${summary}`;
      })
      .join('\n');

    logger.info(`[Conversation History] Found ${recentConversations.length} previous conversations for patient ${patientId}`);
    return historyText;

  } catch (err) {
    logger.error(`[Conversation History] Error: ${err.message}`);
    return null;
  }
};

/**
 * Get language name from language code
 */
const getLanguageName = (languageCode) => {
  const languageMap = {
    'en': 'English',
    'es': 'Spanish (Español)',
    'fr': 'French (Français)',
    'de': 'German (Deutsch)',
    'zh': 'Chinese (中文)',
    'ja': 'Japanese (日本語)',
    'pt': 'Portuguese (Português)',
    'it': 'Italian (Italiano)',
    'ru': 'Russian (Русский)',
    'ar': 'Arabic (العربية)',
  };
  return languageMap[languageCode] || 'English';
};

/**
 * Build enhanced prompt using your existing Bianca system prompt + patient context
 */
const buildEnhancedPrompt = async (patientId, callType = 'inbound') => {
  try {
    // Get patient info
    const patient = await Patient.findById(patientId)
      .select('name preferredName medicalConditions allergies currentMedications age preferredLanguage')
      .lean();

    if (!patient) {
      throw new ApiError(httpStatus.NOT_FOUND, `Patient ${patientId} not found`);
    }

    // Get conversation history
    const conversationHistory = await getConversationHistory(patientId);

    // Start with your base Bianca system prompt
    let enhancedPrompt = prompts.system.content;

    // Add patient-specific context section
    enhancedPrompt += `\n\nCurrent Patient Context:
- Patient Name: ${patient.name}
- Preferred Name: ${patient.preferredName || patient.name}`;

    if (patient.age) {
      enhancedPrompt += `\n- Age: ${patient.age}`;
    }

    // Add language instruction based on patient's preferred language
    const preferredLanguage = patient.preferredLanguage || 'en';
    const languageName = getLanguageName(preferredLanguage);
    
    if (preferredLanguage !== 'en') {
      enhancedPrompt += `\n\nIMPORTANT LANGUAGE INSTRUCTION:
- The patient's preferred language is: ${languageName}
- You MUST communicate exclusively in ${languageName} throughout this entire conversation
- Do not switch to English unless the patient explicitly asks you to
- Use natural, conversational ${languageName} appropriate for the patient's age and context
- Remember that your responses should be culturally appropriate for ${languageName} speakers`;
    } else {
      enhancedPrompt += `\n\nLanguage: Communicate in English as usual.`;
    }

    // Add conversation history context if available
    if (conversationHistory) {
      enhancedPrompt += `\n\nPrevious Conversation Context:
${conversationHistory}

Note: You maintain memory of old conversations as mentioned in your chat settings. Use this context naturally to provide continuity, but don't explicitly mention "previous calls" unless the patient brings them up first.`;
    }

    // Add call type specific context
    if (callType === 'wellness-check') {
      enhancedPrompt += `\n\nCall Context: This is a wellness check call you initiated. Wait for the person to speak first, then introduce yourself and ask about their general well-being. Keep it conversational and friendly as per your personality.`;
    } else {
      enhancedPrompt += `\n\nCall Context: The patient called you. Listen to understand what they need and provide appropriate support while maintaining your warm, friendly personality.`;
    }

    // Remind about phone conversation format
    enhancedPrompt += `\n\nImportant: Remember this is a phone conversation, so keep responses short, conversational, and spoken-friendly as outlined in your response guidelines.`;

    logger.info(`[Enhanced Prompt] Built prompt for patient ${patient.name} (${callType} call)`);
    return enhancedPrompt;

  } catch (err) {
    logger.error(`[Enhanced Prompt] Error building prompt for patient ${patientId}: ${err.message}`);
    // Fallback to base Bianca prompt
    return prompts.system.content;
  }
};

/**
 * Save individual messages during realtime conversation
 */
const saveRealtimeMessage = async (conversationId, role, content, messageType = 'text') => {
  try {
    if (!content || !content.trim()) return null;

    // Simple message types now
    const normalizedType = messageType === 'assistant_response' ? 'assistant_response' : 
                          messageType === 'user_message' ? 'user_message' : 
                          messageType === 'debug_user_message' ? 'debug_user_message' :
                          messageType;

    // Create and save the message to the database FIRST
    const message = await Message.create({
      role: role, // Use the role as-is (supports 'assistant', 'patient', 'system', 'debug-user')
      content: content.trim(),
      conversationId,
      messageType: normalizedType,
    });

    // Then update the conversation's messages array with the saved message's ID
    await Conversation.findByIdAndUpdate(
      conversationId,
      { 
        $push: { messages: message._id },
        $inc: { totalMessages: 1 }
      }
    );

    logger.info(`[Realtime Message] Successfully saved ${role} message to conversation ${conversationId}: "${content.substring(0, 100)}..."`);
    return message;
  } catch (err) {
    logger.error(`[Realtime Message] Error saving message: ${err.message}`);
    return null;
  }
};

/**
 * Enhanced conversation finalization using your LangChain templates
 */
const finalizeConversation = async (conversationId, useRealtimeMessages = false) => {
  try {
    const conversation = await Conversation.findById(conversationId)
      .populate('patientId', 'name age')
      .lean();

    if (!conversation) {
      logger.error(`[Finalize] Conversation ${conversationId} not found`);
      return;
    }

    let messages;
    let conversationText;

    if (useRealtimeMessages) {
      // Get messages from Message collection (realtime calls)
      messages = await Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .select('role content timestamp')
        .lean();

      if (!messages || messages.length === 0) {
        await Conversation.findByIdAndUpdate(conversationId, {
          history: 'No conversation content recorded', // Use existing history field
          endTime: new Date(),
          status: 'completed'
        });
        return;
      }

      conversationText = messages
        .map(msg => {
          const speaker = msg.role === 'assistant' ? 'Bianca' : 'Patient';
          return `${speaker}: ${msg.content}`;
        })
        .join('\n');

    } else {
      // Use existing conversation.messages array
      const populatedConversation = await Conversation.findById(conversationId).populate('messages');
      messages = populatedConversation.messages || [];
      
      if (messages.length === 0) {
        await Conversation.findByIdAndUpdate(conversationId, {
          history: 'No conversation content recorded', // Use existing history field
          endTime: new Date(),
          status: 'completed'
        });
        return;
      }

      conversationText = messages
        .map(msg => {
          const speaker = msg.role === 'assistant' ? 'Bianca' : 'Patient';
          return `${speaker}: ${msg.content}`;
        })
        .join('\n');
    }

    // Determine user domain
    let userDomain = 'patient wellness conversation';
    if (conversation.patientId?.age >= 65) {
      userDomain = 'elderly wellness conversation';
    }
    
    const summaryPrompt = "Create a concise summary of this patient conversation with Bianca, highlighting key topics discussed, any concerns raised, and the patient's overall mood or needs.";
    
    const summary = await langChainAPI.summarizeConversation(
      summaryPrompt,
      conversationText,
      userDomain
    );

    // Perform sentiment analysis on the conversation
    let sentimentAnalysis = null;
    try {
      const { getOpenAISentimentServiceInstance } = require('./openai.sentiment.service');
      const sentimentService = getOpenAISentimentServiceInstance();
      
      logger.info(`[Finalize] Starting sentiment analysis for conversation ${conversationId}`);
      sentimentAnalysis = await sentimentService.analyzeSentiment(conversationText, {
        detailed: true
      });
      
      if (sentimentAnalysis.success) {
        logger.info(`[Finalize] Sentiment analysis completed for conversation ${conversationId}: ${sentimentAnalysis.data.overallSentiment}`);
      } else {
        logger.warn(`[Finalize] Sentiment analysis failed for conversation ${conversationId}: ${sentimentAnalysis.error}`);
      }
    } catch (sentimentErr) {
      logger.error(`[Finalize] Error during sentiment analysis for conversation ${conversationId}: ${sentimentErr.message}`);
    }

    // Update conversation with summary and sentiment analysis
    const updateData = {
      history: summary, // Store summary in your existing history field
      endTime: new Date(),
      status: 'completed'
    };

    // Add sentiment analysis to analyzedData if successful
    if (sentimentAnalysis && sentimentAnalysis.success) {
      updateData['analyzedData.sentiment'] = sentimentAnalysis.data;
      updateData['analyzedData.sentimentAnalyzedAt'] = new Date();
    }

    await Conversation.findByIdAndUpdate(conversationId, updateData);

    logger.info(`[Finalize] Successfully finalized conversation ${conversationId} with ${messages.length} messages${sentimentAnalysis && sentimentAnalysis.success ? ' and sentiment analysis' : ''}`);
    return {
      summary,
      sentimentAnalysis: sentimentAnalysis && sentimentAnalysis.success ? sentimentAnalysis.data : null
    };

  } catch (err) {
    logger.error(`[Finalize] Error: ${err.message}`, err);
    
    // Fallback update using existing history field
    try {
      await Conversation.findByIdAndUpdate(conversationId, {
        history: 'Summary generation failed - manual review needed',
        endTime: new Date(),
        status: 'completed'
      });
    } catch (updateErr) {
      logger.error(`[Finalize] Failed to update: ${updateErr.message}`);
    }
    
    return {
      summary: 'Summary generation failed - manual review needed',
      sentimentAnalysis: null
    };
  }
};

/**
 * Get formatted patient context for other services
 */
const getPatientContext = async (patientId) => {
  try {
    const patient = await Patient.findById(patientId)
      .select('name email phone preferredName notes age') // Include age if you add it
      .lean();

    if (!patient) {
      throw new ApiError(httpStatus.NOT_FOUND, `Patient ${patientId} not found`);
    }

    return {
      name: patient.name,
      preferredName: patient.preferredName || patient.name,
      email: patient.email,
      phone: patient.phone,
      age: patient.age || null,
      notes: patient.notes || null,
      // Simple wellness indicator based on notes content
      hasWellnessNotes: !!(patient.notes && patient.notes.trim().length > 0)
    };

  } catch (err) {
    logger.error(`[Patient Context] Error getting context for patient ${patientId}: ${err.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to get patient context: ${err.message}`);
  }
};

/**
 * Get sentiment trend data for a patient over a specified time range
 */
const getSentimentTrend = async (patientId, timeRange = 'lastCall') => {
  try {
    const now = new Date();
    let startDate;

    // Calculate start date based on time range
    switch (timeRange) {
      case 'lastCall':
        // For lastCall, we'll get the most recent conversation with sentiment analysis
        const lastConversation = await Conversation.findOne({
          patientId,
          'analyzedData.sentiment': { $exists: true }
        })
        .select('endTime')
        .sort({ endTime: -1 })
        .lean();
        
        if (lastConversation) {
          // Get conversations from the last call date to now
          startDate = lastConversation.endTime;
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
    const conversations = await Conversation.find({
      patientId,
      endTime: { $gte: startDate, $lte: now },
      'analyzedData.sentiment': { $exists: true }
    })
      .select('_id startTime endTime duration analyzedData')
      .sort({ endTime: 1 })
      .lean();

    // Get all conversations (including those without sentiment) for total count
    const totalConversations = await Conversation.countDocuments({
      patientId,
      endTime: { $gte: startDate, $lte: now }
    });

    // Return raw conversation data for DTO transformation
    const dataPoints = conversations; // Return raw conversations, let DTO handle transformation

    console.log(`[SentimentTrend] Sample raw conversation:`, dataPoints[0]);
    console.log(`[SentimentTrend] Sample sentiment:`, dataPoints[0]?.analyzedData?.sentiment);

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
    
    console.log(`[SentimentTrend] Processing ${dataPoints.length} data points for patient ${patientId}`);
    
    if (dataPoints.length >= 3) {
      // Sort data points by date (oldest first) for proper trend calculation
      const sortedDataPoints = dataPoints.sort((a, b) => new Date(a.date) - new Date(b.date));
      const sentimentScores = sortedDataPoints.map(point => point.sentiment?.sentimentScore || 0);
      
      console.log(`[SentimentTrend] Sorted sentiment scores:`, sentimentScores);
      
      // Use linear regression to calculate trend
      trendDirection = calculateLinearTrend(sentimentScores);
      
      console.log(`[SentimentTrend] Calculated trend direction:`, trendDirection);
      
      // Calculate confidence based on data quality and quantity
      const scoreVariance = calculateVariance(sentimentScores);
      const dataQuality = Math.min(1, dataPoints.length / 8); // Max at 8+ data points
      const trendStrength = Math.min(1, scoreVariance * 2); // Higher variance = stronger trend
      confidence = Math.min(0.95, (dataQuality + trendStrength) / 2);
    } else if (dataPoints.length >= 2) {
      // For 2 data points, use simple comparison with lower threshold
      const sortedDataPoints = dataPoints.sort((a, b) => new Date(a.date) - new Date(b.date));
      const firstScore = sortedDataPoints[0].sentiment?.sentimentScore || 0;
      const lastScore = sortedDataPoints[sortedDataPoints.length - 1].sentiment?.sentimentScore || 0;
      const difference = lastScore - firstScore;
      
      console.log(`[SentimentTrend] 2-point comparison: first=${firstScore}, last=${lastScore}, difference=${difference}`);
      
      if (difference > 0.05) trendDirection = 'improving';
      else if (difference < -0.05) trendDirection = 'declining';
      
      console.log(`[SentimentTrend] 2-point trend direction:`, trendDirection);
      
      confidence = Math.min(0.6, dataPoints.length / 5); // Lower confidence for small datasets
    } else {
      confidence = 0.2; // Very low confidence for single data point
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
 */
const getSentimentSummary = async (patientId) => {
  try {
    // Get recent conversations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentConversations = await Conversation.find({
      patientId,
      endTime: { $gte: thirtyDaysAgo }
    })
      .select('_id startTime endTime duration analyzedData')
      .sort({ endTime: -1 })
      .limit(10)
      .lean();

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

// Medical Analysis Methods
// In-memory storage for medical baselines (for testing purposes)
const medicalBaselines = new Map();

const getMedicalBaseline = async (patientId) => {
  try {
    // Return stored baseline if it exists
    return medicalBaselines.get(patientId) || null;
  } catch (error) {
    logger.error('Error getting medical baseline:', error);
    throw error;
  }
};

const storeMedicalBaseline = async (patientId, baseline) => {
  try {
    // Store baseline in memory
    medicalBaselines.set(patientId, baseline);
    logger.info('Medical baseline stored', { patientId, baselineVersion: baseline.version });
  } catch (error) {
    logger.error('Error storing medical baseline:', error);
    throw error;
  }
};

// Helper function to clear baselines (for testing)
const clearMedicalBaselines = () => {
  medicalBaselines.clear();
};

const getMedicalAnalysisResults = async (patientId, limit = 10) => {
  try {
    const MedicalAnalysis = require('../models/medicalAnalysis.model');
    
    const results = await MedicalAnalysis.find({ patientId })
      .sort({ analysisDate: -1 })
      .limit(limit)
      .lean(); // Use lean() for better performance since we don't need Mongoose documents
    
    logger.info('Retrieved medical analysis results', { 
      patientId, 
      count: results.length,
      limit 
    });
    
    return results;
  } catch (error) {
    logger.error('Error getting medical analysis results:', error);
    throw error;
  }
};

const storeMedicalAnalysisResult = async (patientId, result) => {
  try {
    const MedicalAnalysis = require('../models/medicalAnalysis.model');
    
    // Calculate time series data and trends
    const timeSeriesData = calculateTimeSeriesData(result);
    const trends = await calculateTrends(patientId, timeSeriesData);
    
    // Clean and validate the analysis data before storing
    const cleanedResult = cleanAnalysisData(result);
    
    // Create medical analysis document
    const medicalAnalysis = new MedicalAnalysis({
      patientId,
      analysisDate: result.analysisDate || new Date(),
      timeRange: 'month', // Default to monthly analysis
      startDate: result.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate: result.endDate || new Date(),
      conversationCount: result.conversationCount || 0,
      messageCount: result.messageCount || 0,
      totalWords: result.totalWords || 0,
      cognitiveMetrics: cleanedResult.cognitiveMetrics || {},
      psychiatricMetrics: cleanedResult.psychiatricMetrics || {},
      vocabularyMetrics: cleanedResult.vocabularyMetrics || {},
      timeSeriesData,
      trends,
      confidence: result.confidence || 'low',
      warnings: result.warnings || [],
      processingTime: result.processingTime || 0,
      version: '1.0'
    });

    // Final safety check - ensure patterns is always an array
    if (medicalAnalysis.cognitiveMetrics?.detailedAnalysis?.conversationFlow?.patterns) {
      const patterns = medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns;
      logger.debug('Final patterns check', { 
        patternsType: typeof patterns, 
        isArray: Array.isArray(patterns),
        patternsValue: patterns 
      });
      
      if (typeof patterns === 'string') {
        try {
          const parsed = JSON.parse(patterns);
          medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns = Array.isArray(parsed) ? parsed : [];
          logger.debug('Parsed patterns from string', { count: medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns.length });
        } catch (e) {
          logger.warn('Failed to parse patterns string, setting to empty array', e);
          medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns = [];
        }
      } else if (!Array.isArray(patterns)) {
        logger.warn('Patterns is not an array, setting to empty array', { type: typeof patterns });
        medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns = [];
      }
      
      // Ensure each pattern has the correct structure
      if (Array.isArray(medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns)) {
        medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns = medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns.map(pattern => ({
          messageIndex: Number(pattern.messageIndex) || 0,
          type: String(pattern.type) || 'unknown',
          coherenceRatio: Number(pattern.coherenceRatio) || 0
        }));
        logger.debug('Final patterns structure', { count: medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns.length });
      }
    }

    await medicalAnalysis.save();
    logger.info('Medical analysis result stored with time series data', { 
      patientId, 
      analysisId: medicalAnalysis._id,
      analysisDate: medicalAnalysis.analysisDate,
      timeSeriesData,
      trends
    });
    
    return medicalAnalysis;
  } catch (error) {
    logger.error('Error storing medical analysis result:', error);
    throw error;
  }
};

/**
 * Clean and validate analysis data to ensure it matches the schema
 * @param {Object} result - Raw analysis result
 * @returns {Object} Cleaned analysis result
 */
const cleanAnalysisData = (result) => {
  const cleaned = JSON.parse(JSON.stringify(result)); // Deep clone
  
  logger.debug('Cleaning analysis data', { 
    hasCognitiveMetrics: !!cleaned.cognitiveMetrics,
    hasConversationFlow: !!cleaned.cognitiveMetrics?.detailedAnalysis?.conversationFlow,
    patternsType: typeof cleaned.cognitiveMetrics?.detailedAnalysis?.conversationFlow?.patterns,
    patternsValue: cleaned.cognitiveMetrics?.detailedAnalysis?.conversationFlow?.patterns
  });
  
  // Fix conversationFlow patterns if they're malformed
  if (cleaned.cognitiveMetrics?.detailedAnalysis?.conversationFlow) {
    const conversationFlow = cleaned.cognitiveMetrics.detailedAnalysis.conversationFlow;
    
    if (conversationFlow.patterns) {
      const patterns = conversationFlow.patterns;
      
      // If patterns is a string, try to parse it
      if (typeof patterns === 'string') {
        try {
          conversationFlow.patterns = JSON.parse(patterns);
          logger.debug('Parsed conversationFlow patterns from string');
        } catch (e) {
          logger.warn('Failed to parse conversationFlow patterns, setting to empty array', e);
          conversationFlow.patterns = [];
        }
      }
      
      // Ensure patterns is an array of objects with correct structure
      if (Array.isArray(conversationFlow.patterns)) {
        conversationFlow.patterns = conversationFlow.patterns.map(pattern => ({
          messageIndex: Number(pattern.messageIndex) || 0,
          type: String(pattern.type) || 'unknown',
          coherenceRatio: Number(pattern.coherenceRatio) || 0
        }));
        logger.debug('Cleaned conversationFlow patterns', { count: conversationFlow.patterns.length });
      } else {
        logger.warn('conversationFlow.patterns is not an array, setting to empty array');
        conversationFlow.patterns = [];
      }
    } else {
      // Ensure patterns field exists
      conversationFlow.patterns = [];
    }
  }
  
  // Clean psychiatric indicators to ensure valid enum values
  if (cleaned.psychiatricMetrics?.indicators) {
    const validTypes = ['depression', 'anxiety', 'crisis', 'absolutist_language', 'pronoun_usage', 'temporal_focus', 'negative_tone'];
    cleaned.psychiatricMetrics.indicators = cleaned.psychiatricMetrics.indicators
      .filter(indicator => validTypes.includes(indicator.type))
      .map(indicator => ({
        type: indicator.type,
        severity: indicator.severity || 'low',
        message: indicator.message || '',
        details: indicator.details || ''
      }));
    logger.debug('Cleaned psychiatric indicators', { count: cleaned.psychiatricMetrics.indicators.length });
  }
  
  return cleaned;
};

const deleteOldMedicalAnalyses = async (cutoffDate) => {
  try {
    const MedicalAnalysis = require('../models/medicalAnalysis.model');
    
    const result = await MedicalAnalysis.deleteMany({
      analysisDate: { $lt: cutoffDate }
    });
    
    logger.info('Deleted old medical analyses', { 
      deletedCount: result.deletedCount,
      cutoffDate 
    });
    
    return result;
  } catch (error) {
    logger.error('Error deleting old medical analyses:', error);
    throw error;
  }
};

const getActivePatients = async () => {
  try {
    // This would typically get active patients from the patient service
    // For now, return empty array as placeholder
    return [];
  } catch (error) {
    logger.error('Error getting active patients:', error);
    throw error;
  }
};

const getConversationsByPatientAndDateRange = async (patientId, startDate, endDate) => {
  try {
    const conversations = await Conversation.find({
      patientId,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .populate('messages')
    .sort({ createdAt: 1 });

    return conversations;
  } catch (error) {
    logger.error('Error getting conversations by patient and date range:', error);
    throw error;
  }
};

/**
 * Calculate time series data from analysis result
 * @param {Object} result - Analysis result object
 * @returns {Object} Time series data
 */
const calculateTimeSeriesData = (result) => {
  return {
    cognitiveScore: result.cognitiveMetrics?.riskScore || 0,
    mentalHealthScore: result.psychiatricMetrics?.overallRiskScore || 0,
    languageScore: result.vocabularyMetrics?.complexityScore || 0,
    overallHealthScore: calculateOverallHealthScore(result)
  };
};

/**
 * Calculate overall health score from analysis result
 * @param {Object} result - Analysis result object
 * @returns {Number} Overall health score (0-100, higher is better)
 */
const calculateOverallHealthScore = (result) => {
  let score = 100;
  
  // Deduct points for cognitive issues
  if (result.cognitiveMetrics?.riskScore > 0) {
    score -= Math.min(result.cognitiveMetrics.riskScore * 0.3, 30);
  }
  
  // Deduct points for psychiatric issues
  if (result.psychiatricMetrics?.depressionScore > 0) {
    score -= Math.min(result.psychiatricMetrics.depressionScore * 0.2, 25);
  }
  
  if (result.psychiatricMetrics?.anxietyScore > 0) {
    score -= Math.min(result.psychiatricMetrics.anxietyScore * 0.15, 20);
  }
  
  // Deduct points for crisis indicators
  if (result.psychiatricMetrics?.crisisIndicators?.hasCrisisIndicators) {
    score -= 25;
  }
  
  return Math.max(Math.round(score), 0);
};

/**
 * Calculate trends by comparing with previous analyses
 * @param {string} patientId - Patient ID
 * @param {Object} currentTimeSeriesData - Current time series data
 * @returns {Object} Trend indicators
 */
const calculateTrends = async (patientId, currentTimeSeriesData) => {
  try {
    const MedicalAnalysis = require('../models/medicalAnalysis.model');
    
    // Get the last 3 analyses for trend calculation
    const previousAnalyses = await MedicalAnalysis.find({ patientId })
      .select('timeSeriesData')
      .sort({ analysisDate: -1 })
      .limit(3)
      .lean();
    
    if (previousAnalyses.length < 2) {
      // Not enough data for trend calculation
      return {
        cognitive: 'stable',
        mentalHealth: 'stable',
        language: 'stable',
        overall: 'stable'
      };
    }
    
    // Calculate trends using linear regression on the last few data points
    const trends = {};
    
    // Calculate trend for each metric
    ['cognitiveScore', 'mentalHealthScore', 'languageScore', 'overallHealthScore'].forEach(metric => {
      const values = [currentTimeSeriesData[metric], ...previousAnalyses.map(a => a.timeSeriesData?.[metric] || 0)];
      trends[metric.replace('Score', '')] = calculateLinearTrend(values);
    });
    
    return trends;
  } catch (error) {
    logger.error('Error calculating trends:', error);
    return {
      cognitive: 'stable',
      mentalHealth: 'stable',
      language: 'stable',
      overall: 'stable'
    };
  }
};

/**
 * Calculate linear trend from a series of values
 * @param {Array} values - Array of numeric values (oldest first)
 * @returns {string} 'improving', 'stable', or 'declining'
 */
const calculateLinearTrend = (values) => {
  if (values.length < 2) return 'stable';
  
  // Simple linear regression slope
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = values;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  // For sentiment scores: positive slope = improving, negative slope = declining
  if (Math.abs(slope) < 0.02) return 'stable'; // Lower threshold for sentiment
  
  return slope > 0 ? 'improving' : 'declining';
};

/**
 * Calculate variance of a dataset
 * @param {Array} values - Array of numeric values
 * @returns {number} Variance of the values
 */
const calculateVariance = (values) => {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  
  return variance;
};

module.exports = {
  // Existing methods (unchanged)
  createConversationForPatient,
  addMessageToConversation,
  getConversationById,
  getConversationsByPatient,
  queryConversationsByPatient,
  
  // New enhanced methods
  getConversationHistory,
  buildEnhancedPrompt,
  saveRealtimeMessage,
  finalizeConversation,
  getPatientContext,
  
  // Sentiment analysis methods
  getSentimentTrend,
  getSentimentSummary,
  
  // Medical analysis methods
  getMedicalBaseline,
  storeMedicalBaseline,
  clearMedicalBaselines,
  getMedicalAnalysisResults,
  storeMedicalAnalysisResult,
  deleteOldMedicalAnalyses,
  getActivePatients,
  getConversationsByPatientAndDateRange
};