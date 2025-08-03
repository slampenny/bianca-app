const httpStatus = require('http-status');
const { Conversation, Message, Patient } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

    // Generate summary using your existing LangChain service
    const { langChainAPI } = require('../api/langChainAPI');
const { prompts } = require('../templates/prompts'); // Your Bianca system prompt

// ===== EXISTING METHODS (unchanged) =====
const createConversationForPatient = async (patientId) => {
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
  return conversation;
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

    const message = await Message.create({
      role: role === 'assistant' ? 'assistant' : 'user',
      content: content.trim(),
      conversationId,
      messageType: normalizedType,
    });
    

    // Also update the conversation's messages array for proper references
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

    // Update conversation using your existing history field
    await Conversation.findByIdAndUpdate(conversationId, {
      history: summary, // Store summary in your existing history field
      endTime: new Date(),
      status: 'completed'
    });

    logger.info(`[Finalize] Successfully summarized conversation ${conversationId} with ${messages.length} messages`);
    return summary;

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
  getPatientContext
};