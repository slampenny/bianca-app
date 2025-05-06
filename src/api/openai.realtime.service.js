// src/services/openai.realtime.service.js

const WebSocket = require('ws');
const { Buffer } = require('buffer');
const config = require('../config/config');
const logger = require('../config/logger');
const { Message } = require('../models'); // Assuming Message model is used for saving transcripts
const AudioUtils = require('./audio.utils'); // Assumes this uses alawmulaw and has resamplePcm

/**
 * Constants for configuration
 */
const CONSTANTS = {
    MAX_PENDING_CHUNKS: 100, // Maximum number of audio chunks to buffer
    RECONNECT_MAX_ATTEMPTS: 5, // Maximum number of reconnection attempts
    RECONNECT_BASE_DELAY: 1000, // Base delay for exponential backoff (milliseconds)
    COMMIT_DEBOUNCE_DELAY: 1000, // Using 1 second delay - ADJUST IF NEEDED
    CONNECTION_TIMEOUT: 10000, // WebSocket connection timeout (milliseconds)
    DEFAULT_SAMPLE_RATE: 8000, // Rate of audio FROM Asterisk (PCM) & FOR Asterisk (uLaw)
    OPENAI_PCM_OUTPUT_RATE: 24000, // Expected rate FROM OpenAI for pcm16 output
};

/**
 * Manages connections to OpenAI's realtime API
 * Handles audio transcoding, message tracking, and connection lifecycle
 */
class OpenAIRealtimeService {
    constructor() {
        // Key is now the primary call identifier (e.g., Twilio CallSid)
        this.connections = new Map(); // callId -> connection state object
        this.pendingAudio = new Map(); // callId -> array of base64 PCM audio chunks from Asterisk TCP Server
        this.commitTimers = new Map(); // callId -> debounce timers
        this.isReconnecting = new Map(); // callId -> boolean
        this.reconnectAttempts = new Map(); // callId -> number
        this.connectionTimeouts = new Map(); // callId -> connection timeout
        this._healthCheckInterval = null; // Store interval ID

        this.notifyCallback = null;
        logger.info('[OpenAI Realtime] Service initialized');
    }

    /**
     * Calculate backoff delay for reconnection attempts
     * @param {number} attempt - Current attempt number
     * @returns {number} - Delay in milliseconds
     */
    calculateBackoffDelay(attempt) {
        const expBackoff = Math.min(
            CONSTANTS.RECONNECT_BASE_DELAY * Math.pow(2, attempt),
            30000 // Max 30 second delay
        );
        const jitter = expBackoff * 0.2 * (Math.random() * 2 - 1);
        return Math.floor(expBackoff + jitter);
    }

    /**
     * Set the callback function for notifying other services about events
     * Callback expects: (asteriskChannelId, eventType, data)
     */
    setNotificationCallback(callback) {
        this.notifyCallback = callback;
        logger.info('[OpenAI Realtime] Notification callback registered');
    }

    /**
     * Notify subscribed services about events.
     * Looks up the Asterisk ID associated with the primary callId before calling back.
     * @param {string} callId - The primary call identifier (e.g. Twilio SID)
     * @param {string} eventType - The type of event
     * @param {Object} data - Event data payload
     */
    notify(callId, eventType, data = {}) {
        if (!this.notifyCallback) {
            logger.debug(`[OpenAI Realtime] No notification callback set for ${eventType} (CallID: ${callId})`);
            return;
        }
        const conn = this.connections.get(callId);
        // We need the Asterisk Channel ID for the callback to ari.client.js
        const asteriskChannelId = conn?.asteriskChannelId; // Retrieve stored Asterisk ID

        if (!asteriskChannelId) {
            logger.warn(`[OpenAI Realtime] Cannot notify for ${callId}, missing associated Asterisk Channel ID.`);
            return;
        }

        try {
            // Call back with Asterisk Channel ID
            this.notifyCallback(asteriskChannelId, eventType, data);
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error in notification callback for CallID ${callId} (AsteriskID ${asteriskChannelId}) / Event ${eventType}: ${err.message}`);
        }
    }

    /**
     * Initialize a connection to OpenAI for a call. Uses callSid as the primary key.
     * @param {string} initialAsteriskChannelId - The initial Asterisk channel ID when the call enters Stasis
     * @param {string} callSid - The primary call identifier (e.g., Twilio CallSid)
     * @param {string|null} conversationId - Database ID for this conversation
     * @param {string} initialPrompt - System prompt for the AI
     * @returns {Promise<boolean>} - Success indicator
     */
    async initialize(initialAsteriskChannelId, callSid, conversationId, initialPrompt) {
        // Use Twilio SID as the primary key if available, fallback to Asterisk ID
        const callId = callSid || initialAsteriskChannelId;
        if (!callId) {
            logger.error("[OpenAI Realtime] Initialize: Critical - Missing call identifier (callSid or initialAsteriskChannelId).");
            return false;
        }

        if (this.connections.has(callId)) {
            const existingConn = this.connections.get(callId);
            logger.warn(`[OpenAI Realtime] Initialize: Connection already exists for callId: ${callId}. Current status: ${existingConn.status}`);
            // Avoid re-initializing if already connected/connecting
            return existingConn.status !== 'error' && existingConn.status !== 'closed';
        }

        logger.info(`[OpenAI Realtime] Initializing for callId: ${callId} (Initial Asterisk ID: ${initialAsteriskChannelId})`);

        // Use callId as the key, store both IDs and other relevant info
        this.connections.set(callId, {
            status: 'initializing',
            conversationId,
            callSid: callSid, // Explicitly store the Twilio SID
            asteriskChannelId: initialAsteriskChannelId, // Store the initial Asterisk ID
            webSocket: null,
            sessionReady: false,
            startTime: Date.now(),
            initialPrompt: initialPrompt,
            lastActivity: Date.now(),
            sessionId: null // Initialize OpenAI session ID
        });

        // Initialize state for this callId
        this.reconnectAttempts.set(callId, 0);
        this.isReconnecting.set(callId, false);
        this.pendingAudio.set(callId, []); // Initialize pending audio buffer

        try {
            await this.connect(callId); // Pass only callId
            return true;
        } catch (err) {
            logger.error(`[OpenAI Realtime] Initialization failed during connect for ${callId}: ${err.message}`);
            this.cleanup(callId); // Ensure cleanup if initial connect fails
            return false;
        }
    }

    /**
     * Attempt to reconnect. Uses callId as primary key.
     */
    async attemptReconnect(callId) {
        // Only needs callId, retrieves other info from stored connection state
        if (!this.isReconnecting.get(callId)) {
            logger.info(`[OpenAI Realtime] Skipping reconnect for ${callId} - not in reconnecting state.`);
            return;
        }

        const attempts = this.reconnectAttempts.get(callId) || 0;
        if (attempts >= CONSTANTS.RECONNECT_MAX_ATTEMPTS) {
            logger.error(`[OpenAI Realtime] Max reconnection attempts (${CONSTANTS.RECONNECT_MAX_ATTEMPTS}) reached for ${callId}`);
            this.isReconnecting.set(callId, false); // Stop trying
            this.notify(callId, 'openai_max_reconnect_failed', { attempts }); // Notify failure
            return;
        }

        logger.info(`[OpenAI Realtime] Attempting reconnect #${attempts + 1} for ${callId}`);
        this.reconnectAttempts.set(callId, attempts + 1);

        let conn = this.connections.get(callId);
        if (!conn) {
             logger.error(`[OpenAI Realtime] Cannot reconnect ${callId}: connection state missing.`);
             this.isReconnecting.delete(callId); // Clean up flags
             this.reconnectAttempts.delete(callId);
             return;
        }
        // Reset status before attempting connection
        conn.status = 'initializing';
        conn.webSocket = null;
        conn.sessionReady = false;
        this.updateConnectionStatus(callId, 'reconnecting');

        try {
            await this.connect(callId); // Pass callId, connect retrieves details
            this.isReconnecting.set(callId, false); // Reset on success
            logger.info(`[OpenAI Realtime] Reconnect #${attempts + 1} successful for ${callId}`);
            this.notify(callId, 'openai_reconnected', { attempts: attempts + 1 });
        } catch (err) {
            logger.error(`[OpenAI Realtime] Reconnect #${attempts + 1} failed for ${callId}: ${err.message}`);
            // Schedule the next attempt
            const delay = this.calculateBackoffDelay(attempts + 1);
            logger.info(`[OpenAI Realtime] Will retry connection for ${callId} in ${delay}ms`);
            setTimeout(() => { this.attemptReconnect(callId); }, delay);
        }
    }


    /**
     * Create and configure WebSocket connection. Uses callId as primary key.
     */
    async connect(callId) {
        const connectionState = this.connections.get(callId);
        if (!connectionState) {
            logger.error(`[OpenAI Realtime] Connect: Connection state missing for ${callId}!`);
            throw new Error(`Connection state missing for ${callId}`);
        }
        // Retrieve details from state
        const initialPrompt = connectionState.initialPrompt;
        const resumeSessionId = connectionState.sessionId; // TODO: Implement session resume logic if needed

        const model = config.openai.realtimeModel || 'gpt-4o-realtime-preview-2024-12-17';
        const voice = config.openai.realtimeVoice || 'alloy';
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;

        logger.info(`[OpenAI Realtime] Connecting to ${wsUrl} for callId: ${callId}`);

        if (connectionState.status === 'connected' || connectionState.status === 'connecting') {
            logger.warn(`[OpenAI Realtime] Connect called for ${callId} but already ${connectionState.status}.`);
            return;
        }
        connectionState.status = 'connecting';
        connectionState.lastActivity = Date.now();

        try {
            // Connection Timeout setup
            const connectionTimeoutId = setTimeout(() => {
                const currentConn = this.connections.get(callId);
                if (currentConn && currentConn.status === 'connecting' && currentConn.webSocket) {
                    logger.error(`[OpenAI Realtime] Connection timeout for ${callId}`);
                    currentConn.webSocket.terminate(); // Triggers 'close' event
                }
                this.connectionTimeouts.delete(callId); // Remove timeout ID
            }, CONSTANTS.CONNECTION_TIMEOUT);
            this.connectionTimeouts.set(callId, connectionTimeoutId);

            // Create WebSocket instance
            const ws = new WebSocket(wsUrl, {
                headers: { Authorization: `Bearer ${config.openai.apiKey}`, 'OpenAI-Beta': 'realtime=v1' },
            });
            connectionState.webSocket = ws; // Store WebSocket object in state

            // --- WebSocket Event Handlers (using callId) ---
            ws.on('open', () => {
                if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
                logger.info(`[OpenAI Realtime] WebSocket opened for callId: ${callId}`);
                this.updateConnectionStatus(callId, 'connected');
                // Session configuration is sent after 'session.created' message from OpenAI
            });

            ws.on('message', (data) => {
                this.handleOpenAIMessage(callId, data).catch(err => {
                    logger.error(`[OpenAI Realtime] Uncaught error in handleOpenAIMessage for ${callId}: ${err.message}`);
                });
            });

            ws.on('error', (error) => {
                logger.error(`[OpenAI Realtime] WebSocket error for ${callId}: ${error.message}`);
                this.notify(callId, 'openai_error', { message: error.message || 'WebSocket error' });
                if (this.connections.has(callId)) { this.updateConnectionStatus(callId, 'error'); }
                // 'close' event usually follows, let it handle potential reconnect
            });

            ws.on('close', (code, reason) => { // No async needed here
                if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
                const reasonStr = reason ? reason.toString() : 'No reason provided';
                logger.info(`[OpenAI Realtime] WebSocket closed for ${callId}. Code: ${code}, Reason: ${reasonStr}`);
                this.notify(callId, 'openai_closed', { code, reason: reasonStr });

                if (this.connections.has(callId)) { // Check if cleanup hasn't already removed it
                    this.updateConnectionStatus(callId, 'closed'); // Mark as closed first
                    // Attempt reconnect on abnormal closure if not already doing so
                    if (code !== 1000 && !this.isReconnecting.get(callId)) {
                        this.isReconnecting.set(callId, true);
                        this.cleanup(callId, false); // Clean up WS/timers but keep reconnect flags
                        const attempts = this.reconnectAttempts.get(callId) || 0; // Get attempt count *before* cleanup might delete it
                        const delay = this.calculateBackoffDelay(attempts);
                        logger.info(`[OpenAI Realtime] Will attempt reconnect for ${callId} in ${delay}ms (attempt #${attempts + 1})`);
                        setTimeout(() => { this.attemptReconnect(callId); }, delay); // Pass only callId
                    } else {
                        this.cleanup(callId); // Normal closure or already handling reconnect
                    }
                }
            });
            // --- End WebSocket Event Handlers ---
            logger.info(`[OpenAI Realtime] WebSocket client instance created for ${callId}`);

        } catch (err) {
            // Catch errors during WS instantiation or initial setup
            if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
            logger.error(`[OpenAI Realtime] Error initiating WebSocket connection for ${callId}: ${err.message}`);
            if (this.connections.has(callId)) {
                this.updateConnectionStatus(callId, 'error');
                this.cleanup(callId); // Full cleanup on connection error
            }
            throw err; // Re-throw for initialize/reconnect to catch
        }
    }

    /**
     * Update connection status safely. Uses callId.
     */
    updateConnectionStatus(callId, status) {
        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] UpdateStatus: Connection state for ${callId} missing.`);
            return;
        }
        const oldStatus = conn.status;
        if (oldStatus === status) return;
        conn.status = status;
        conn.lastActivity = Date.now();
        logger.info(`[OpenAI Realtime] Connection ${callId} status: ${oldStatus} -> ${status}`);
    }

    /**
     * Process messages received from the OpenAI WebSocket. Uses callId.
     */
    async handleOpenAIMessage(callId, data) {
        let message;
        try {
            message = JSON.parse(data);
        } catch (err) {
            logger.error(`[OpenAI Realtime] Failed to parse JSON for ${callId}: ${err.message}. Data: ${data.toString().substring(0, 100)}...`);
            return;
        }

        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] Message for unknown/cleaned connection ${callId}. Type: ${message.type}`);
            return;
        }
        conn.lastActivity = Date.now();

        try {
            switch (message.type) {
                case 'session.created':
                    logger.info(`[OpenAI Realtime] Session created for ${callId}, OpenAI Session ID: ${message.session.id}`);
                    conn.sessionId = message.session.id;
                    const sessionConfig = {
                        type: 'session.update',
                        session: {
                            instructions: conn.initialPrompt || "You are Bianca, a helpful AI assistant.",
                            voice: config.openai.realtimeVoice || 'alloy',
                            input_audio_format: 'g711_ulaw', // We send uLaw
                            output_audio_format: 'pcm16',   // We expect PCM back
                            ...(config.openai.realtimeSessionConfig || {})
                        },
                    };
                    logger.info(`[OpenAI Realtime] Sending session.update for ${callId}`);
                    if (logger.isLevelEnabled('debug')) { logger.debug(`[OpenAI Realtime] Session config for ${callId}: ${JSON.stringify(sessionConfig)}`); }
                    await this.sendJsonMessage(callId, sessionConfig);

                    logger.info(`[OpenAI Realtime] Sending initial user message for ${callId}`);
                    const initialUserMessage = { type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello, are you there?' }] } };
                    await this.sendJsonMessage(callId, initialUserMessage);

                    conn.sessionReady = true;
                    await this.flushPendingAudio(callId);
                    this.notify(callId, 'openai_session_ready', {});
                    break;

                case 'response.content_part.added':
                    if (message.content_part.content_type === 'audio') {
                         if (logger.isLevelEnabled('debug')) { logger.debug(`[OpenAI Realtime] Received audio content part for ${callId}, size: ${message.content_part.data?.length || 0}`); }
                         await this.processAudioResponse(callId, message.content_part.data);
                     } else if (message.content_part.content_type === 'text') {
                         if (logger.isLevelEnabled('debug')) { logger.debug(`[OpenAI Realtime] Received text content part for ${callId}: "${message.content_part.text?.substring(0, 50) || ''}"`); }
                     }
                     break;

                case 'conversation.item.created':
                     logger.debug(`[OpenAI Realtime] Received conversation.item.created for ${callId}`);
                     await this.handleConversationItem(callId, message.item, conn.conversationId);
                     break;

                 case 'response.done':
                     logger.info(`[OpenAI Realtime] Assistant response done event for ${callId}`);
                     this.notify(callId, 'response_done', {});
                     break;

                 case 'error':
                     logger.error(`[OpenAI Realtime] Error message from OpenAI API for ${callId}: ${message.error?.message || 'Unknown API Error'}`);
                     this.notify(callId, 'openai_error', { error: message.error });
                     // Optionally close connection on severe errors
                     // if (message.error?.code === 'some_fatal_code') { this.disconnect(callId); }
                     break;

                 case 'session.updated':
                      logger.info(`[OpenAI Realtime] Session updated event for ${callId}`);
                      if (logger.isLevelEnabled('debug')) { logger.debug(`[OpenAI Realtime] Session update details: ${JSON.stringify(message.session)}`); }
                      break;

                 case 'session.expired':
                      logger.warn(`[OpenAI Realtime] Session expired for ${callId}`);
                      this.notify(callId, 'openai_session_expired', {});
                      // Optionally trigger reconnect here?
                      break;

                default:
                     logger.debug(`[OpenAI Realtime] Unhandled message type ${message.type} for ${callId}`);
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error processing message type ${message?.type} for ${callId}: ${err.message}`, err);
            this.notify(callId, 'openai_message_processing_error', { messageType: message?.type, error: err.message });
        }
    }

    /**
     * Process audio response from OpenAI (PCM) -> Resample -> Convert to uLaw -> Notify ARI.
     */
    async processAudioResponse(callId, audioBase64PCM) {
        // logger.info(`[OpenAI Realtime] Received OpenAI audio for ${callId}, PCM length: ${audioBase64PCM?.length || 0}`);
        if (!audioBase64PCM) return;

        try {
            const inputBuffer = Buffer.from(audioBase64PCM, 'base64');
            if (inputBuffer.length === 0) return;

            // Resample PCM (e.g., 24k -> 8k)
            const openaiOutputRate = config.openai.outputExpectedSampleRate || CONSTANTS.OPENAI_PCM_OUTPUT_RATE; // e.g., 24000
            const asteriskPlaybackRate = CONSTANTS.DEFAULT_SAMPLE_RATE; // 8000 Hz
            const resampledBuffer = AudioUtils.resamplePcm(inputBuffer, openaiOutputRate, asteriskPlaybackRate);

            if (!resampledBuffer || resampledBuffer.length === 0) {
                 logger.warn(`[OpenAI Realtime] Resampling OpenAI output failed for ${callId}`);
                 return;
            }

            // Convert the 8kHz PCM buffer to uLaw base64 for Asterisk playback
            const ulawBase64ToNotify = await AudioUtils.convertPcmToUlaw(resampledBuffer); // Uses alawmulaw

            if (ulawBase64ToNotify && ulawBase64ToNotify.length > 0) {
                // logger.debug(`[OpenAI Realtime] Notifying ARI with uLaw audio chunk for ${callId}`);
                this.notify(callId, 'audio_chunk', { audio: ulawBase64ToNotify });
            } else {
                logger.warn(`[OpenAI Realtime] No uLaw data after transcoding OpenAI response for ${callId}`);
            }
        } catch (err) {
             logger.error(`[OpenAI Realtime] Error processing OpenAI audio response for ${callId}: ${err.message}`, err);
        }
    }

    /**
     * Handle conversation items. Uses callId internally.
     */
    async handleConversationItem(callId, item, dbConversationId) {
        if (!item) return;
        try {
            if (item.type === 'message') {
                const contentArray = item.content || [];
                const contentText = contentArray.map(part => (part?.type === 'text' ? part.text : '')).join('');

                if (contentText) {
                    logger.info(`[OpenAI Realtime] ${item.role} message text for ${callId} (status: ${item.status || 'N/A'}): "${contentText.substring(0, 70)}..."`);
                    if (dbConversationId && item.status === 'completed') {
                        try {
                            await Message.create({ role: item.role, content: contentText, conversationId: dbConversationId });
                            logger.debug(`[OpenAI Realtime] Saved completed message for ${callId}/${dbConversationId}`);
                        } catch (dbErr) {
                             logger.error(`[OpenAI Realtime] Failed to save message for ${callId}/${dbConversationId}: ${dbErr.message}`);
                        }
                    }
                    if (item.status === 'completed') {
                        this.notify(callId, 'text_message', { role: item.role, content: contentText });
                    }
                }

                // Audio can also be part of the 'message' item itself
                if (item.audio?.data && item.audio.data.length > 0) {
                    // logger.info(`[OpenAI Realtime] Audio found in conversation.item.created for ${callId}`);
                    await this.processAudioResponse(callId, item.audio.data);
                } else if (!contentText && item.role === 'assistant' && item.status === 'completed') {
                    logger.debug(`[OpenAI Realtime] Completed assistant item with no text/audio for ${callId}.`);
                }
            } else if (item.type === 'function_call') {
                logger.info(`[OpenAI Realtime] Function call for ${callId}: ${item.function_call?.name || 'N/A'}`);
                this.notify(callId, 'function_call', { call: item.function_call });
                // Implement function call execution logic here
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error in handleConversationItem for ${callId}: ${err.message}`);
        }
    }

    /**
     * Send JSON message. Uses callId.
     */
    async sendJsonMessage(callId, messageObj) {
        const conn = this.connections.get(callId);
        if (!conn?.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
             logger.warn(`[OpenAI Realtime] Cannot send JSON - WS not open for ${callId}.`);
             return false;
        }
        try {
             const messageStr = JSON.stringify(messageObj);
             // logger.debug(`[OpenAI Realtime] Sending JSON type ${messageObj.type} for ${callId}`);
             conn.webSocket.send(messageStr);
             conn.lastActivity = Date.now();
             return true;
        } catch (err) { logger.error(`[OpenAI Realtime] Error sending JSON for ${callId}: ${err.message}`); return false; }
    }

     /**
      * Flush pending audio. Uses callId. Sends data through sendAudioChunk.
      */
    async flushPendingAudio(callId) {
        const conn = this.connections.get(callId);
        // Double check session is ready before flushing
        if (!conn || !conn.sessionReady) {
            logger.debug(`[OpenAI Realtime] Not flushing for ${callId}, session not ready or no connection.`);
            return;
        }
        const chunks = this.pendingAudio.get(callId);
        if (!chunks || chunks.length === 0) {
            logger.debug(`[OpenAI Realtime] No pending audio to flush for ${callId}`);
            return;
        }
        logger.info(`[OpenAI Realtime] Flushing ${chunks.length} pending audio chunks for ${callId}`);
        const chunksToFlush = [...chunks];
        this.pendingAudio.set(callId, []); // Clear buffer

        const BATCH_SIZE = 5;
        for (let i = 0; i < chunksToFlush.length; i += BATCH_SIZE) {
            const batch = chunksToFlush.slice(i, i + BATCH_SIZE);
            // Pass the callId (Twilio SID) to sendAudioChunk
            const sendPromises = batch.map(chunkPCMBase64 => this.sendAudioChunk(callId, chunkPCMBase64)); // Pass PCM
            try {
                await Promise.all(sendPromises);
            } catch (err) {
                 logger.error(`[OpenAI Realtime] Error during batch audio flush for ${callId}: ${err.message}`);
            }
            if (i + BATCH_SIZE < chunksToFlush.length) { await new Promise(resolve => setTimeout(resolve, 50)); }
        }
        logger.info(`[OpenAI Realtime] Finished flushing pending audio for ${callId}`);
    }

     /**
      * Debounce commit. Uses callId.
      */
    debounceCommit(callId) {
         if (this.commitTimers.has(callId)) { clearTimeout(this.commitTimers.get(callId)); }
         const conn = this.connections.get(callId);
         if (!conn?.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) return;

         const timer = setTimeout(async () => {
             this.commitTimers.delete(callId);
             const currentConn = this.connections.get(callId);
             if (currentConn?.webSocket?.readyState === WebSocket.OPEN && currentConn.sessionReady) {
                 logger.debug(`[OpenAI Realtime] Sending debounced commit for ${callId}`);
                 await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
             } else { logger.warn(`[OpenAI Realtime] Skipped debounced commit, WS/session not ready for ${callId}`); }
         }, CONSTANTS.COMMIT_DEBOUNCE_DELAY);
         this.commitTimers.set(callId, timer);
    }

    /**
     * Send audio chunk. Converts PCM->uLaw. Expects callId (Twilio SID).
     * @param {string} callId - Primary call identifier (e.g. Twilio SID)
     * @param {string} audioChunkBase64PCM - Base64 encoded PCM audio chunk from Asterisk TCP Server (8kHz SLIN)
     */
    async sendAudioChunk(callId, audioChunkBase64PCM) {
        if (!audioChunkBase64PCM) { return; }

        const conn = this.connections.get(callId);
        // This function should primarily be called by flushPendingAudio or directly ONLY when session is ready.
        // Adding check here for safety.
        if (!conn || !conn.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
            logger.warn(`[OpenAI Realtime] sendAudioChunk: WS/Session not ready for ${callId}. Buffering attempt.`);
            if (conn && conn.status !== 'closed' && conn.status !== 'error') { // Avoid buffering if connection permanently failed
                 if (!this.pendingAudio.has(callId)) { this.pendingAudio.set(callId, []); }
                 this.pendingAudio.get(callId).push(audioChunkBase64PCM); // Buffer original PCM
            }
            return;
        }

        try {
             const inputBuffer = Buffer.from(audioChunkBase64PCM, 'base64');
             if (inputBuffer.length === 0) {
                 logger.warn(`[OpenAI Realtime] sendAudioChunk: Decoded PCM buffer is empty for ${callId}`);
                 return;
             }

             // Convert 8kHz PCM -> 8kHz uLaw using AudioUtils (which uses alawmulaw)
             const ulawBase64ToSend = await AudioUtils.convertPcmToUlaw(inputBuffer); // Assumes 8kHz input

             if (ulawBase64ToSend && ulawBase64ToSend.length > 0) {
                // logger.debug(`[OpenAI Realtime] Sending uLaw chunk to OpenAI for ${callId}, uLaw size: ${ulawBase64ToSend.length}`);
                conn.lastActivity = Date.now();
                const success = await this.sendJsonMessage(callId, {
                    type: 'input_audio_buffer.append',
                    audio: ulawBase64ToSend // Send the uLaw
                });
                if (success) {
                    this.debounceCommit(callId); // Trigger commit timer after successful send
                }
            } else { logger.warn(`[OpenAI Realtime] uLaw conversion yielded empty data for ${callId}.`); }
        } catch (err) {
             logger.error(`[OpenAI Realtime] Error sending audio chunk for ${callId}: ${err.message}`, err);
        }
    }

    /**
     * Send a text message to OpenAI. Uses callId.
     */
    async sendTextMessage(callId, text, role = 'user', metadata = {}) {
        if (!text || typeof text !== 'string') {
            logger.warn(`[OpenAI Realtime] Skipping empty text message for ${callId}`);
            return;
        }
        logger.info(`[OpenAI Realtime] Sending ${role} text message for ${callId}: "${text.substring(0, 50)}..."`);
        try {
            let item;
            if (role === 'function_call_response') {
                if (!metadata.functionCallId) { logger.error(`[OpenAI Realtime] Missing functionCallId for role ${role} on ${callId}`); return; }
                item = { type: 'function_call_response', function_call_id: metadata.functionCallId, content: text };
            } else { // Default to user role
                item = { type: 'message', role: 'user', content: [{ type: 'input_text', text }] };
            }
            await this.sendJsonMessage(callId, { type: 'conversation.item.create', item });
        } catch (err) { logger.error(`[OpenAI Realtime] Error sending text for ${callId}: ${err.message}`); }
    }

    /**
     * Start periodic health check.
     */
    startHealthCheck(interval = 60000) {
        logger.info(`[OpenAI Realtime] Starting health check (interval: ${interval}ms)`);
        if (this._healthCheckInterval) clearInterval(this._healthCheckInterval);

        this._healthCheckInterval = setInterval(() => {
            const now = Date.now();
            const idleTimeout = config.openai.idleTimeout || 300000; // 5 minutes default

            for (const [callId, conn] of this.connections.entries()) {
                if (conn.lastActivity && (now - conn.lastActivity > idleTimeout)) {
                    logger.warn(`[OpenAI Realtime] Connection ${callId} idle timeout (${idleTimeout}ms). Cleaning up.`);
                    this.disconnect(callId); // Use callId
                }
            }
        }, interval);
    }

    /**
     * Stop health check.
     */
    stopHealthCheck() {
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = null;
            logger.info(`[OpenAI Realtime] Stopped health check`);
        }
    }

    /**
     * Disconnect. Uses callId (Twilio SID).
     */
    async disconnect(callId) {
        const conn = this.connections.get(callId);
        if (!conn) {
            // logger.warn(`[OpenAI Realtime] Disconnect called for non-existent callId: ${callId}`);
            return; // Already cleaned up or never existed
        }
        logger.info(`[OpenAI Realtime] Disconnecting callId: ${callId} (Status: ${conn.status})`);

        // Clear timers associated with this specific call FIRST
        if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
        if (this.commitTimers.has(callId)) { clearTimeout(this.commitTimers.get(callId)); this.commitTimers.delete(callId); }

        // Handle WebSocket closure
        if (conn.webSocket) {
            const ws = conn.webSocket;
            try {
                // Remove listeners immediately to prevent events during/after close/terminate
                ws.removeAllListeners();
                if (ws.readyState === WebSocket.OPEN) {
                    logger.info(`[OpenAI Realtime] Sending close frame to WebSocket for ${callId}`);
                    ws.close(1000, "Client initiated disconnect");
                } else if (ws.readyState === WebSocket.CONNECTING) {
                    logger.warn(`[OpenAI Realtime] WebSocket for ${callId} still CONNECTING during disconnect. Terminating.`);
                    ws.terminate(); // Terminate if still connecting
                } else {
                     logger.info(`[OpenAI Realtime] WebSocket for ${callId} already closing or closed (state: ${ws.readyState}).`);
                }
            } catch (err) { logger.error(`[OpenAI Realtime] Error closing/terminating WS for ${callId}: ${err.message}`); }
            conn.webSocket = null; // Clear reference
        }
        // Perform final cleanup of maps and flags
        this.cleanup(callId);
    }

    /**
     * Cleanup internal state maps. Uses callId (Twilio SID).
     */
    cleanup(callId, clearReconnectFlags = true) {
         // Ensure timers are cleared (might be redundant if disconnect called first, but safe)
         if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
         if (this.commitTimers.has(callId)) { clearTimeout(this.commitTimers.get(callId)); this.commitTimers.delete(callId); }
         // Clear audio buffer
         if (this.pendingAudio.has(callId)) { this.pendingAudio.delete(callId); logger.debug(`[OpenAI Realtime] Cleared pending audio for ${callId}`); }

         // Remove main connection state object
         const deleted = this.connections.delete(callId);
         if (deleted) { logger.info(`[OpenAI Realtime] Cleaned up connection state for callId: ${callId}.`); }

         // Clear reconnect flags if this is a final cleanup
         if (clearReconnectFlags) {
             this.isReconnecting.delete(callId);
             this.reconnectAttempts.delete(callId);
             logger.debug(`[OpenAI Realtime] Cleared reconnection flags for ${callId}`);
         }
    }

    /**
     * Disconnect all connections.
     */
    async disconnectAll() {
        logger.info(`[OpenAI Realtime] Disconnecting all connections (count: ${this.connections.size})`);
        const activeConnections = [...this.connections.keys()];
        // Use Promise.allSettled to ensure all disconnects are attempted
        await Promise.allSettled(activeConnections.map(callId => this.disconnect(callId)));
        this.stopHealthCheck();
        logger.info(`[OpenAI Realtime] All connections disconnected and health check stopped.`);
    }
} // End OpenAIRealtimeService Class

// Create and export a singleton instance
const openAIRealtimeService = new OpenAIRealtimeService();
// Start health check when the service is initialized
openAIRealtimeService.startHealthCheck();
module.exports = openAIRealtimeService;