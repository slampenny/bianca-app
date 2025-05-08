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
    COMMIT_DEBOUNCE_DELAY: 1000, // Using 1 second delay
    CONNECTION_TIMEOUT: 10000, // WebSocket connection timeout (milliseconds)
    DEFAULT_SAMPLE_RATE: 8000, // Rate of audio FOR Asterisk (uLaw)
    OPENAI_PCM_OUTPUT_RATE: 24000, // Expected rate FROM OpenAI for pcm16 output
};

/**
 * Manages connections to OpenAI's realtime API
 */
class OpenAIRealtimeService {
    constructor() {
        // Key is now the primary call identifier (e.g., Twilio CallSid)
        this.connections = new Map(); // callId -> connection state object
        // This buffer now stores uLaw chunks received from RTP listener
        this.pendingAudio = new Map(); // callId -> array of base64 uLaw audio chunks
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
     */
    calculateBackoffDelay(attempt) {
        const expBackoff = Math.min(CONSTANTS.RECONNECT_BASE_DELAY * Math.pow(2, attempt), 30000);
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
     */
    notify(callId, eventType, data = {}) {
        if (!this.notifyCallback) {
            logger.debug(`[OpenAI Realtime] No notify callback for ${eventType} (CallID: ${callId})`);
            return;
        }
        const conn = this.connections.get(callId);
        const asteriskChannelId = conn?.asteriskChannelId;

        if (!asteriskChannelId) {
            logger.warn(`[OpenAI Realtime] Cannot notify for ${callId}, missing associated Asterisk Channel ID.`);
            return;
        }
        try {
            this.notifyCallback(asteriskChannelId, eventType, data);
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error in notification callback for CallID ${callId} (AsteriskID ${asteriskChannelId}) / Event ${eventType}: ${err.message}`);
        }
    }

    /**
     * Initialize a connection to OpenAI for a call. Uses callSid as the primary key.
     */
    async initialize(initialAsteriskChannelId, callSid, conversationId, initialPrompt) {
        const callId = callSid || initialAsteriskChannelId;
        if (!callId) {
            logger.error("[OpenAI Realtime] Initialize: Critical - Missing call identifier.");
            return false;
        }
        if (this.connections.has(callId)) {
            const existingConn = this.connections.get(callId);
            logger.warn(`[OpenAI Realtime] Initialize: Connection already exists for callId: ${callId}. Status: ${existingConn.status}`);
            return existingConn.status !== 'error' && existingConn.status !== 'closed';
        }

        logger.info(`[OpenAI Realtime] Initializing for callId: ${callId} (Initial Asterisk ID: ${initialAsteriskChannelId})`);
        this.connections.set(callId, {
            status: 'initializing', conversationId, callSid, asteriskChannelId: initialAsteriskChannelId,
            webSocket: null, sessionReady: false, startTime: Date.now(), initialPrompt, lastActivity: Date.now(), sessionId: null
        });
        this.reconnectAttempts.set(callId, 0);
        this.isReconnecting.set(callId, false);
        this.pendingAudio.set(callId, []); // Initialize buffer

        try {
            await this.connect(callId);
            return true;
        } catch (err) {
            logger.error(`[OpenAI Realtime] Initialization failed for ${callId}: ${err.message}`);
            this.cleanup(callId);
            return false;
        }
    }

    /**
     * Attempt to reconnect. Uses callId as primary key.
     */
    async attemptReconnect(callId) {
        if (!this.isReconnecting.get(callId)) return;
        const attempts = this.reconnectAttempts.get(callId) || 0;
        if (attempts >= CONSTANTS.RECONNECT_MAX_ATTEMPTS) {
            logger.error(`[OpenAI Realtime] Max reconnect attempts reached for ${callId}`);
            this.isReconnecting.set(callId, false);
            this.notify(callId, 'openai_max_reconnect_failed', { attempts });
            return;
        }
        logger.info(`[OpenAI Realtime] Attempting reconnect #${attempts + 1} for ${callId}`);
        this.reconnectAttempts.set(callId, attempts + 1);
        let conn = this.connections.get(callId);
        if (!conn) {
             logger.error(`[OpenAI Realtime] Cannot reconnect ${callId}: state missing.`);
             this.isReconnecting.delete(callId); this.reconnectAttempts.delete(callId); return;
        }
        conn.status = 'initializing'; conn.webSocket = null; conn.sessionReady = false;
        this.updateConnectionStatus(callId, 'reconnecting');
        try {
            await this.connect(callId);
            this.isReconnecting.set(callId, false);
            logger.info(`[OpenAI Realtime] Reconnect #${attempts + 1} successful for ${callId}`);
            this.notify(callId, 'openai_reconnected', { attempts: attempts + 1 });
        } catch (err) {
            logger.error(`[OpenAI Realtime] Reconnect #${attempts + 1} failed for ${callId}: ${err.message}`);
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
        if (!connectionState) throw new Error(`Connect: Connection state missing for ${callId}`);
        const model = config.openai.realtimeModel || 'gpt-4o-realtime-preview-2024-12-17';
        const voice = config.openai.realtimeVoice || 'alloy';
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;
        logger.info(`[OpenAI Realtime] Connecting to ${wsUrl} for callId: ${callId}`);
        if (connectionState.status === 'connected' || connectionState.status === 'connecting') return;
        connectionState.status = 'connecting'; connectionState.lastActivity = Date.now();

        try {
            const connectionTimeoutId = setTimeout(() => {
                const currentConn = this.connections.get(callId);
                if (currentConn && currentConn.status === 'connecting' && currentConn.webSocket) {
                    logger.error(`[OpenAI Realtime] Connection timeout for ${callId}`);
                    currentConn.webSocket.terminate();
                }
                this.connectionTimeouts.delete(callId);
            }, CONSTANTS.CONNECTION_TIMEOUT);
            this.connectionTimeouts.set(callId, connectionTimeoutId);
            const ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${config.openai.apiKey}`, 'OpenAI-Beta': 'realtime=v1' } });
            connectionState.webSocket = ws;

            ws.on('open', () => {
                if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
                logger.info(`[OpenAI Realtime] WebSocket opened for callId: ${callId}`);
                this.updateConnectionStatus(callId, 'connected');
            });
            ws.on('message', (data) => { this.handleOpenAIMessage(callId, data).catch(err => logger.error(`Error in handleOpenAIMessage for ${callId}: ${err.message}`)) });
            ws.on('error', (error) => {
                 logger.error(`[OpenAI Realtime] WebSocket error for ${callId}: ${error.message}`);
                 this.notify(callId, 'openai_error', { message: error.message || 'WebSocket error' });
                 if (this.connections.has(callId)) this.updateConnectionStatus(callId, 'error');
            });
            ws.on('close', (code, reason) => {
                if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
                const reasonStr = reason ? reason.toString() : 'No reason provided';
                logger.info(`[OpenAI Realtime] WebSocket closed for ${callId}. Code: ${code}, Reason: ${reasonStr}`);
                this.notify(callId, 'openai_closed', { code, reason: reasonStr });
                if (this.connections.has(callId)) {
                    this.updateConnectionStatus(callId, 'closed');
                    if (code !== 1000 && !this.isReconnecting.get(callId)) {
                        this.isReconnecting.set(callId, true);
                        this.cleanup(callId, false);
                        const attempts = this.reconnectAttempts.get(callId) || 0;
                        const delay = this.calculateBackoffDelay(attempts);
                        logger.info(`[OpenAI Realtime] Will attempt reconnect for ${callId} in ${delay}ms (attempt #${attempts + 1})`);
                        setTimeout(() => { this.attemptReconnect(callId); }, delay);
                    } else {
                        this.cleanup(callId);
                    }
                }
            });
            logger.info(`[OpenAI Realtime] WebSocket client instance created for ${callId}`);
        } catch (err) {
            if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
            logger.error(`[OpenAI Realtime] Error initiating WebSocket connection for ${callId}: ${err.message}`);
            if (this.connections.has(callId)) {
                this.updateConnectionStatus(callId, 'error');
                this.cleanup(callId);
            }
            throw err;
        }
    }

    /**
     * Update connection status safely. Uses callId.
     */
    updateConnectionStatus(callId, status) {
        const conn = this.connections.get(callId);
        if (!conn) { logger.warn(`[OpenAI Realtime] UpdateStatus: Connection state for ${callId} missing.`); return; }
        const oldStatus = conn.status;
        if (oldStatus === status) return;
        conn.status = status; conn.lastActivity = Date.now();
        logger.info(`[OpenAI Realtime] Connection ${callId} status: ${oldStatus} -> ${status}`);
    }

    /**
     * Process messages received from the OpenAI WebSocket. Uses callId.
     */
    async handleOpenAIMessage(callId, data) {
        let message;
        try { message = JSON.parse(data); } catch (err) { logger.error(`[OpenAI Realtime] Failed JSON parse for ${callId}: ${err.message}`); return; }
        const conn = this.connections.get(callId);
        if (!conn) return;
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
                            output_audio_format: 'pcm16',   // Expect PCM back
                            ...(config.openai.realtimeSessionConfig || {})
                        },
                    };
                    logger.info(`[OpenAI Realtime] Sending session.update for ${callId}`);
                    await this.sendJsonMessage(callId, sessionConfig);
                    logger.info(`[OpenAI Realtime] Sending initial user message for ${callId}`);
                    const initialUserMessage = { type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello, are you there?' }] } };
                    await this.sendJsonMessage(callId, initialUserMessage);
                    conn.sessionReady = true;
                    await this.flushPendingAudio(callId); // Send buffered uLaw now
                    this.notify(callId, 'openai_session_ready', {});
                    break;

                case 'response.content_part.added':
                    if (message.content_part.content_type === 'audio') {
                         if (logger.isLevelEnabled('debug')) { logger.debug(`[OpenAI Realtime] Received audio content part for ${callId}, size: ${message.content_part.data?.length || 0}`); }
                         await this.processAudioResponse(callId, message.content_part.data); // Expects PCM
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
                     logger.error(`[OpenAI Realtime] Error from OpenAI API for ${callId}: ${message.error?.message || 'Unknown API Error'}`);
                     this.notify(callId, 'openai_error', { error: message.error });
                     break;

                 case 'session.updated':
                      logger.info(`[OpenAI Realtime] Session updated event for ${callId}`);
                      if (logger.isLevelEnabled('debug')) { logger.debug(`[OpenAI Realtime] Session update details: ${JSON.stringify(message.session)}`); }
                      break;

                 case 'session.expired':
                      logger.warn(`[OpenAI Realtime] Session expired for ${callId}`);
                      this.notify(callId, 'openai_session_expired', {});
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
        if (!audioBase64PCM) return;
        try {
            const inputBuffer = Buffer.from(audioBase64PCM, 'base64');
            if (inputBuffer.length === 0) return;
            const openaiOutputRate = config.openai.outputExpectedSampleRate || CONSTANTS.OPENAI_PCM_OUTPUT_RATE;
            const asteriskPlaybackRate = CONSTANTS.DEFAULT_SAMPLE_RATE;
            const resampledBuffer = AudioUtils.resamplePcm(inputBuffer, openaiOutputRate, asteriskPlaybackRate);
            if (!resampledBuffer || resampledBuffer.length === 0) { logger.warn(`Resampling failed for ${callId}`); return; }
            const ulawBase64ToNotify = await AudioUtils.convertPcmToUlaw(resampledBuffer);
            if (ulawBase64ToNotify) {
                this.notify(callId, 'audio_chunk', { audio: ulawBase64ToNotify });
            } else { logger.warn(`uLaw conversion failed for ${callId}`); }
        } catch (err) { logger.error(`Error processing OpenAI audio for ${callId}: ${err.message}`, err); }
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
                            logger.debug(`[OpenAI Realtime] Saved message for ${callId}/${dbConversationId}`);
                        } catch (dbErr) {
                             logger.error(`[OpenAI Realtime] Failed to save message for ${callId}/${dbConversationId}: ${dbErr.message}`);
                        }
                    }
                    if (item.status === 'completed') {
                        this.notify(callId, 'text_message', { role: item.role, content: contentText });
                    }
                }
                if (item.audio?.data) {
                    await this.processAudioResponse(callId, item.audio.data);
                } else if (!contentText && item.role === 'assistant' && item.status === 'completed') {
                    logger.debug(`[OpenAI Realtime] Completed assistant item with no text/audio for ${callId}.`);
                }
            // *** ADDED Function Call Handling Logic ***
            } else if (item.type === 'function_call') {
                logger.info(`[OpenAI Realtime] Function call received for ${callId}: ${item.function_call?.name || 'N/A'}`);
                // Notify the ARI client or another handler about the function call
                this.notify(callId, 'function_call', { call: item.function_call });
                // NOTE: You need separate logic (likely in ari.client.js or another service)
                // to handle this notification, execute the function, and then call
                // openAIService.sendTextMessage(callId, resultJsonString, 'function_call_response', { functionCallId: item.function_call.id });
            } else {
                 logger.debug(`[OpenAI Realtime] Unhandled conversation item type: ${item.type} for ${callId}`);
            }
        // *** ADDED Catch Block Logic ***
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error in handleConversationItem for ${callId}: ${err.message}`, err);
            // Optionally notify about the error
            this.notify(callId, 'openai_item_processing_error', { itemType: item?.type, error: err.message });
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
        if (!conn || !conn.sessionReady) return;
        const chunks = this.pendingAudio.get(callId); // These are uLaw base64 chunks now
        if (!chunks || chunks.length === 0) return;
        logger.info(`[OpenAI Realtime] Flushing ${chunks.length} pending uLaw audio chunks for ${callId}`);
        const chunksToFlush = [...chunks];
        this.pendingAudio.set(callId, []); // Clear buffer

        const BATCH_SIZE = 5;
        for (let i = 0; i < chunksToFlush.length; i += BATCH_SIZE) {
            const batch = chunksToFlush.slice(i, i + BATCH_SIZE);
            const sendPromises = batch.map(chunkULawBase64 => this.sendAudioChunk(callId, chunkULawBase64));
            try { await Promise.all(sendPromises); } catch (err) { /* log */ }
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
     * Send audio chunk. Expects uLaw base64 (from RTP listener). Sends directly to OpenAI.
     */
    async sendAudioChunk(callId, audioChunkBase64ULaw) {
        if (!audioChunkBase64ULaw) { return; }
        const conn = this.connections.get(callId);
        if (!conn || !conn.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
            logger.warn(`[OpenAI Realtime] sendAudioChunk: WS/Session not ready for ${callId}. Buffering.`);
            if (conn && conn.status !== 'closed' && conn.status !== 'error') {
                 if (!this.pendingAudio.has(callId)) { this.pendingAudio.set(callId, []); }
                 this.pendingAudio.get(callId).push(audioChunkBase64ULaw); // Buffer uLaw
            }
            return;
        }
        try {
             const ulawBase64ToSend = audioChunkBase64ULaw;
             if (ulawBase64ToSend && ulawBase64ToSend.length > 0) {
                conn.lastActivity = Date.now();
                const success = await this.sendJsonMessage(callId, {
                    type: 'input_audio_buffer.append',
                    audio: ulawBase64ToSend // Send the uLaw
                });
                if (success) { this.debounceCommit(callId); }
            } else { logger.warn(`[OpenAI Realtime] Received empty uLaw chunk for ${callId}.`); }
        } catch (err) { logger.error(`[OpenAI Realtime] Error sending uLaw audio chunk for ${callId}: ${err.message}`, err); }
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
        if (!conn) { return; }
        logger.info(`[OpenAI Realtime] Disconnecting callId: ${callId} (Status: ${conn.status})`);
        if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
        if (this.commitTimers.has(callId)) { clearTimeout(this.commitTimers.get(callId)); this.commitTimers.delete(callId); }
        if (conn.webSocket) {
            const ws = conn.webSocket;
            try {
                ws.removeAllListeners();
                if (ws.readyState === WebSocket.OPEN) { ws.close(1000, "Client initiated disconnect"); }
                else if (ws.readyState === WebSocket.CONNECTING) { ws.terminate(); }
            } catch (err) { logger.error(`[OpenAI Realtime] Error closing/terminating WS for ${callId}: ${err.message}`); }
        }
        this.cleanup(callId);
    }

    /**
     * Cleanup internal state maps. Uses callId (Twilio SID).
     */
    cleanup(callId, clearReconnectFlags = true) {
         if (this.connectionTimeouts.has(callId)) { clearTimeout(this.connectionTimeouts.get(callId)); this.connectionTimeouts.delete(callId); }
         if (this.commitTimers.has(callId)) { clearTimeout(this.commitTimers.get(callId)); this.commitTimers.delete(callId); }
         if (this.pendingAudio.has(callId)) { this.pendingAudio.delete(callId); }
         const deleted = this.connections.delete(callId);
         if (deleted) { logger.info(`[OpenAI Realtime] Cleaned up connection state for callId: ${callId}.`); }
         if (clearReconnectFlags) {
             this.isReconnecting.delete(callId);
             this.reconnectAttempts.delete(callId);
         }
    }

    /**
     * Disconnect all connections.
     */
    async disconnectAll() {
        logger.info(`[OpenAI Realtime] Disconnecting all connections (count: ${this.connections.size})`);
        const activeConnections = [...this.connections.keys()];
        await Promise.allSettled(activeConnections.map(callId => this.disconnect(callId)));
        this.stopHealthCheck();
        logger.info(`[OpenAI Realtime] All connections disconnected and health check stopped.`);
    }
} // End OpenAIRealtimeService Class

const openAIRealtimeService = new OpenAIRealtimeService();
openAIRealtimeService.startHealthCheck();
module.exports = openAIRealtimeService;
