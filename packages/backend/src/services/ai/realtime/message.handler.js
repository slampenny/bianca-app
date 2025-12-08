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
   * @param {Object} connection - Connection object
   * @returns {Object} Session configuration object
   */
  static buildSessionConfig(connection) {
    return {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: connection.initialPrompt || 'You are Bianca, a helpful AI assistant. Always respond in English.',
        voice: config.openai.realtimeVoice || 'alloy',
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',

        // CRITICAL: Add turn detection - optimized for faster response and natural interruptions
        // Reduced delays for more conversational feel
        turn_detection: {
          type: 'server_vad',
          threshold: 0.6,              // More selective (ignores quiet background)
          prefix_padding_ms: 200,      // Reduced from 300ms - faster speech start detection
          silence_duration_ms: 500     // Reduced from 1000ms - faster response after user stops speaking
        },

        // Add input transcription for debugging
        input_audio_transcription: {
          model: 'whisper-1',
        }
      },
    };
  }

  /**
   * Handle response audio delta - process audio chunk
   * @param {Object} connection - Connection object
   * @param {Object} message - Message object with delta
   * @param {Function} processAudioCallback - Callback to process audio (callId, audioBase64) => Promise<void>
   * @returns {boolean} True if audio was processed
   */
  static handleResponseAudioDelta(connection, message, processAudioCallback) {
    if (!message.delta || typeof message.delta !== 'string' || message.delta.length === 0) {
      logger.warn(`[Message Handler] Received 'response.audio.delta' but 'message.delta' (audio data) is missing or empty.`);
      return false;
    }

    if (connection) {
      if (!connection._openaiChunkCount) connection._openaiChunkCount = 0;
      connection._openaiChunkCount++;

      // Log first few chunks for debugging
      if (connection._openaiChunkCount <= 5 || connection._openaiChunkCount % 50 === 0) {
        logger.info(`[Message Handler] Processing response.audio.delta #${connection._openaiChunkCount}, data length: ${message.delta.length}`);
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

