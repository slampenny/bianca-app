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
                          messageType;

    // Create and save the message to the database FIRST
    const message = await Message.create({
      role: role === 'assistant' ? 'assistant' : 'patient',
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

    logger.debug(`[Realtime Message] Saved ${role} message to conversation ${conversationId}`);
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

    // Process sentiment data
    const dataPoints = conversations.map(conv => ({
      conversationId: conv._id,
      date: conv.endTime || conv.startTime,
      duration: conv.duration,
      sentiment: conv.analyzedData.sentiment,
      sentimentAnalyzedAt: conv.analyzedData.sentimentAnalyzedAt
    }));

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

    // Calculate trend direction
    let trendDirection = 'stable';
    if (dataPoints.length >= 2) {
      const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
      const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, point) => sum + (point.sentiment?.sentimentScore || 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, point) => sum + (point.sentiment?.sentimentScore || 0), 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 0.1) trendDirection = 'improving';
      else if (secondAvg < firstAvg - 0.1) trendDirection = 'declining';
    }

    // Calculate confidence based on number of data points
    const confidence = Math.min(1, dataPoints.length / 10); // Max confidence at 10+ data points

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
  getSentimentSummary
};