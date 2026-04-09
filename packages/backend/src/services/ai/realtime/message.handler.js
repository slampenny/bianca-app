/**
 * Message Handler
 * Handles OpenAI message parsing, routing, and processing
 */

const logger = require('../../../config/logger');
const config = require('../../../config/config');

/**
 * Message Handler
 * Provides message parsing and routing functionality
 */
class MessageHandler {
  /**
   * Normalize transcript from conversation.item.input_audio_transcription.completed (GA may use top-level or nested fields).
   */
  static extractUserInputTranscript(message) {
    if (!message || typeof message !== 'object') return '';
    if (typeof message.transcript === 'string' && message.transcript.trim()) {
      return message.transcript.trim();
    }
    const nested = message.item?.input_audio_transcription?.transcript;
    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }
    return '';
  }

  /**
   * Parse and validate OpenAI message
   * @param {string|Buffer} data - Raw message data
   * @returns {Object|null} Parsed message object or null if invalid
   */
  static parseMessage(data) {
    try {
      const message = JSON.parse(data);
      return message;
    } catch (err) {
      logger.error(`[Message Handler] Failed JSON parse: ${err.message}`);
      return null;
    }
  }

  /**
   * Build session configuration for session.update
   * Always uses GA format
   * @param {Object} connection - Connection object
   * @returns {Object} Session configuration object
   */
  static buildSessionConfig(connection) {
    const voice = config.openai.realtimeVoice || 'alloy';
    const transcriptionModel = config.openai.realtimeTranscriptionModel || 'gpt-4o-mini-transcribe';
    // ISO-639-1 — matches Client.preferredLanguage enum; avoids ASR auto-detect picking wrong language
    const rawLang = connection?.preferredLanguage;
    const transcriptionLanguage =
      typeof rawLang === 'string' && /^[a-z]{2}$/i.test(rawLang) ? rawLang.toLowerCase() : 'en';

    const baseConfig = {
      type: 'session.update',
      session: {
        instructions: connection.initialPrompt || 'You are Bianca, a helpful AI assistant. Always respond in English.',
        // GA format: Audio settings nested under session.audio
        // GA requires session.type to be set
        // GA uses audio/pcmu (not g711_ulaw) for μ-law format
        type: 'realtime',
      },
    };

    // GA format: Audio settings nested under session.audio
    // GA requires session.type to be set
    // GA uses audio/pcmu (not g711_ulaw) for μ-law format
    baseConfig.session.type = 'realtime';
    
    // Get OpenAI noise reduction setting (near_field for phone calls, far_field for speakerphone, null to disable)
    // GA Realtime API expects an object { type: 'near_field' | 'far_field' }, not a bare string
    const openaiNoiseReductionRaw = config.audio?.openaiNoiseReduction || 'near_field';
    let noiseReductionObject = null;
    if (openaiNoiseReductionRaw && openaiNoiseReductionRaw !== 'null') {
      const mode =
        openaiNoiseReductionRaw === 'near_field' || openaiNoiseReductionRaw === 'far_field'
          ? openaiNoiseReductionRaw
          : 'near_field';
      noiseReductionObject = { type: mode };
    }

    // Get turn detection settings from config (with defaults)
    const turnDetectionThreshold = config.audio?.turnDetection?.threshold ?? 0.6;
    const turnDetectionPrefixPadding = config.audio?.turnDetection?.prefixPaddingMs ?? 200;
    // Require ≥1000ms silence before treating utterance as complete (product + OpenAI VAD floor)
    const turnDetectionSilenceDuration = Math.max(
      1000,
      config.audio?.turnDetection?.silenceDurationMs ?? 1000
    );
    const vadCreateResponse = config.audio?.turnDetection?.createResponse === true;

    baseConfig.session.audio = {
      input: {
        format: {
          type: 'audio/pcmu'  // GA uses audio/pcmu instead of g711_ulaw
        },
        transcription: {
          model: transcriptionModel,
          language: transcriptionLanguage,
        },
        // OpenAI built-in noise reduction (optimized for phone calls)
        noise_reduction: noiseReductionObject,
        // Turn detection is nested under audio.input for GA
        turn_detection: {
          type: 'server_vad',
          threshold: turnDetectionThreshold,
          prefix_padding_ms: turnDetectionPrefixPadding,
          silence_duration_ms: turnDetectionSilenceDuration,
          // false (default): we own response.create via sendResponseCreate. true: set OPENAI_REALTIME_VAD_CREATE_RESPONSE=true for A/B (OpenAI auto response on VAD stop).
          create_response: vadCreateResponse,
        }
      },
      output: {
        format: {
          type: 'audio/pcmu'  // GA uses audio/pcmu instead of g711_ulaw
        },
        voice: voice  // Voice is in audio.output for GA
      }
    };

    // Onboarding structured capture is handled server-side (transcripts / future pipelines), not via Realtime tools.

    const td = baseConfig.session.audio.input.turn_detection;
    const sessionShape = {
      type: baseConfig.type,
      session: {
        type: baseConfig.session.type,
        hasInstructions: Boolean(baseConfig.session.instructions),
        audio: {
          input: {
            format: baseConfig.session.audio.input.format,
            transcription: {
              model: baseConfig.session.audio.input.transcription.model,
              language: baseConfig.session.audio.input.transcription.language,
            },
            noise_reduction: baseConfig.session.audio.input.noise_reduction,
            turn_detection: td,
          },
          output: { format: baseConfig.session.audio.output.format, voice: baseConfig.session.audio.output.voice },
        },
        hasTools: Boolean(baseConfig.session.tools),
        tool_choice: baseConfig.session.tool_choice,
      },
    };
    logger.info(
      `[RealtimeRC] buildSessionConfig sessionShape=${JSON.stringify(sessionShape)} correlation=${connection?.callSid || connection?.asteriskChannelId || 'n/a'}`
    );
    logger.info(
      `[RealtimeRC] buildSessionConfig turn_detection.create_response=${vadCreateResponse} (env OPENAI_REALTIME_VAD_CREATE_RESPONSE=${process.env.OPENAI_REALTIME_VAD_CREATE_RESPONSE ?? 'unset'}) correlation=${connection?.callSid || connection?.asteriskChannelId || 'n/a'}`
    );

    return baseConfig;
  }

  /**
   * Handle response audio delta - process audio chunk
   * @param {Object} connection - Connection object
   * @param {Object} message - Message object with delta
   * @param {Function} processAudioCallback - Callback to process audio (callId, audioBase64) => Promise<void>
   * @returns {boolean} True if audio was processed
   */
  static handleResponseAudioDelta(connection, message, processAudioCallback) {
    const eventType = 'response.output_audio.delta'; // GA event name
    
    if (!message.delta || typeof message.delta !== 'string' || message.delta.length === 0) {
      logger.warn(`[Message Handler] Received '${eventType}' but 'message.delta' (audio data) is missing or empty.`);
      return false;
    }

    if (connection) {
      if (!connection._openaiChunkCount) connection._openaiChunkCount = 0;
      connection._openaiChunkCount++;

      // Log first few chunks for debugging
      if (connection._openaiChunkCount <= 5 || connection._openaiChunkCount % 50 === 0) {
        logger.info(`[Message Handler] Processing ${eventType} #${connection._openaiChunkCount} (GA), data length: ${message.delta.length}`);
      }
    }

    if (processAudioCallback) {
      processAudioCallback(message.delta).catch((err) => {
        logger.error(`[Message Handler] Error processing audio: ${err.message}`);
      });
    }

    return true;
  }

  /**
   * Handle content part added - accumulate text or process audio
   * @param {Object} connection - Connection object
   * @param {Object} message - Message object with part
   * @param {Function} onTextDelta - Callback for text deltas (callId, text) => void
   * @param {Function} processAudioCallback - Callback to process audio (callId, audioBase64) => Promise<void>
   */
  static handleContentPartAdded(connection, message, onTextDelta, processAudioCallback) {
    const part = message.part;
    if (!part) {
      logger.warn(`[Message Handler] No part in content_part.added message`);
      return;
    }

    if (part.type === 'text') {
      logger.info(`[Message Handler] Received TEXT content part: "${part.text}"`);

      // Accumulate AI text instead of saving immediately
      if (connection) {
        connection.pendingAssistantTranscript += (connection.pendingAssistantTranscript ? ' ' : '') + part.text;
        connection.lastAssistantTextTime = Date.now();
        logger.info(`[Message Handler] Accumulated assistant text: "${connection.pendingAssistantTranscript}"`);
      }

      if (onTextDelta) {
        onTextDelta(part.text, connection?.sessionId);
      }

    } else if (part.type === 'audio') {
      logger.info(`[Message Handler] Received 'response.content_part.added' with part_type=audio.`);
      if (part.audio && typeof part.audio === 'string' && part.audio.length > 0) {
        if (processAudioCallback) {
          processAudioCallback(part.audio).catch((err) => {
            logger.error(`[Message Handler] Error processing audio: ${err.message}`);
          });
        }
      }
    } else {
      logger.debug(`[Message Handler] Unhandled part type '${part.type}' in response.content_part.added`);
    }
  }

  /**
   * Handle response audio transcript delta
   * @param {Object} connection - Connection object
   * @param {Object} message - Message object with delta
   */
  static handleResponseAudioTranscriptDelta(connection, message) {
    if (!message.delta) return;

    logger.info(`[Message Handler] Audio transcript delta: "${message.delta}"`);

    // Don't accumulate audio transcripts - we already have the text content
    // Audio transcripts are for monitoring/debugging, not for conversation storage
    logger.debug(`[Message Handler] Skipping audio transcript accumulation - using text content instead`);
  }

  /**
   * Handle response audio transcript done
   * @param {Object} connection - Connection object
   * @param {Object} message - Message object with transcript
   */
  static handleResponseAudioTranscriptDone(connection, message) {
    if (!message.transcript) return;

    logger.info(`[Message Handler] AI audio transcript completed: "${message.transcript}"`);

    // Store the transcript for saving when AI finishes speaking (response.done)
    if (connection) {
      connection.pendingAssistantTranscript = message.transcript.trim();
      logger.info(`[Message Handler] Stored assistant transcript for later saving: "${message.transcript}"`);
    }
  }

  /**
   * Handle conversation item - process item data
   * @param {Object} item - Conversation item object
   * @param {string} dbConversationId - Database conversation ID
   * @param {Function} saveAudioTranscriptCallback - Callback to save audio transcript (conversationId, role, transcript, messageType) => Promise<void>
   */
  static async handleConversationItem(item, dbConversationId, saveAudioTranscriptCallback) {
    if (!item) return;

    try {
      // Skip saving completed messages here - they're now saved when speakers finish
      // (AI text is accumulated and saved in handleResponseDone, user transcription in handleInputAudioTranscriptionCompleted)
      if (item.type === 'message' && item.status === 'completed') {
        logger.debug(`[Message Handler] Skipping immediate save of ${item.role} message - will be saved when speaker finishes`);
      }

      // Only save completed audio transcripts
      if (item.audio?.transcript && dbConversationId) {
        if (saveAudioTranscriptCallback) {
          await saveAudioTranscriptCallback(
            dbConversationId,
            item.role,
            item.audio.transcript,
            item.role === 'assistant' ? 'assistant_response' : 'user_message'
          );
          logger.info(`[Message Handler] Saved ${item.role} audio transcript to conversation ${dbConversationId}`);
        }
      }

      // Handle function calls
      if (item.type === 'function_call') {
        logger.info(`[Message Handler] Function call received: ${item.function_call?.name || 'unknown'}`);
        // Function call handling would go here if needed
      }
    } catch (err) {
      logger.error(`[Message Handler] Error in handleConversationItem: ${err.message}`, err);
    }
  }
}

module.exports = MessageHandler;

