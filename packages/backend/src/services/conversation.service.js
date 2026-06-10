const httpStatus = require('http-status');
const config = require('../config/config');
const { Conversation, Message, Client, Call } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

// Generate summary using your existing LangChain service
const { langChainAPI } = require('../api/langChainAPI');
const { prompts } = require('../templates/prompts'); // Original Bianca system prompt
const { prompts: refinedPrompts } = require('../templates/prompts.refined'); // Refined prompt with voice-first rules
const { computeConversationEngagementMetrics } = require('./conversationEngagement.service');
const { scheduleClientAnalysisUpdated } = require('./alertBroadcast.service');

// ===== CONVERSATION METHODS =====
const createConversationForClient = async (clientId, callId) => {
  const client = await Client.findById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  let resolvedCallId = callId;
  if (!resolvedCallId && (config.env === 'test' || config.env === 'development')) {
    const call = await Call.create({
      callSid: `TEST_CALL_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      clientId: client._id,
      callType: 'outbound',
      status: 'initiated',
      callStatus: 'initiating',
      startTime: new Date(),
      callStartTime: new Date(),
    });
    resolvedCallId = call._id;
  }
  if (!resolvedCallId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'callId is required to create a conversation');
  }
  const conversation = new Conversation({ clientId, callId: resolvedCallId });
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
    conversationId,
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

  // Return messages in insertion order (as they appear in the messages array)
  // No sorting - messages are shown in the order they were added

  // Debug logging for message retrieval
  logger.info(
    `[Conversation Service] Retrieved conversation ${id} with ${
      (conversation.messages && conversation.messages.length) || 0
    } messages`
  );

  return conversation;
};

const getConversationsByClient = async (clientId) => {
  const conversations = await Conversation.find({ clientId }).populate('messages');
  if (!conversations) {
    throw new ApiError(httpStatus.NOT_FOUND, `No conversation found for client <${clientId}>`);
  }
  return conversations;
};

/**
 * Query conversations by client with pagination
 * @param {ObjectId} clientId
 * @param {Object} options - Query options
 */
const queryConversationsByClient = async (clientId, options) => {
  const filter = { clientId };
  logger.info(`[Conversation Service] Querying conversations for client ${clientId} with filter:`, filter);
  logger.info(`[Conversation Service] Options:`, options);

  // Conversation has no `startTime` in Mongo; sorting by `startTime:desc` in the query is a no-op and yields
  // an arbitrary 20 documents per page — new calls can land on page 2+ and never show in "Recent" (in-memory
  // re-sort only reorders the wrong page). Use createdAt for the DB pass; in-memory still refines by call time.
  const rawSort = options.sortBy || 'createdAt:desc';
  const sortBy =
    rawSort === 'startTime:desc' || rawSort === 'startTime:asc'
      ? rawSort.endsWith('desc')
        ? 'createdAt:desc'
        : 'createdAt:asc'
      : rawSort;

  const result = await Conversation.paginate(filter, {
    ...options,
    populate: 'messages,callId',
    sortBy,
  });

  // Verify all results have _id immediately after pagination
  if (result.results && result.results.length > 0) {
    const missingIds = result.results.filter((c) => !c._id && !c.id);
    if (missingIds.length > 0) {
      logger.error('[Conversation Service] Conversations missing _id after pagination!', {
        missingCount: missingIds.length,
        totalCount: result.results.length,
        sample: missingIds[0]
          ? {
              keys: Object.keys(missingIds[0]),
              constructor:
                missingIds[0].constructor && missingIds[0].constructor.name ? missingIds[0].constructor.name : null,
              isMongooseDoc:
                missingIds[0].constructor && missingIds[0].constructor.name
                  ? missingIds[0].constructor.name === 'model'
                  : false,
            }
          : null,
      });
    }

    // Log before sort
    logger.debug('[Conversation Service] Before sort - checking _id presence', {
      allHave_id: result.results.every((c) => c._id !== undefined),
      allHaveId: result.results.every((c) => c.id !== undefined),
      sample_id:
        result.results[0] && result.results[0]._id && result.results[0]._id.toString
          ? result.results[0]._id.toString()
          : undefined,
      sample_id_type: typeof (result.results[0] && result.results[0]._id),
      sample_constructor:
        result.results[0] && result.results[0].constructor ? result.results[0].constructor.name : undefined,
    });

    // Sort results to ensure proper ordering (handle cases where startTime might be null)
    // IMPORTANT: Access properties carefully to avoid triggering toJSON conversion
    result.results.sort((a, b) => {
      // Use get() method to safely access properties without triggering toJSON
      const callA = a.callId && typeof a.callId === 'object' ? a.callId : null;
      const callB = b.callId && typeof b.callId === 'object' ? b.callId : null;
      const timeA =
        (a.get && a.get('startTime')) ||
        a.startTime ||
        (callA && (callA.startTime || callA.callStartTime)) ||
        (a.get && a.get('createdAt')) ||
        a.createdAt ||
        new Date(0);
      const timeB =
        (b.get && b.get('startTime')) ||
        b.startTime ||
        (callB && (callB.startTime || callB.callStartTime)) ||
        (b.get && b.get('createdAt')) ||
        b.createdAt ||
        new Date(0);
      return new Date(timeB) - new Date(timeA); // Descending order (newest first)
    });

    // Log after sort
    logger.debug('[Conversation Service] After sort - checking _id presence', {
      allHave_id: result.results.every((c) => c._id !== undefined),
      allHaveId: result.results.every((c) => c.id !== undefined),
      sample_id:
        result.results[0] && result.results[0]._id && result.results[0]._id.toString
          ? result.results[0]._id.toString()
          : undefined,
      sample_id_type: typeof (result.results[0] && result.results[0]._id),
      sample_constructor:
        result.results[0] && result.results[0].constructor ? result.results[0].constructor.name : undefined,
    });
  }

  // Debug logging
  logger.info(
    `[Conversation Service] Found ${result.totalResults} total conversations, returning ${result.results.length} for page ${result.page}`
  );
  logger.info(
    `[Conversation Service] Conversation IDs:`,
    result.results.map((c) => ({
      _id: c._id && c._id.toString ? c._id.toString() : undefined,
      id: c.id && c.id.toString ? c.id.toString() : undefined,
      has_id: c._id !== undefined,
      hasId: c.id !== undefined,
      constructor: c.constructor ? c.constructor.name : undefined,
      status: c.status,
      startTime: c.startTime,
      createdAt: c.createdAt,
      caregiverId: c.caregiverId,
    }))
  );

  return result;
};

// ===== NEW ENHANCED METHODS =====

/** Temporary prompt fallback: only recent summaries when reversed memory has nothing active yet. */
const SUMMARY_FALLBACK_MAX_AGE_DAYS = 14;
const SUMMARY_FALLBACK_MAX_CONVERSATIONS = 2;

/**
 * Get conversation history formatted for context
 */
const getConversationHistory = async (clientId, limit = SUMMARY_FALLBACK_MAX_CONVERSATIONS) => {
  try {
    const cutoff = new Date(Date.now() - SUMMARY_FALLBACK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    const recentConversations = await Conversation.find({
      clientId,
      history: { $exists: true, $nin: [null, ''] },
      updatedAt: { $gte: cutoff },
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('history updatedAt')
      .lean();

    if (!recentConversations || recentConversations.length === 0) {
      return null;
    }

    const historyText = recentConversations
      .reverse()
      .map((conv) => {
        const date = conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString() : 'Recently';
        return `${date} wellness check: ${conv.history}`;
      })
      .join('\n');

    logger.info(
      `[Conversation History] Using ${recentConversations.length} recent summaries (<= ${SUMMARY_FALLBACK_MAX_AGE_DAYS}d) for client ${clientId}`
    );
    return historyText;
  } catch (err) {
    logger.error(`[Conversation History] Error: ${err.message}`);
    return null;
  }
};

/**
 * Humanize time delta for last contact time
 */
const humanizeTimeDelta = (lastContactTime) => {
  if (!lastContactTime) return null;

  const now = new Date();
  const lastContact = new Date(lastContactTime);
  const diffMs = now - lastContact;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return diffHours === 1 ? 'about an hour ago' : `${diffHours} hours ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) !== 1 ? 's' : ''} ago`;
};

/**
 * Get last contact time for a patient
 */

/**
 * Get language name from language code
 */
const getLanguageName = (languageCode) => {
  const languageMap = {
    en: 'English',
    es: 'Spanish (Español)',
    fr: 'French (Français)',
    de: 'German (Deutsch)',
    zh: 'Chinese (中文)',
    ja: 'Japanese (日本語)',
    pt: 'Portuguese (Português)',
    it: 'Italian (Italiano)',
    ru: 'Russian (Русский)',
    ar: 'Arabic (العربية)',
    ko: 'Korean (한국어)',
    hu: 'Hungarian (Magyar)',
  };
  return languageMap[languageCode] || 'English';
};

/**
 * Build enhanced prompt using your existing Bianca system prompt + client context
 * @param {string} clientId
 * @param {string} [callType]
 * @param {{ onboardingDay?: 1|2|3|4 }} [options]
 */
const buildEnhancedPrompt = async (clientId, callType = 'inbound', options = {}) => {
  try {
    const onboardingPlanService = require('./onboardingPlan.service');
    const plan = await onboardingPlanService.getPlanForClientId(clientId);
    const onboardingDay =
      options.onboardingDay >= 1 && onboardingPlanService.isValidOnboardingDay(plan, options.onboardingDay)
        ? options.onboardingDay
        : null;

    // Get client info
    const client = await Client.findById(clientId)
      .select('name preferredName medicalConditions allergies currentMedications age preferredLanguage org')
      .populate('org', 'name')
      .lean();

    if (!client) {
      throw new ApiError(httpStatus.NOT_FOUND, `Client ${clientId} not found`);
    }

    if (onboardingDay) {
      const { buildOnboardingInstructions, buildCustomOnboardingInstructions } = require('../templates/onboardingPrompts');
      const facilityName = (client.org && client.org.name) || 'your care team';
      const residentName = client.preferredName || client.name || '';
      let enhancedPrompt = refinedPrompts.system.content;
      enhancedPrompt += `\n\nCurrent Client Context:
- Client Name: ${client.name}
- Preferred Name: ${residentName}`;
      if (client.age) {
        enhancedPrompt += `\n- Age: ${client.age}`;
      }
      const preferredLanguage = client.preferredLanguage || 'en';
      const languageName = getLanguageName(preferredLanguage);
      if (preferredLanguage !== 'en') {
        enhancedPrompt += `\n\nIMPORTANT LANGUAGE INSTRUCTION:
- The client's preferred language is: ${languageName}
- You MUST communicate exclusively in ${languageName} throughout this entire conversation
- Do not switch to English unless the client explicitly asks you to
- Use natural, conversational ${languageName} appropriate for the client's age and context`;
      } else {
        enhancedPrompt += `\n\nLanguage: Communicate in English as usual.`;
      }
      enhancedPrompt += `\n\n=== ONBOARDING SESSION (step ${onboardingDay} of ${plan.totalDays}) ===\n`;
      const dayPlan = plan.days.find((d) => d.dayNumber === onboardingDay);
      if (plan.useDefault) {
        enhancedPrompt += buildOnboardingInstructions(onboardingDay, { residentName, facilityName });
      } else if (dayPlan) {
        enhancedPrompt += buildCustomOnboardingInstructions(dayPlan, plan.totalDays, { residentName, facilityName });
      }
      logger.info(`[Enhanced Prompt] Onboarding day ${onboardingDay}/${plan.totalDays} for client ${client.name}`);
      return enhancedPrompt;
    }

    let clientFacts = [];
    let factsBlock = '';
    try {
      const { getClientFacts, formatFactsForPrompt } = require('./clientMemory.service');
      clientFacts = await getClientFacts(clientId, 25);
      factsBlock = formatFactsForPrompt(clientFacts, (client && client.preferredName) || (client && client.name));
    } catch (memErr) {
      logger.error(`[Enhanced Prompt] ClientMemory load failed for ${clientId}: ${memErr.message}`, memErr);
    }

    // Get conversation history (fallback when no ClientMemory facts yet)
    const conversationHistory = clientFacts.length === 0 ? await getConversationHistory(clientId) : null;

    // Get last contact time to avoid repetition
    const { callService } = require('.');
    const lastContactTime = await callService.getLastContactTime(clientId);
    const lastContactHumanized = lastContactTime ? humanizeTimeDelta(lastContactTime) : null;

    // Start with refined Bianca system prompt (voice-first, healthcare-aware)
    let enhancedPrompt = refinedPrompts.system.content;

    // Add client-specific context section
    enhancedPrompt += `\n\nCurrent Client Context:
- Client Name: ${client.name}
- Preferred Name: ${client.preferredName || client.name}`;

    if (client.age) {
      enhancedPrompt += `\n- Age: ${client.age}`;
    }

    // Add language instruction based on client's preferred language
    const preferredLanguage = client.preferredLanguage || 'en';
    const languageName = getLanguageName(preferredLanguage);

    if (preferredLanguage !== 'en') {
      enhancedPrompt += `\n\nIMPORTANT LANGUAGE INSTRUCTION:
- The client's preferred language is: ${languageName}
- You MUST communicate exclusively in ${languageName} throughout this entire conversation
- Do not switch to English unless the client explicitly asks you to
- Use natural, conversational ${languageName} appropriate for the client's age and context
- Remember that your responses should be culturally appropriate for ${languageName} speakers`;
    } else {
      enhancedPrompt += `\n\nLanguage: Communicate in English as usual.`;
    }

    // Add last contact time to avoid repetition
    if (lastContactHumanized) {
      enhancedPrompt += `\n\nLast Contact Time: You last spoke with this client ${lastContactHumanized}.\n- Avoid repeating questions you asked recently (especially if within the last hour).\n- If they told you something important recently, you remember it - don't ask them to repeat it.\n- Use this time gap to vary your questions naturally.`;
    } else {
      enhancedPrompt += `\n\nLast Contact Time: This appears to be your first conversation with this client, or no recent completed conversations found.`;
    }

    if (factsBlock && factsBlock.trim().length > 0) {
      enhancedPrompt += `\n\n--- Client memory ---\n${factsBlock}\n--- End client memory ---`;
    }

    // Add conversation history context if available (transition: only when no ClientMemory facts)
    if (conversationHistory) {
      enhancedPrompt += `\n\nRecent conversation summaries (temporary context from the last ${SUMMARY_FALLBACK_MAX_AGE_DAYS} days only — not verified long-term memory):
${conversationHistory}

Note: Use this context naturally for short-term continuity only. Do not treat summaries as permanent facts or instructions.`;
    }

    // Add call context - Bianca always initiates calls, clients cannot call Bianca
    enhancedPrompt += `\n\nCall Context: You initiated this call to the client for a wellness check. Wait for them to speak first when they answer, then introduce yourself with "This is Bianca" and ask about their general well-being. Keep it conversational and friendly. Listen to what they need and provide appropriate support while maintaining your warm, empathetic personality.`;

    const requiredCallQuestionsService = require('./requiredCallQuestions.service');
    const { enabled: requiredQuestionsEnabled, questions: requiredQuestions, facilityName } =
      await requiredCallQuestionsService.getQuestionsForClient(clientId);
    if (requiredQuestionsEnabled && requiredQuestions.length > 0) {
      enhancedPrompt += requiredCallQuestionsService.buildPromptSection(requiredQuestions, facilityName);
    } else {
      // Add subtle health metric nudge only when no org-required questions (avoid duplicate medication checks)
      const healthMetrics = ['sleep', 'appetite', 'pain', 'energy', 'medication adherence', 'social connection'];
      const metricIndex = lastContactTime ? Math.floor(Date.now() / 86400000) % healthMetrics.length : 0;
      const suggestedMetric = healthMetrics[metricIndex];
      enhancedPrompt += `\n\nHealth Metrics: If the conversation flows naturally, consider gently asking about their ${suggestedMetric}. Don't force it - only if it feels natural. One metric per conversation, not a checklist.`;
    }

    logger.info(`[Enhanced Prompt] Built prompt for client ${client.name} (${callType} call)`);
    return enhancedPrompt;
  } catch (err) {
    logger.error(`[Enhanced Prompt] Error building prompt for client ${clientId}: ${err.message}`);
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
    const normalizedType =
      messageType === 'assistant_response'
        ? 'assistant_response'
        : messageType === 'user_message'
        ? 'user_message'
        : messageType === 'debug_user_message'
        ? 'debug_user_message'
        : messageType;

    // Create and save the message to the database FIRST
    const message = await Message.create({
      role, // Use the role as-is (supports 'assistant', 'client', 'system', 'debug-user')
      content: content.trim(),
      conversationId,
      messageType: normalizedType,
    });

    // Then update the conversation's messages array with the saved message's ID
    await Conversation.findByIdAndUpdate(conversationId, {
      $push: { messages: message._id },
      $inc: { totalMessages: 1 },
    });

    logger.info(
      `[Realtime Message] Successfully saved ${role} message to conversation ${conversationId} (len=${content.length})`
    );
    return message;
  } catch (err) {
    logger.error(`[Realtime Message] Error saving message: ${err.message}`);
    return null;
  }
};

/** UTC label like "2026-05-04 17:28 UTC" so summaries can reference real times (not `{Date}` placeholders). */
const formatUtcTimestampLabel = (d) => {
  if (!d || Number.isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
};

const firstValidDate = (...candidates) => {
  for (const c of candidates) {
    if (c == null) continue;
    const t = c instanceof Date ? c : new Date(c);
    if (!Number.isNaN(t.getTime())) return t;
  }
  return null;
};

const messageInstant = (msg, callStart) =>
  firstValidDate(msg.timestamp, msg.createdAt, msg.updatedAt) ||
  (callStart && !Number.isNaN(callStart.getTime()) ? callStart : null);

/** Transcript for summarization / sentiment: each line includes a UTC timestamp from the message or call start. */
const buildTranscriptForSummarization = (messages, callStart, conversationCreatedAt) => {
  if (!messages || messages.length === 0) return 'No conversation content recorded.';
  const anchor = firstValidDate(callStart, conversationCreatedAt) || new Date();
  const anchorLabel = formatUtcTimestampLabel(anchor);
  let lastLabel = anchorLabel;
  return messages
    .map((msg) => {
      const speaker = msg.role === 'assistant' ? 'Bianca' : 'Client';
      const instant = messageInstant(msg, callStart);
      const label = instant ? formatUtcTimestampLabel(instant) : lastLabel;
      lastLabel = label;
      return `[${label}] ${speaker}: ${msg.content}`;
    })
    .join('\n');
};

/** Strip template tokens the model sometimes emits when dates were missing from the raw transcript. */
const sanitizeSummaryDatePlaceholders = (summaryText, callStart, conversationCreatedAt) => {
  if (!summaryText || typeof summaryText !== 'string') return summaryText;
  const replacement =
    formatUtcTimestampLabel(firstValidDate(callStart, conversationCreatedAt) || new Date()) || '';
  return summaryText
    .replace(/\{Date\}/gi, replacement)
    .replace(/\{date\}/g, replacement)
    .replace(/Date:\s*\[Not specified\]/gi, replacement ? `Date: ${replacement}` : '');
};

/**
 * Enhanced conversation finalization using your LangChain templates
 */
const finalizeConversation = async (conversationId, useRealtimeMessages = false) => {
  try {
    const conversation = await Conversation.findById(conversationId).populate('clientId', 'name age').lean();

    if (!conversation) {
      logger.error(`[Finalize] Conversation ${conversationId} not found`);
      return;
    }

    const callLean = conversation.callId ? await Call.findById(conversation.callId).select('startTime').lean() : null;
    const callStart = callLean?.startTime ? new Date(callLean.startTime) : null;
    const conversationCreatedAt = conversation.createdAt ? new Date(conversation.createdAt) : null;

    let messages;
    let conversationText;

    if (useRealtimeMessages) {
      // Get messages from Message collection (realtime calls) - same conversationId the UI uses
      messages = await Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .select('role content timestamp createdAt')
        .lean();

      // Fallback: if Message.find returned nothing but conversation has messages (split/call vs conversation),
      // use conversation.messages (same source as live call UI) so sentiment always sees what the UI sees
      if (!messages || messages.length === 0) {
        const convWithMessages = await Conversation.findById(conversationId).populate('messages').lean();
        const refs = (convWithMessages && convWithMessages.messages) || [];
        if (refs.length > 0) {
          messages = refs
            .filter((m) => m && m.content != null)
            .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
          logger.info(
            `[Finalize] Using conversation.messages (${messages.length}) for conversation ${conversationId} (Message.find had 0)`
          );
        }
      }

      if (!messages || messages.length === 0) {
        // No messages: still run summary + sentiment on fallback so every call has sentiment
        messages = [];
        conversationText = 'No conversation content recorded.';
      } else {
        conversationText = buildTranscriptForSummarization(messages, callStart, conversationCreatedAt);
      }
    } else {
      // Use existing conversation.messages array
      const populatedConversation = await Conversation.findById(conversationId).populate('messages');
      messages = populatedConversation.messages || [];

      if (messages.length === 0) {
        // No messages: still run summary + sentiment on fallback so every call has sentiment
        conversationText = 'No conversation content recorded.';
      } else {
        conversationText = buildTranscriptForSummarization(messages, callStart, conversationCreatedAt);
      }
    }

    const conversationEngagement =
      messages && messages.length > 0
        ? computeConversationEngagementMetrics(messages.map((m) => ({ role: m.role, content: m.content })))
        : null;

    if (conversationEngagement && conversationEngagement.lastTurnDeadEnd === true) {
      logger.info(
        `[Finalize] Conversation ${conversationId} last assistant turn tagged as dead-end (no question/callback/invitation)`
      );
    }

    // Determine user domain
    let userDomain = 'client wellness conversation';
    if (conversation.clientId && conversation.clientId.age >= 65) {
      userDomain = 'elderly wellness conversation';
    }
    const summaryPrompt =
      "Create a concise summary of this client conversation with Bianca, highlighting key topics discussed, any concerns raised, and the client's overall mood or needs.";
    let summary = 'Summary generation failed - manual review needed';

    try {
      summary = await langChainAPI.summarizeConversation(summaryPrompt, conversationText, userDomain);
      summary = sanitizeSummaryDatePlaceholders(summary, callStart, conversationCreatedAt);
    } catch (summaryErr) {
      logger.error(`[Finalize] Error generating summary for conversation ${conversationId}: ${summaryErr.message}`);
    }

    // Perform sentiment analysis on the conversation
    let sentimentAnalysis = null;
    try {
      const { getOpenAISentimentServiceInstance } = require('./openai.sentiment.service');
      const sentimentService = getOpenAISentimentServiceInstance();

      logger.info(`[Finalize] Starting sentiment analysis for conversation ${conversationId}`);
      sentimentAnalysis = await sentimentService.analyzeSentiment(conversationText, {
        detailed: true,
      });

      if (sentimentAnalysis.success) {
        logger.info(
          `[Finalize] Sentiment analysis completed for conversation ${conversationId}: ${sentimentAnalysis.data.overallSentiment}`
        );
      } else {
        logger.warn(`[Finalize] Sentiment analysis failed for conversation ${conversationId}: ${sentimentAnalysis.error}`);
      }
    } catch (sentimentErr) {
      logger.error(
        `[Finalize] Error during sentiment analysis for conversation ${conversationId}: ${sentimentErr.message}`,
        sentimentErr
      );
    }

    // Update conversation with summary and sentiment analysis (summary + history: digest UI prefers summary)
    const updateData = {
      history: summary,
      summary,
    };

    // Add sentiment analysis to analyzedData if successful
    if (sentimentAnalysis && sentimentAnalysis.success) {
      updateData['analyzedData.sentiment'] = sentimentAnalysis.data;
      updateData['analyzedData.sentimentAnalyzedAt'] = new Date();
    }

    if (conversationEngagement) {
      updateData['analyzedData.conversationEngagement'] = {
        ...conversationEngagement,
        computedAt: new Date(),
      };
    }

    const requiredCallQuestionsService = require('./requiredCallQuestions.service');
    const clientIdForRequired =
      conversation.clientId && (conversation.clientId._id || conversation.clientId);
    if (clientIdForRequired && conversationText && conversationText !== 'No conversation content recorded.') {
      try {
        const { enabled, questions } = await requiredCallQuestionsService.getQuestionsForClient(clientIdForRequired);
        if (enabled && questions.length > 0) {
          const answers = await requiredCallQuestionsService.extractAnswersFromTranscript(
            conversationText,
            questions
          );
          updateData['analyzedData.requiredQuestions'] = {
            answers,
            capturedAt: new Date(),
            callId: conversation.callId || undefined,
          };
        }
      } catch (reqErr) {
        logger.error(
          `[Finalize] Required question extraction failed for conversation ${conversationId}: ${reqErr.message}`
        );
      }
    }

    await Conversation.findByIdAndUpdate(conversationId, updateData);

    // Update the associated Call's endTime instead of Conversation
    const convWithCall = await Conversation.findById(conversationId).populate('callId');
    if (convWithCall && convWithCall.callId) {
      await Call.findByIdAndUpdate(convWithCall.callId, {
        endTime: new Date(),
        status: 'completed',
        callStatus: 'ended',
      });
    }

    logger.info(
      `[Finalize] Successfully finalized conversation ${conversationId} with ${messages.length} messages${
        sentimentAnalysis && sentimentAnalysis.success ? ' and sentiment analysis' : ''
      }`
    );

    // Trigger medical and fraud/abuse analysis after call completion (async, don't wait)
    const clientIdForAnalysis = conversation.clientId && (conversation.clientId._id || conversation.clientId);
    if (clientIdForAnalysis) {
      logger.info(
        `[Finalize] Scheduling post-call analysis for client ${clientIdForAnalysis} from conversation ${conversationId}`
      );
      triggerAnalysisAfterCall(clientIdForAnalysis, conversationId).catch((err) => {
        logger.error(
          `[Finalize] Error triggering analysis after call for client ${clientIdForAnalysis}: ${err.message}`,
          err
        );
      });

      // Extract and store client memory facts (async, don't wait) when aiAnalysis consent granted
      if (clientIdForAnalysis && conversationText && conversationText !== 'No conversation content recorded.') {
        const clientService = require('./client.service');
        const hasAiAnalysisConsent = await clientService.checkClientConsent(clientIdForAnalysis, 'aiAnalysis');
        if (hasAiAnalysisConsent) {
          const { extractAndStoreFacts } = require('./clientMemory.service');
          extractAndStoreFacts(clientIdForAnalysis, conversationId, conversationText).catch((err) => {
            logger.error(`[Finalize] Error extracting memory facts for client ${clientIdForAnalysis}: ${err.message}`, err);
          });
        } else {
          logger.info(
            `[Finalize] Skipping memory extraction — aiAnalysis consent not granted for client ${clientIdForAnalysis}`
          );
        }
      }
    }

    return {
      summary,
      sentimentAnalysis: sentimentAnalysis && sentimentAnalysis.success ? sentimentAnalysis.data : null,
      conversationEngagement,
    };
  } catch (err) {
    logger.error(`[Finalize] Error: ${err.message}`, err);

    // Fallback update using existing history field
    try {
      await Conversation.findByIdAndUpdate(conversationId, {
        history: 'Summary generation failed - manual review needed',
        summary: 'Summary generation failed - manual review needed',
        endTime: new Date(),
        status: 'completed',
      });
    } catch (updateErr) {
      logger.error(`[Finalize] Failed to update: ${updateErr.message}`);
    }

    return {
      summary: 'Summary generation failed - manual review needed',
      sentimentAnalysis: null,
      conversationEngagement: null,
    };
  }
};

/**
 * Get formatted client context for other services
 */
const getClientContext = async (clientId) => {
  try {
    const client = await Client.findById(clientId).select('name email phone preferredName notes age').lean();

    if (!client) {
      throw new ApiError(httpStatus.NOT_FOUND, `Client ${clientId} not found`);
    }

    return {
      name: client.name,
      preferredName: client.preferredName || client.name,
      email: client.email,
      phone: client.phone,
      age: client.age || null,
      notes: client.notes || null,
      hasWellnessNotes: !!(client.notes && client.notes.trim().length > 0),
    };
  } catch (err) {
    logger.error(`[Client Context] Error getting context for client ${clientId}: ${err.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to get client context: ${err.message}`);
  }
};

// getSentimentTrend and getSentimentSummary moved to sentiment.service.js

// Medical Analysis Methods
// In-memory storage for medical baselines (for testing purposes)
const medicalBaselines = new Map();

const getMedicalBaseline = async (clientId) => {
  try {
    // Return stored baseline if it exists
    return medicalBaselines.get(clientId) || null;
  } catch (error) {
    logger.error('Error getting medical baseline:', error);
    throw error;
  }
};

const storeMedicalBaseline = async (clientId, baseline) => {
  try {
    // Store baseline in memory
    medicalBaselines.set(clientId, baseline);
    logger.info('Medical baseline stored', { clientId, baselineVersion: baseline.version });
  } catch (error) {
    logger.error('Error storing medical baseline:', error);
    throw error;
  }
};

// Helper function to clear baselines (for testing)
const clearMedicalBaselines = () => {
  medicalBaselines.clear();
};

const getMedicalAnalysisResults = async (clientId, limit = 10) => {
  try {
    const MedicalAnalysis = require('../models/medicalAnalysis.model');

    const results = await MedicalAnalysis.find({ clientId }).sort({ analysisDate: -1 }).limit(limit).lean(); // Use lean() for better performance since we don't need Mongoose documents

    logger.info('Retrieved medical analysis results', {
      clientId,
      count: results.length,
      limit,
    });

    return results;
  } catch (error) {
    logger.error('Error getting medical analysis results:', error);
    throw error;
  }
};

const storeMedicalAnalysisResult = async (clientId, result) => {
  try {
    const MedicalAnalysis = require('../models/medicalAnalysis.model');

    // Calculate time series data and trends
    const timeSeriesData = calculateTimeSeriesData(result);
    const trends = await calculateTrends(clientId, timeSeriesData);

    // Clean and validate the analysis data before storing
    const cleanedResult = cleanAnalysisData(result);

    // Create medical analysis document
    const medicalAnalysis = new MedicalAnalysis({
      clientId,
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
      version: '1.0',
    });

    // Final safety check - ensure patterns is always an array
    if (
      medicalAnalysis.cognitiveMetrics &&
      medicalAnalysis.cognitiveMetrics.detailedAnalysis &&
      medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow &&
      medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns
    ) {
      const { patterns } = medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow;
      logger.debug('Final patterns check', {
        patternsType: typeof patterns,
        isArray: Array.isArray(patterns),
        patternsValue: patterns,
      });

      if (typeof patterns === 'string') {
        try {
          const parsed = JSON.parse(patterns);
          medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns = Array.isArray(parsed) ? parsed : [];
          logger.debug('Parsed patterns from string', {
            count: medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns.length,
          });
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
        medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns =
          medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns.map((pattern) => ({
            messageIndex: Number(pattern.messageIndex) || 0,
            type: String(pattern.type) || 'unknown',
            coherenceRatio: Number(pattern.coherenceRatio) || 0,
          }));
        logger.debug('Final patterns structure', {
          count: medicalAnalysis.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns.length,
        });
      }
    }

    await medicalAnalysis.save();
    logger.info('Medical analysis result stored with time series data', {
      clientId,
      analysisId: medicalAnalysis._id,
      analysisDate: medicalAnalysis.analysisDate,
      timeSeriesData,
      trends,
    });

    scheduleClientAnalysisUpdated(clientId, 'medical');

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
    hasConversationFlow: !!(
      cleaned.cognitiveMetrics &&
      cleaned.cognitiveMetrics.detailedAnalysis &&
      cleaned.cognitiveMetrics.detailedAnalysis.conversationFlow
    ),
    patternsType: typeof (
      cleaned.cognitiveMetrics &&
      cleaned.cognitiveMetrics.detailedAnalysis &&
      cleaned.cognitiveMetrics.detailedAnalysis.conversationFlow &&
      cleaned.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns
    ),
    patternsValue:
      cleaned.cognitiveMetrics &&
      cleaned.cognitiveMetrics.detailedAnalysis &&
      cleaned.cognitiveMetrics.detailedAnalysis.conversationFlow &&
      cleaned.cognitiveMetrics.detailedAnalysis.conversationFlow.patterns,
  });

  // Fix conversationFlow patterns if they're malformed
  if (
    cleaned.cognitiveMetrics &&
    cleaned.cognitiveMetrics.detailedAnalysis &&
    cleaned.cognitiveMetrics.detailedAnalysis.conversationFlow
  ) {
    const { conversationFlow } = cleaned.cognitiveMetrics.detailedAnalysis;

    if (conversationFlow.patterns) {
      const { patterns } = conversationFlow;

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
        conversationFlow.patterns = conversationFlow.patterns.map((pattern) => ({
          messageIndex: Number(pattern.messageIndex) || 0,
          type: String(pattern.type) || 'unknown',
          coherenceRatio: Number(pattern.coherenceRatio) || 0,
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
  if (cleaned.psychiatricMetrics && cleaned.psychiatricMetrics.indicators) {
    const validTypes = [
      'depression',
      'anxiety',
      'crisis',
      'absolutist_language',
      'pronoun_usage',
      'temporal_focus',
      'negative_tone',
    ];
    cleaned.psychiatricMetrics.indicators = cleaned.psychiatricMetrics.indicators
      .filter((indicator) => validTypes.includes(indicator.type))
      .map((indicator) => ({
        type: indicator.type,
        severity: indicator.severity || 'low',
        message: indicator.message || '',
        details: indicator.details || '',
      }));
    logger.debug('Cleaned psychiatric indicators', { count: cleaned.psychiatricMetrics.indicators.length });
  }

  return cleaned;
};

const deleteOldMedicalAnalyses = async (cutoffDate) => {
  try {
    const MedicalAnalysis = require('../models/medicalAnalysis.model');

    const result = await MedicalAnalysis.deleteMany({
      analysisDate: { $lt: cutoffDate },
    });

    logger.info('Deleted old medical analyses', {
      deletedCount: result.deletedCount,
      cutoffDate,
    });

    return result;
  } catch (error) {
    logger.error('Error deleting old medical analyses:', error);
    throw error;
  }
};

const getActiveClients = async () => {
  try {
    return [];
  } catch (error) {
    logger.error('Error getting active clients:', error);
    throw error;
  }
};

const getConversationsByClientAndDateRange = async (clientId, startDate, endDate) => {
  try {
    const conversations = await Conversation.find({
      clientId,
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .populate('messages')
      .sort({ createdAt: 1 });
    return conversations;
  } catch (error) {
    logger.error('Error getting conversations by client and date range:', error);
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
    cognitiveScore: (result.cognitiveMetrics && result.cognitiveMetrics.riskScore) || 0,
    mentalHealthScore: (result.psychiatricMetrics && result.psychiatricMetrics.overallRiskScore) || 0,
    languageScore: (result.vocabularyMetrics && result.vocabularyMetrics.complexityScore) || 0,
    overallHealthScore: calculateOverallHealthScore(result),
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
  if (result.cognitiveMetrics && result.cognitiveMetrics.riskScore > 0) {
    score -= Math.min(result.cognitiveMetrics.riskScore * 0.3, 30);
  }

  // Deduct points for psychiatric issues
  if (result.psychiatricMetrics && result.psychiatricMetrics.depressionScore > 0) {
    score -= Math.min(result.psychiatricMetrics.depressionScore * 0.2, 25);
  }

  if (result.psychiatricMetrics && result.psychiatricMetrics.anxietyScore > 0) {
    score -= Math.min(result.psychiatricMetrics.anxietyScore * 0.15, 20);
  }

  // Deduct points for crisis indicators
  if (
    result.psychiatricMetrics &&
    result.psychiatricMetrics.crisisIndicators &&
    result.psychiatricMetrics.crisisIndicators.hasCrisisIndicators
  ) {
    score -= 25;
  }

  return Math.max(Math.round(score), 0);
};

/**
 * Calculate trends by comparing with previous analyses
 * @param {string} clientId - Client ID
 * @param {Object} currentTimeSeriesData - Current time series data
 * @returns {Object} Trend indicators
 */
const calculateTrends = async (clientId, currentTimeSeriesData) => {
  try {
    const MedicalAnalysis = require('../models/medicalAnalysis.model');

    // Get the last 3 analyses for trend calculation
    const previousAnalyses = await MedicalAnalysis.find({ clientId })
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
        overall: 'stable',
      };
    }

    // Calculate trends using linear regression on the last few data points
    const trends = {};

    // Calculate trend for each metric
    ['cognitiveScore', 'mentalHealthScore', 'languageScore', 'overallHealthScore'].forEach((metric) => {
      const values = [
        currentTimeSeriesData[metric],
        ...previousAnalyses.map((a) => (a.timeSeriesData && a.timeSeriesData[metric]) || 0),
      ];
      trends[metric.replace('Score', '')] = calculateLinearTrend(values);
    });

    return trends;
  } catch (error) {
    logger.error('Error calculating trends:', error);
    return {
      cognitive: 'stable',
      mentalHealth: 'stable',
      language: 'stable',
      overall: 'stable',
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
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;

  return variance;
};

/**
 * Trigger medical and fraud/abuse analysis after a call completes
 * This runs asynchronously and doesn't block call finalization
 * @param {string} clientId - Client ID
 */
const triggerAnalysisAfterCall = async (clientId, conversationId = null) => {
  try {
    logger.info(`[Analysis Trigger] Triggering analysis after call for client ${clientId}`);

    // Trigger medical analysis
    try {
      const MedicalPatternAnalyzer = require('./ai/medicalPatternAnalyzer.service');
      const analyzer = new MedicalPatternAnalyzer();

      // Get all conversations for the patient
      const conversations = await getConversationsByClient(clientId);
      logger.info(`[Analysis Trigger] Medical analysis input for client ${clientId}: ${conversations.length} conversations`);

      if (conversations.length > 0) {
        // Get baseline analysis (previous result)
        const baselineResults = await getMedicalAnalysisResults(clientId, 1);
        const baseline = baselineResults.length > 0 ? baselineResults[0] : null;

        // Perform medical pattern analysis
        logger.info(`[Analysis Trigger] Medical analysis baseline ${baseline ? 'found' : 'missing'} for client ${clientId}`);
        const analysisResult = await analyzer.analyzeMonth(conversations, baseline);
        logger.info(
          `[Analysis Trigger] Medical analysis result for client ${clientId}: ` +
            `confidence=${(analysisResult && analysisResult.confidence) || 'unknown'}, warnings=${
              ((analysisResult && analysisResult.warnings) || []).length || 0
            }`
        );

        // Store analysis result
        const resultToStore = {
          ...analysisResult,
          trigger: 'automatic_after_call',
          batchId: `auto-${Date.now()}`,
          processingTime: 0,
        };

        await storeMedicalAnalysisResult(clientId, resultToStore);
        logger.info(
          `[Analysis Trigger] Medical analysis stored for client ${clientId} ` + `(conversations=${conversations.length})`
        );

        logger.info(`[Analysis Trigger] Medical analysis completed for client ${clientId}`, {
          conversationCount: conversations.length,
          confidence: analysisResult.confidence,
        });
      } else {
        logger.info(`[Analysis Trigger] No conversations found for client ${clientId}, skipping medical analysis`);
      }
    } catch (medicalErr) {
      logger.error(`[Analysis Trigger] Error in medical analysis for client ${clientId}: ${medicalErr.message}`);
    }

    // Trigger fraud/abuse analysis — must upsert the *current calendar month* document so
    // GET /fraud-abuse-analysis?timeRange=month (Resident page cards) shows fresh numbers after each call.
    try {
      const FraudAbuseAnalyzer = require('./ai/fraudAbuseAnalyzer.service');
      const FraudAbuseAnalysis = require('../models/fraudAbuseAnalysis.model');
      const analyzer = new FraudAbuseAnalyzer();

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthConversations = await getConversationsByClientAndDateRange(clientId, monthStart, monthEnd);

      logger.info(
        `[Analysis Trigger] Fraud/abuse (month) input for client ${clientId}: ${monthConversations.length} conversations in current month window`
      );

      if (monthConversations.length > 0) {
        const baselineResults = await FraudAbuseAnalysis.find({ clientId }).sort({ analysisDate: -1 }).limit(1);
        const baseline = baselineResults.length > 0 ? baselineResults[0] : null;

        logger.info(`[Analysis Trigger] Fraud/abuse baseline ${baseline ? 'found' : 'missing'} for client ${clientId}`);
        const analysisResult = await analyzer.analyzeConversations(monthConversations, baseline);
        logger.info(
          `[Analysis Trigger] Fraud/abuse analysis result for client ${clientId}: ` +
            `confidence=${(analysisResult && analysisResult.confidence) || 'unknown'}, warnings=${
              ((analysisResult && analysisResult.warnings) || []).length || 0
            }`
        );

        const setDoc = {
          clientId,
          analysisDate: new Date(),
          timeRange: 'month',
          startDate: monthStart,
          endDate: monthEnd,
          conversationCount: monthConversations.length,
          messageCount: analysisResult.messageCount,
          totalWords: analysisResult.totalWords,
          financialRisk: analysisResult.financialRisk,
          abuseRisk: analysisResult.abuseRisk,
          relationshipRisk: analysisResult.relationshipRisk,
          overallRiskScore: analysisResult.overallRiskScore,
          changeFromBaseline: analysisResult.changeFromBaseline,
          confidence: analysisResult.confidence,
          warnings: analysisResult.warnings,
          recommendations: analysisResult.recommendations,
          processingTime: 0,
          version: '1.0',
        };

        await FraudAbuseAnalysis.findOneAndUpdate(
          { clientId, timeRange: 'month', startDate: monthStart, endDate: monthEnd },
          { $set: setDoc },
          { upsert: true, new: true }
        );

        scheduleClientAnalysisUpdated(clientId, 'fraudAbuse');

        try {
          const { createSignificantDollarFraudAlertIfNeeded } = require('./alert.service');
          await createSignificantDollarFraudAlertIfNeeded({
            clientId,
            conversationId,
            maxEstimatedUsd: analysisResult.financialRisk && analysisResult.financialRisk.maxEstimatedUsd,
            financialRiskScore: analysisResult.financialRisk && analysisResult.financialRisk.riskScore,
          });
        } catch (alertErr) {
          logger.error(
            `[Analysis Trigger] Significant-dollar fraud alert for client ${clientId}: ${alertErr.message}`,
            alertErr
          );
        }

        logger.info(`[Analysis Trigger] Fraud/abuse month record upserted for client ${clientId}`, {
          conversationCount: monthConversations.length,
          confidence: analysisResult.confidence,
          overallRiskScore: analysisResult.overallRiskScore,
        });
      } else {
        logger.info(
          `[Analysis Trigger] No conversations in current month for client ${clientId}, skipping fraud/abuse month upsert`
        );
      }
    } catch (fraudErr) {
      logger.error(`[Analysis Trigger] Error in fraud/abuse analysis for client ${clientId}: ${fraudErr.message}`);
    }

    logger.info(`[Analysis Trigger] Completed analysis triggering for client ${clientId}`);
  } catch (error) {
    logger.error(`[Analysis Trigger] Error triggering analysis after call for client ${clientId}: ${error.message}`, error);
  }
};

module.exports = {
  createConversationForClient,
  addMessageToConversation,
  getConversationById,
  getConversationsByClient,
  queryConversationsByClient,
  getConversationHistory,
  buildEnhancedPrompt,
  saveRealtimeMessage,
  finalizeConversation,
  getClientContext,
  getMedicalBaseline,
  storeMedicalBaseline,
  clearMedicalBaselines,
  getMedicalAnalysisResults,
  storeMedicalAnalysisResult,
  deleteOldMedicalAnalyses,
  getActiveClients,
  getConversationsByClientAndDateRange,
  calculateLinearTrend,
  calculateVariance,
  SUMMARY_FALLBACK_MAX_AGE_DAYS,
  SUMMARY_FALLBACK_MAX_CONVERSATIONS,
};
