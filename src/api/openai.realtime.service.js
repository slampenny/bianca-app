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
    COMMIT_DEBOUNCE_DELAY: 200, // Using 200ms second delay
    CONNECTION_TIMEOUT: 15000, // WebSocket connection + handshake timeout (milliseconds)
    DEFAULT_SAMPLE_RATE: 8000, // Rate of audio FOR Asterisk (uLaw)
    OPENAI_PCM_OUTPUT_RATE: 24000, // Expected rate FROM OpenAI for pcm16 output
    TEST_CONNECTION_TIMEOUT: 20000, // Timeout for the standalone test connection method (milliseconds)
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
        const jitter = expBackoff * 0.2 * (Math.random() * 2 - 1); // +/- 20% jitter
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
        const callId = callSid || initialAsteriskChannelId; // Prefer callSid if available
        if (!callId) {
            logger.error("[OpenAI Realtime] Initialize: Critical - Missing call identifier.");
            return false;
        }
        if (this.connections.has(callId)) {
            const existingConn = this.connections.get(callId);
            logger.warn(`[OpenAI Realtime] Initialize: Connection already exists for callId: ${callId}. Status: ${existingConn.status}`);
            // Allow re-initialization if in a recoverable state, or just return true if already good
            return existingConn.status !== 'error' && existingConn.status !== 'closed';
        }

        logger.info(`[OpenAI Realtime] Initializing for callId: ${callId} (Initial Asterisk ID: ${initialAsteriskChannelId})`);
        logger.info(`[OpenAI Realtime] Initial prompt: "${initialPrompt?.substring(0, 100)}..."`);
        
        this.connections.set(callId, {
            status: 'initializing',
            conversationId,
            callSid, // Store the Twilio CallSid if provided
            asteriskChannelId: initialAsteriskChannelId, // Store the Asterisk channel ID
            webSocket: null,
            sessionReady: false,
            startTime: Date.now(),
            initialPrompt,
            lastActivity: Date.now(),
            sessionId: null,
            audioChunksReceived: 0 // Track how many chunks we receive
        });
        this.reconnectAttempts.set(callId, 0);
        this.isReconnecting.set(callId, false);
        this.pendingAudio.set(callId, []); // Initialize buffer

        try {
            await this.connect(callId);
            return true;
        } catch (err) {
            logger.error(`[OpenAI Realtime] Initialization failed for ${callId}: ${err.message}`);
            this.cleanup(callId); // Full cleanup on init failure
            return false;
        }
    }

    /**
     * Clear connection timeout
     */
    clearConnectionTimeout(callId) {
        if (this.connectionTimeouts.has(callId)) {
            clearTimeout(this.connectionTimeouts.get(callId));
            this.connectionTimeouts.delete(callId);
        }
    }

    /**
     * Set connection timeout with unified handling
     */
    setConnectionTimeout(callId, duration = CONSTANTS.CONNECTION_TIMEOUT) {
        this.clearConnectionTimeout(callId);
        
        const timeoutId = setTimeout(() => {
            const conn = this.connections.get(callId);
            if (conn && !conn.sessionReady) {
                logger.error(`[OpenAI Realtime] Connection timeout for ${callId} after ${duration}ms`);
                this.handleConnectionTimeout(callId);
            }
        }, duration);
        
        this.connectionTimeouts.set(callId, timeoutId);
    }

    /**
     * Handle connection timeout
     */
    handleConnectionTimeout(callId) {
        const conn = this.connections.get(callId);
        if (conn?.webSocket) {
            conn.webSocket.terminate();
        }
        this.updateConnectionStatus(callId, 'timeout');
        this.notify(callId, 'openai_timeout', {});
        
        // Trigger reconnection if appropriate
        if (!this.isReconnecting.get(callId)) {
            this.isReconnecting.set(callId, true);
            const delay = this.calculateBackoffDelay(0);
            setTimeout(() => this.attemptReconnect(callId), delay);
        }
    }

    /**
     * Attach all WebSocket event handlers immediately after creation
     */
    attachWebSocketHandlers(ws, callId) {
        ws.on('open', () => this.handleOpen(callId));
        ws.on('message', (data) => this.handleMessage(callId, data));
        ws.on('error', (error) => this.handleError(callId, error));
        ws.on('close', (code, reason) => this.handleClose(callId, code, reason));
    }

    /**
     * Handle WebSocket open event
     */
    async handleOpen(callId) {
        logger.info(`[OpenAI Realtime] WebSocket opened for callId: ${callId}`);
        this.updateConnectionStatus(callId, 'connected');
        this.reconnectAttempts.set(callId, 0);
        // OpenAI will send session.created automatically
    }

    /**
     * Handle WebSocket message event
     */
    async handleMessage(callId, data) {
        if (!this.connections.has(callId)) {
            logger.warn(`[OpenAI Realtime] Received message for cleaned up callId ${callId}. Discarding.`);
            return;
        }
        
        try {
            await this.handleOpenAIMessage(callId, data);
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error in handleMessage for ${callId}: ${err.message}`, err);
        }
    }

    /**
     * Handle WebSocket error event
     */
    handleError(callId, error) {
        this.clearConnectionTimeout(callId);
        logger.error(`[OpenAI Realtime] WebSocket error for ${callId}: ${error.message}`);
        this.notify(callId, 'openai_error', { message: error.message || 'WebSocket error' });
        
        if (this.connections.has(callId)) {
            this.updateConnectionStatus(callId, 'error');
        }
    }

    /**
     * Handle WebSocket close event
     */
    handleClose(callId, code, reason) {
        this.clearConnectionTimeout(callId);
        const reasonStr = reason ? reason.toString() : 'No reason provided';
        logger.info(`[OpenAI Realtime] WebSocket closed for ${callId}. Code: ${code}, Reason: ${reasonStr}`);
        
        const currentConnState = this.connections.get(callId);
        if (!currentConnState) {
            logger.info(`[OpenAI Realtime] WebSocket closed for ${callId}, but connection already cleaned up.`);
            return;
        }

        this.notify(callId, 'openai_closed', { code, reason: reasonStr });
        this.updateConnectionStatus(callId, 'closed');

        // Reconnection logic
        if (code !== 1000 && code < 4000 && !this.isReconnecting.get(callId)) {
            logger.warn(`[OpenAI Realtime] Abnormal closure for ${callId} (Code: ${code}). Initiating reconnect.`);
            this.isReconnecting.set(callId, true);
            currentConnState.webSocket = null;
            currentConnState.sessionReady = false;
            
            const delay = this.calculateBackoffDelay(this.reconnectAttempts.get(callId) || 0);
            logger.info(`[OpenAI Realtime] Will attempt reconnect for ${callId} in ${delay}ms`);
            setTimeout(() => this.attemptReconnect(callId), delay);
        } else if (code === 1000 || code >= 4000) {
            logger.info(`[OpenAI Realtime] Normal closure or app error for ${callId}. Cleaning up.`);
            this.cleanup(callId);
        }
    }

    /**
     * Create and configure WebSocket connection - Simplified like test method
     */
    async connect(callId) {
        const connectionState = this.connections.get(callId);
        if (!connectionState) {
            throw new Error(`Connect: Connection state missing for ${callId}`);
        }

        if (connectionState.status === 'connecting' || connectionState.status === 'connected') {
            logger.warn(`[OpenAI Realtime] Connect called for ${callId} but already ${connectionState.status}. Ignoring.`);
            return;
        }

        this.updateConnectionStatus(callId, 'connecting');
        connectionState.lastActivity = Date.now();

        // Clear any existing timeout before creating a new connection
        this.clearConnectionTimeout(callId);

        const model = config.openai.realtimeModel || 'gpt-4o-realtime-preview-2024-12-17';
        const voice = config.openai.realtimeVoice || 'alloy';
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;
        logger.info(`[OpenAI Realtime] Connecting to ${wsUrl} for callId: ${callId}`);

        try {
            // Create WebSocket with immediate event handler setup (like test method)
            const ws = new WebSocket(wsUrl, {
                headers: {
                    Authorization: `Bearer ${config.openai.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });

            // Attach all handlers immediately (like test method)
            this.attachWebSocketHandlers(ws, callId);
            
            connectionState.webSocket = ws;
            
            // Set a single timeout for the entire connection + handshake process
            this.setConnectionTimeout(callId);

        } catch (err) {
            logger.error(`[OpenAI Realtime] CRITICAL: Error creating WebSocket for ${callId}: ${err.message}`, err);
            this.handleConnectionError(callId, err);
            throw err;
        }
    }

    /**
     * Handle connection errors consistently
     */
    handleConnectionError(callId, error) {
        this.clearConnectionTimeout(callId);
        this.updateConnectionStatus(callId, 'error');
        
        if (!this.isReconnecting.get(callId)) {
            this.isReconnecting.set(callId, true);
            const attempts = this.reconnectAttempts.get(callId) || 0;
            const delay = this.calculateBackoffDelay(attempts);
            logger.info(`[OpenAI Realtime] Will attempt reconnect after error for ${callId} in ${delay}ms`);
            setTimeout(() => this.attemptReconnect(callId), delay);
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
            this.cleanup(callId);
            return;
        }

        logger.info(`[OpenAI Realtime] Attempting reconnect #${attempts + 1} for ${callId}`);
        this.reconnectAttempts.set(callId, attempts + 1);

        let conn = this.connections.get(callId);
        if (!conn) {
            logger.error(`[OpenAI Realtime] Cannot reconnect ${callId}: state missing.`);
            this.isReconnecting.delete(callId);
            this.reconnectAttempts.delete(callId);
            return;
        }

        // Reset connection state for fresh attempt
        conn.status = 'reconnecting';
        conn.webSocket = null;
        conn.sessionReady = false;

        try {
            await this.connect(callId);
            this.isReconnecting.set(callId, false);
            logger.info(`[OpenAI Realtime] Reconnect #${attempts + 1} successful for ${callId}`);
            this.notify(callId, 'openai_reconnected', { attempts: attempts + 1 });
        } catch (err) {
            logger.error(`[OpenAI Realtime] Reconnect #${attempts + 1} failed for ${callId}: ${err.message}`);
            const delay = this.calculateBackoffDelay(attempts + 1);
            logger.info(`[OpenAI Realtime] Will retry connection for ${callId} in ${delay}ms`);
            setTimeout(() => this.attemptReconnect(callId), delay);
        }
    }

    /**
     * Update connection status safely
     */
    updateConnectionStatus(callId, status) {
        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] UpdateStatus: Attempted to update non-existent connection ${callId} to ${status}`);
            return;
        }
        const oldStatus = conn.status;
        if (oldStatus === status) return;
        conn.status = status;
        conn.lastActivity = Date.now();
        logger.info(`[OpenAI Realtime] Connection ${callId} status: ${oldStatus} -> ${status}`);
    }

    /**
     * Validate connection health
     */
    async checkConnectionHealth(callId) {
        const conn = this.connections.get(callId);
        if (!conn) return false;
        
        return conn.webSocket?.readyState === WebSocket.OPEN && 
               conn.sessionReady && 
               conn.status === 'connected';
    }

    /**
     * Process messages received from the OpenAI WebSocket - Simplified flow
     */
    async handleOpenAIMessage(callId, data) {
        let message;
        try {
            message = JSON.parse(data);
        } catch (err) {
            logger.error(`[OpenAI Realtime] Failed JSON parse for ${callId}: ${err.message}`);
            return;
        }

        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] Received message for non-existent connection ${callId}. Discarding.`);
            return;
        }
        conn.lastActivity = Date.now();

        // Log all message types for debugging
        logger.info(`[OpenAI Realtime] RECEIVED from OpenAI (${callId}): type=${message.type}${
            message.type === 'response.content_part.added' && message.part ? `, part_type=${message.part.type}` : ''
        }${
            message.type === 'conversation.item.created' ? `, item_type=${message.item?.type}, role=${message.item?.role}` : ''
        }`);

        try {
            switch (message.type) {
                case 'session.created':
                    await this.handleSessionCreated(callId, message);
                    break;

                case 'session.updated':
                    await this.handleSessionUpdated(callId, message);
                    break;

                case 'response.content_part.added':
                    await this.handleContentPartAdded(callId, message);
                    break;

                case 'conversation.item.created':
                    await this.handleConversationItemCreated(callId, message);
                    break;

                case 'response.done':
                    logger.info(`[OpenAI Realtime] Assistant response done for ${callId}`);
                    this.notify(callId, 'response_done', {});
                    break;

                case 'input_audio_buffer.speech_started':
                    logger.info(`[OpenAI Realtime] Speech started detected for ${callId}`);
                    this.notify(callId, 'speech_started', {});
                    break;

                case 'input_audio_buffer.speech_stopped':
                    logger.info(`[OpenAI Realtime] Speech stopped detected for ${callId}`);
                    this.notify(callId, 'speech_stopped', {});
                    break;

                case 'input_audio_buffer.committed':
                    logger.info(`[OpenAI Realtime] Audio buffer committed successfully for ${callId}`);
                    break;

                case 'input_audio_buffer.cleared':
                    logger.info(`[OpenAI Realtime] Audio buffer cleared for ${callId}`);
                    break;

                case 'response.created':
                    logger.info(`[OpenAI Realtime] Response created for ${callId}`);
                    break;
                case 'error':
                    await this.handleApiError(callId, message);
                    break;

                case 'session.expired':
                    await this.handleSessionExpired(callId);
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
     * Handle session.created - Send session.update immediately like test method
     */
    async handleSessionCreated(callId, message) {
        const conn = this.connections.get(callId);
        if (!conn) return;

        logger.info(`[OpenAI Realtime] Session CREATED for ${callId}, Session ID: ${message.session.id}`);
        conn.sessionId = message.session.id;

        // Send session.update immediately (like test method)
        const sessionConfig = {
            type: 'session.update',
            session: {
                instructions: conn.initialPrompt || "You are Bianca, a helpful AI assistant.",
                voice: config.openai.realtimeVoice || 'alloy',
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'pcm16',
                ...(config.openai.realtimeSessionConfig || {})
            }
        };

        logger.info(`[OpenAI Realtime] Sending session.update for ${callId}`);
        try {
            await this.sendJsonMessage(callId, sessionConfig);
        } catch (sendError) {
            logger.error(`[OpenAI Realtime] Failed to send session.update for ${callId}: ${sendError.message}`);
            this.cleanup(callId);
        }
    }

    /**
     * Handle session.updated - Mark ready and flush pending audio
     */
    async handleSessionUpdated(callId, message) {
        const conn = this.connections.get(callId);
        if (!conn) return;

        logger.info(`[OpenAI Realtime] Session UPDATED for ${callId}`);

        if (!conn.sessionReady) {
            // Clear the connection timeout since handshake is complete
            this.clearConnectionTimeout(callId);
            
            conn.sessionReady = true;
            logger.info(`[OpenAI Realtime] Session ready for ${callId}. Flushing pending audio.`);

            try {
                // Flush any pending audio
                await this.flushPendingAudio(callId);
                
                this.notify(callId, 'openai_session_ready', {});
            } catch (err) {
                logger.error(`[OpenAI Realtime] Error in session setup for ${callId}: ${err.message}`);
                this.cleanup(callId);
            }
        }
    }

    /**
     * Handle content part added
     */
    async handleContentPartAdded(callId, message) {
        // Access message.part instead of message.content_part
        const part = message.part;
        if (!part) {
            logger.warn(`[OpenAI Realtime] No part in content_part.added message for ${callId}`);
            return;
        }

        if (part.type === 'audio') {
            logger.info(`[OpenAI Realtime] Received AUDIO content for ${callId}`);
            // The audio data is in part.audio, not part.data
            if (part.audio) {
                await this.processAudioResponse(callId, part.audio);
            } else {
                logger.warn(`[OpenAI Realtime] Audio part missing audio data for ${callId}`);
            }
        } else if (part.type === 'text') {
            logger.info(`[OpenAI Realtime] Received TEXT content for ${callId}: "${part.text}"`);
        }
    }

    /**
     * Handle conversation item created
     */
    async handleConversationItemCreated(callId, message) {
        const conn = this.connections.get(callId);
        logger.info(`[OpenAI Realtime] Conversation item created for ${callId}`);
        await this.handleConversationItem(callId, message.item, conn?.conversationId);
    }

    /**
     * Handle API errors
     */
    async handleApiError(callId, message) {
        const errorMsg = message.error?.message || 'Unknown error';
        logger.error(`[OpenAI Realtime] API error for ${callId}: ${errorMsg}`);
        
        // Don't notify about expected errors during startup
        if (errorMsg.includes('buffer too small') && errorMsg.includes('0.00ms')) {
            logger.info(`[OpenAI Realtime] Ignoring empty buffer commit error for ${callId}`);
            return;
        }
        
        this.notify(callId, 'openai_error', { error: message.error });
    }

    /**
     * Handle session expired
     */
    async handleSessionExpired(callId) {
        logger.warn(`[OpenAI Realtime] Session expired for ${callId}`);
        this.notify(callId, 'openai_session_expired', {});
        
        const conn = this.connections.get(callId);
        if (!this.isReconnecting.get(callId)) {
            this.isReconnecting.set(callId, true);
            if (conn?.webSocket) {
                conn.webSocket.close(1000, "Session expired, attempting reconnect");
            } else {
                const delay = this.calculateBackoffDelay(this.reconnectAttempts.get(callId) || 0);
                setTimeout(() => this.attemptReconnect(callId), delay);
            }
        }
    }

    /**
     * Process audio response from OpenAI (PCM) -> Resample -> Convert to uLaw -> Notify ARI.
     */
    async processAudioResponse(callId, audioBase64PCM) {
        if (!audioBase64PCM) {
            logger.warn(`[OpenAI Realtime] processAudioResponse: Empty audioBase64PCM for ${callId}`);
            return;
        }
        try {
            const inputBuffer = Buffer.from(audioBase64PCM, 'base64');
            if (inputBuffer.length === 0) {
                logger.warn(`[OpenAI Realtime] processAudioResponse: Decoded audio buffer is empty for ${callId}`);
                return;
            }
            const openaiOutputRate = config.openai.outputExpectedSampleRate || CONSTANTS.OPENAI_PCM_OUTPUT_RATE;
            const asteriskPlaybackRate = CONSTANTS.DEFAULT_SAMPLE_RATE;

            logger.debug(`[OpenAI Realtime] Resampling OpenAI audio for ${callId} from ${openaiOutputRate}Hz to ${asteriskPlaybackRate}Hz`);
            const resampledBuffer = AudioUtils.resamplePcm(inputBuffer, openaiOutputRate, asteriskPlaybackRate);
            if (!resampledBuffer || resampledBuffer.length === 0) {
                logger.warn(`[OpenAI Realtime] Resampling failed for ${callId}`);
                return;
            }

            const ulawBase64ToNotify = await AudioUtils.convertPcmToUlaw(resampledBuffer);
            if (ulawBase64ToNotify && ulawBase64ToNotify.length > 0) {
                logger.info(`[OpenAI Realtime] Notifying ARI with processed uLaw audio for ${callId}`);
                this.notify(callId, 'audio_chunk', { audio: ulawBase64ToNotify });
            } else {
                logger.warn(`[OpenAI Realtime] uLaw conversion failed for ${callId}`);
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error processing audio for ${callId}: ${err.message}`, err);
        }
    }

    /**
     * Handle conversation items
     */
    async handleConversationItem(callId, item, dbConversationId) {
        if (!item) return;
        
        try {
            if (item.type === 'message') {
                const contentArray = item.content || [];
                const contentText = contentArray.map(part => (part?.type === 'text' ? part.text : '')).join('');

                if (contentText) {
                    logger.info(`[OpenAI Realtime] Message (${item.role}): "${contentText.substring(0, 100)}..."`);
                    if (dbConversationId && item.status === 'completed') {
                        try {
                            await Message.create({ 
                                role: item.role, 
                                content: contentText, 
                                conversationId: dbConversationId, 
                                openAIItemId: item.id 
                            });
                        } catch (dbErr) {
                            logger.error(`[OpenAI Realtime] Failed to save message: ${dbErr.message}`);
                        }
                    }
                    if (item.status === 'completed') {
                        this.notify(callId, 'text_message', { 
                            role: item.role, 
                            content: contentText, 
                            itemId: item.id 
                        });
                    }
                }
                if (item.audio?.data) {
                    logger.info(`[OpenAI Realtime] Message contains audio data`);
                    await this.processAudioResponse(callId, item.audio.data);
                }
            } else if (item.type === 'function_call') {
                logger.info(`[OpenAI Realtime] Function call: ${item.function_call?.name}`);
                this.notify(callId, 'function_call', { 
                    call: item.function_call, 
                    itemId: item.id 
                });
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error in handleConversationItem: ${err.message}`, err);
        }
    }

    /**
     * Send JSON message
     */
    async sendJsonMessage(callId, messageObj) {
        let wsToSend = null;
        let identifier = callId;
        let conn = null;

        if (callId) {
            conn = this.connections.get(callId);
            if (conn) {
                wsToSend = conn.webSocket;
            }
        } else if (messageObj && messageObj._testWebSocket) {
            wsToSend = messageObj._testWebSocket;
            identifier = messageObj._testId || 'standalone-test';
        }
        
        if (messageObj && messageObj._testWebSocket) delete messageObj._testWebSocket;
        if (messageObj && messageObj._testId) delete messageObj._testId;

        if (!wsToSend || wsToSend.readyState !== WebSocket.OPEN) {
            logger.warn(`[OpenAI Realtime] Cannot send - WS not open for ${identifier}`);
            return Promise.reject(new Error(`WebSocket not open for ${identifier}`));
        }

        try {
            const messageStr = JSON.stringify(messageObj);
            
            // Reduce logging verbosity for audio append messages
            if (messageObj.type === 'input_audio_buffer.append') {
                // Only log every 10th audio append, or use debug level
                if (!conn || !conn.audioAppendCount) {
                    if (conn) conn.audioAppendCount = 0;
                }
                if (conn) {
                    conn.audioAppendCount++;
                    if (conn.audioAppendCount % 10 === 0) {
                        logger.info(`[OpenAI Realtime] Sent ${conn.audioAppendCount} audio chunks to ${identifier}`);
                        this.debounceCommit(callId); 
                        logger.info(`[OpenAI Realtime] Committing audio chunks to ${identifier}`);
                    }
                }
                logger.debug(`[OpenAI Realtime] SENDING: type=${messageObj.type}, audio_length=${messageObj.audio?.length || 0}`);
            } else {
                // Log all other message types normally
                logger.info(`[OpenAI Realtime] SENDING: type=${messageObj.type}`);
            }
            
            return new Promise((resolve, reject) => {
                wsToSend.send(messageStr, (error) => {
                    if (error) {
                        logger.error(`[OpenAI Realtime] Send error: ${error.message}`, error);
                        if (conn) conn.lastActivity = Date.now();
                        reject(error);
                    } else {
                        if (conn) conn.lastActivity = Date.now();
                        resolve(true);
                    }
                });
            });
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error stringifying message: ${err.message}`);
            return Promise.reject(err);
        }
    }

    /**
     * Flush pending audio
     */
    async flushPendingAudio(callId) {
        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] flushPendingAudio: No connection for ${callId}`);
            return;
        }
        if (!conn.sessionReady) {
            logger.warn(`[OpenAI Realtime] flushPendingAudio: Session not ready for ${callId}`);
            return;
        }

        const chunks = this.pendingAudio.get(callId);
        logger.info(`[OpenAI Realtime] Checking pending audio for ${callId}: ${chunks ? chunks.length : 0} chunks found`);
        
        if (!chunks || chunks.length === 0) {
            logger.warn(`[OpenAI Realtime] No pending audio to flush for ${callId} - user may not have spoken yet`);
            return;
        }

        logger.info(`[OpenAI Realtime] Flushing ${chunks.length} pending audio chunks for ${callId}`);
        const chunksToFlush = [...chunks];
        this.pendingAudio.set(callId, []);

        // Send all chunks first
        const BATCH_SIZE = 5;
        let lastChunkSent = false;
        
        for (let i = 0; i < chunksToFlush.length; i += BATCH_SIZE) {
            const batch = chunksToFlush.slice(i, i + BATCH_SIZE);
            for (const chunkULawBase64 of batch) {
                try {
                    await this.sendAudioChunk(callId, chunkULawBase64, true);
                    lastChunkSent = true;
                } catch (sendErr) {
                    logger.error(`[OpenAI Realtime] Error sending flushed chunk: ${sendErr.message}`);
                    const remainingToRebuffer = chunksToFlush.slice(i);
                    const currentPending = this.pendingAudio.get(callId) || [];
                    this.pendingAudio.set(callId, [...remainingToRebuffer, ...currentPending]);
                    return;
                }
            }
            if (i + BATCH_SIZE < chunksToFlush.length) {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }
        
        logger.info(`[OpenAI Realtime] Finished flushing ${chunksToFlush.length} audio chunks for ${callId}`);
        
        // The last sendAudioChunk should have triggered a debounce commit
        // Log if no timer was set
        if (lastChunkSent && !this.commitTimers.has(callId)) {
            logger.warn(`[OpenAI Realtime] No commit timer set after flushing. Manually triggering debounce.`);
            this.debounceCommit(callId);
        } else if (lastChunkSent) {
            logger.info(`[OpenAI Realtime] Commit timer is active for ${callId}`);
        }
    }

    /**
     * Force send a commit for testing
     */
    async forceCommit(callId) {
        logger.info(`[OpenAI Realtime] Force commit requested for ${callId}`);
        const conn = this.connections.get(callId);
        if (!conn?.webSocket?.readyState === WebSocket.OPEN || !conn?.sessionReady) {
            logger.error(`[OpenAI Realtime] Cannot force commit - connection not ready for ${callId}`);
            return false;
        }

        try {
            await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
            logger.info(`[OpenAI Realtime] Force commit sent successfully for ${callId}`);
            return true;
        } catch (err) {
            logger.error(`[OpenAI Realtime] Force commit failed for ${callId}: ${err.message}`);
            return false;
        }
    }

    /**
     * Debounce commit
     */
    debounceCommit(callId) {
        if (this.commitTimers.has(callId)) {
            clearTimeout(this.commitTimers.get(callId));
            logger.debug(`[OpenAI Realtime] Cleared existing commit timer for ${callId}`);
        }
        
        const conn = this.connections.get(callId);
        if (!conn?.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
            logger.warn(`[OpenAI Realtime] DebounceCommit: Not ready for ${callId} - sessionReady: ${conn?.sessionReady}, ws state: ${conn?.webSocket?.readyState}`);
            return;
        }

        logger.debug(`[OpenAI Realtime] Setting commit timer (${CONSTANTS.COMMIT_DEBOUNCE_DELAY}ms) for ${callId}`);
        const timer = setTimeout(async () => {
            this.commitTimers.delete(callId);
            const currentConn = this.connections.get(callId);
            if (currentConn?.webSocket?.readyState === WebSocket.OPEN && currentConn.sessionReady) {
                logger.info(`[OpenAI Realtime] Sending debounced commit for ${callId}`);
                try {
                    await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
                } catch (commitErr) {
                    logger.error(`[OpenAI Realtime] Failed to send commit: ${commitErr.message}`);
                }
            } else {
                logger.warn(`[OpenAI Realtime] Commit timer fired but connection no longer ready for ${callId}`);
            }
        }, CONSTANTS.COMMIT_DEBOUNCE_DELAY);

        this.commitTimers.set(callId, timer);
    }

    /**
     * Send audio chunk
     */
    async sendAudioChunk(callId, audioChunkBase64ULaw, bypassBuffering = false) {
        if (!audioChunkBase64ULaw || audioChunkBase64ULaw.length === 0) {
            logger.warn(`[OpenAI Realtime] sendAudioChunk: Empty chunk for ${callId}`);
            return;
        }

        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] sendAudioChunk: No connection for ${callId}`);
            return;
        }

        // Track chunks received
        if (!conn.audioChunksReceived) conn.audioChunksReceived = 0;
        conn.audioChunksReceived++;
        
        if (conn.audioChunksReceived === 1 || conn.audioChunksReceived % 50 === 0) {
            logger.info(`[OpenAI Realtime] Received ${conn.audioChunksReceived} audio chunks from RTP for ${callId}`);
        }

        if (!bypassBuffering && (!conn.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN)) {
            logger.debug(`[OpenAI Realtime] sendAudioChunk: Not ready for ${callId}. Buffering.`);
            if (conn.status !== 'closed' && conn.status !== 'error') {
                const pending = this.pendingAudio.get(callId) || [];
                if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
                    pending.push(audioChunkBase64ULaw);
                    this.pendingAudio.set(callId, pending);
                    if (pending.length === 1 || pending.length % 10 === 0) {
                        logger.info(`[OpenAI Realtime] Buffered ${pending.length} chunks for ${callId}`);
                    }
                } else {
                    logger.warn(`[OpenAI Realtime] Buffer full for ${callId} (${CONSTANTS.MAX_PENDING_CHUNKS} chunks). Dropping chunk.`);
                }
            }
            return;
        }

        try {
            // Validate that the audio chunk is properly formatted
            const audioBuffer = Buffer.from(audioChunkBase64ULaw, 'base64');
            if (audioBuffer.length === 0) {
                logger.error(`[OpenAI Realtime] Decoded audio buffer is empty for ${callId}`);
                return;
            }

            const success = await this.sendJsonMessage(callId, {
                type: 'input_audio_buffer.append',
                audio: audioChunkBase64ULaw
            });

            logger.debug(`[OpenAI Realtime] sendJsonMessage returned: ${success} for ${callId}`); // ADD THIS

            this.debounceCommit(callId);

            if (success) {
                // Always trigger debounce commit after successfully sending audio
                // Only log this occasionally to reduce noise
                if (!conn.debugLogCount) conn.debugLogCount = 0;
                conn.debugLogCount++;
                if (conn.debugLogCount % 50 === 1) {
                    logger.debug(`[OpenAI Realtime] Audio chunks sent, debounce commit active for ${callId}`);
                }
            } else if (!bypassBuffering) {
                const pending = this.pendingAudio.get(callId) || [];
                if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
                    pending.push(audioChunkBase64ULaw);
                    this.pendingAudio.set(callId, pending);
                }
            } else {
                throw new Error("Failed to send flushed audio chunk");
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error sending audio chunk: ${err.message}`);
            if (!bypassBuffering) {
                const pending = this.pendingAudio.get(callId) || [];
                if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
                    pending.push(audioChunkBase64ULaw);
                    this.pendingAudio.set(callId, pending);
                }
            } else {
                throw err;
            }
        }
    }

    /**
     * Send a text message to OpenAI
     */
    async sendTextMessage(callId, text, role = 'user', metadata = {}) {
        if (!text || typeof text !== 'string' || text.trim() === '') {
            logger.warn(`[OpenAI Realtime] Skipping empty text message for ${callId}`);
            return;
        }
        
        logger.info(`[OpenAI Realtime] Sending ${role} text message for ${callId}: "${text.substring(0, 70)}..."`);
        
        try {
            let item;
            if (role === 'function_call_response') {
                if (!metadata.functionCallId) {
                    logger.error(`[OpenAI Realtime] Missing functionCallId for ${callId}`);
                    return;
                }
                item = { 
                    type: 'function_call_response', 
                    function_call_id: metadata.functionCallId, 
                    content: text 
                };
            } else {
                item = { 
                    type: 'message', 
                    role: role, 
                    content: [{ type: 'input_text', text }] 
                };
            }
            await this.sendJsonMessage(callId, { type: 'conversation.item.create', item });
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error sending text message: ${err.message}`, err);
        }
    }

    /**
     * Start periodic health check
     */
    startHealthCheck(interval = 60000) {
        logger.info(`[OpenAI Realtime] Starting health check (interval: ${interval}ms)`);
        if (this._healthCheckInterval) clearInterval(this._healthCheckInterval);

        this._healthCheckInterval = setInterval(() => {
            const now = Date.now();
            const idleTimeout = config.openai.idleTimeout || 300000; // 5 minutes default

            for (const [callId, conn] of this.connections.entries()) {
                if (conn.lastActivity && (now - conn.lastActivity > idleTimeout)) {
                    logger.warn(`[OpenAI Realtime] Connection ${callId} idle timeout. Cleaning up.`);
                    this.disconnect(callId);
                }
            }
        }, interval);
    }

    /**
     * Stop health check
     */
    stopHealthCheck() {
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = null;
            logger.info(`[OpenAI Realtime] Stopped health check`);
        }
    }

    /**
     * Disconnect - Updated version with better error handling
     */
    async disconnect(callId) {
        const conn = this.connections.get(callId);
        if (!conn) {
            logger.info(`[OpenAI Realtime] Disconnect called for ${callId}, but no connection found`);
            return;
        }
        
        logger.info(`[OpenAI Realtime] Disconnecting ${callId} (Status: ${conn.status})`);

        this.clearConnectionTimeout(callId);
        if (this.commitTimers.has(callId)) {
            clearTimeout(this.commitTimers.get(callId));
            this.commitTimers.delete(callId);
        }

        if (conn.webSocket) {
            const ws = conn.webSocket;
            ws.removeAllListeners();

            try {
                if (ws.readyState === WebSocket.OPEN) {
                    logger.info(`[OpenAI Realtime] Closing WebSocket for ${callId}`);
                    ws.close(1000, "Client initiated disconnect");
                } else if (ws.readyState === WebSocket.CONNECTING) {
                    logger.info(`[OpenAI Realtime] Terminating connecting WebSocket for ${callId}`);
                    // Use async termination to prevent race condition
                    setImmediate(() => {
                        try {
                            if (ws.readyState === WebSocket.CONNECTING) {
                                ws.terminate();
                            }
                        } catch (termErr) {
                            // Ignore termination errors silently
                            logger.debug(`[OpenAI Realtime] WebSocket terminate ignored: ${termErr.message}`);
                        }
                    });
                }
            } catch (err) {
                // Don't throw errors during cleanup
                logger.debug(`[OpenAI Realtime] WebSocket close/terminate ignored: ${err.message}`);
            }
            conn.webSocket = null;
        }
        this.cleanup(callId);
    }

    /**
     * Cleanup internal state
     */
    cleanup(callId, clearReconnectFlags = true) {
        this.clearConnectionTimeout(callId);
        if (this.commitTimers.has(callId)) {
            clearTimeout(this.commitTimers.get(callId));
            this.commitTimers.delete(callId);
        }

        if (this.pendingAudio.has(callId)) {
            const pendingCount = this.pendingAudio.get(callId)?.length || 0;
            if (pendingCount > 0) {
                logger.info(`[OpenAI Realtime] Clearing ${pendingCount} pending audio chunks for ${callId}`);
            }
            this.pendingAudio.delete(callId);
        }

        const deleted = this.connections.delete(callId);
        if (deleted) {
            logger.info(`[OpenAI Realtime] Cleaned up connection for ${callId}`);
        }

        if (clearReconnectFlags) {
            this.isReconnecting.delete(callId);
            this.reconnectAttempts.delete(callId);
        }
    }

    /**
     * Disconnect all connections
     */
    async disconnectAll() {
        logger.info(`[OpenAI Realtime] Disconnecting all connections (count: ${this.connections.size})`);
        const activeCallIds = [...this.connections.keys()];
        
        const disconnectPromises = activeCallIds.map(callId => {
            return this.disconnect(callId).catch(err => {
                logger.error(`[OpenAI Realtime] Error disconnecting ${callId}: ${err.message}`);
            });
        });
        
        await Promise.allSettled(disconnectPromises);
        this.stopHealthCheck();
        logger.info(`[OpenAI Realtime] All connections disconnected`);
    }

    /**
     * Test basic WebSocket connection and session handshake with OpenAI
     */
    async testBasicConnectionAndSession(testId = `test-${Date.now()}`) {
        return new Promise(async (resolve, reject) => {
            logger.info(`[OpenAI TestConn] Starting test: ${testId}`);
            let wsClient = null;
            let testTimeoutId = null;
            let sessionCreatedReceived = false;
            let sessionUpdatedReceived = false;
            let openAIResponseSessionId = null;
            let receivedMessages = [];

            const cleanupAndFinish = (outcome, data) => {
                if (testTimeoutId) clearTimeout(testTimeoutId);
                testTimeoutId = null;

                if (wsClient) {
                    const tempWs = wsClient;
                    wsClient = null;
                    
                    tempWs.removeAllListeners();
                    if (tempWs.readyState === WebSocket.OPEN || tempWs.readyState === WebSocket.CONNECTING) {
                        logger.info(`[OpenAI TestConn] Closing test WebSocket`);
                        tempWs.close(1000, `Test ${testId} finished: ${outcome}`);
                    }
                }

                if (outcome === 'resolve') {
                    logger.info(`[OpenAI TestConn] Test ${testId} SUCCEEDED`);
                    resolve(data);
                } else {
                    data.receivedMessages = receivedMessages;
                    logger.error(`[OpenAI TestConn] Test ${testId} FAILED: ${JSON.stringify(data)}`);
                    reject(data);
                }
            };

            testTimeoutId = setTimeout(() => {
                if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
                    cleanupAndFinish('reject', {
                        status: 'timeout',
                        message: `Test timed out after ${CONSTANTS.TEST_CONNECTION_TIMEOUT}ms`
                    });
                }
            }, CONSTANTS.TEST_CONNECTION_TIMEOUT);

            try {
                const model = config.openai.realtimeModel || 'gpt-4o-realtime-preview-2024-12-17';
                const voice = config.openai.realtimeVoice || 'alloy';
                const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;
                logger.info(`[OpenAI TestConn] Connecting to ${wsUrl}`);

                wsClient = new WebSocket(wsUrl, {
                    headers: {
                        Authorization: `Bearer ${config.openai.apiKey}`,
                        'OpenAI-Beta': 'realtime=v1'
                    }
                });

                wsClient.on('open', async () => {
                    logger.info(`[OpenAI TestConn] WebSocket opened`);
                });

                wsClient.on('message', async (data) => {
                    if (!wsClient) return;

                    let message;
                    try {
                        message = JSON.parse(data);
                        receivedMessages.push({ 
                            timestamp: new Date().toISOString(), 
                            type: message.type, 
                            data: message 
                        });
                        logger.info(`[OpenAI TestConn] Received: type=${message.type}`);
                    } catch (err) {
                        logger.error(`[OpenAI TestConn] JSON parse error: ${err.message}`);
                        return;
                    }

                    if (message.type === 'session.created') {
                        sessionCreatedReceived = true;
                        openAIResponseSessionId = message.session?.id;
                        logger.info(`[OpenAI TestConn] Session created, ID: ${openAIResponseSessionId}`);
                        
                        const sessionConfig = {
                            type: 'session.update',
                            session: {
                                instructions: `Test connection prompt for ${testId}`,
                                voice: config.openai.realtimeVoice || 'alloy',
                                input_audio_format: 'g711_ulaw',
                                output_audio_format: 'pcm16'
                            },
                            _testWebSocket: wsClient,
                            _testId: testId
                        };
                        
                        try {
                            await this.sendJsonMessage(null, sessionConfig);
                        } catch (sendErr) {
                            if (wsClient) cleanupAndFinish('reject', { 
                                status: 'error_sending_session_update', 
                                message: sendErr.message 
                            });
                        }
                    } else if (message.type === 'session.updated') {
                        sessionUpdatedReceived = true;
                        logger.info(`[OpenAI TestConn] Session updated`);
                        if (sessionCreatedReceived) {
                            if (wsClient) cleanupAndFinish('resolve', {
                                status: 'success',
                                message: 'Session created and updated successfully',
                                sessionId: openAIResponseSessionId || message.session?.id,
                                sessionDetails: message.session,
                                receivedMessages
                            });
                        }
                    } else if (message.type === 'error') {
                        logger.error(`[OpenAI TestConn] Error: ${JSON.stringify(message.error)}`);
                        if (wsClient) cleanupAndFinish('reject', { 
                            status: 'openai_error', 
                            error: message.error, 
                            sessionId: openAIResponseSessionId 
                        });
                    }
                });

                wsClient.on('error', (error) => {
                    logger.error(`[OpenAI TestConn] WebSocket error: ${error.message}`);
                    if (wsClient) cleanupAndFinish('reject', { 
                        status: 'ws_error', 
                        message: error.message, 
                        sessionId: openAIResponseSessionId 
                    });
                });

                wsClient.on('close', (code, reason) => {
                    const reasonStr = reason ? reason.toString() : 'No reason provided';
                    logger.info(`[OpenAI TestConn] WebSocket closed. Code: ${code}, Reason: ${reasonStr}`);
                    if (testTimeoutId && wsClient) {
                        cleanupAndFinish('reject', {
                            status: 'ws_closed_unexpectedly',
                            code,
                            reason: reasonStr,
                            sessionId: openAIResponseSessionId,
                            sessionCreated: sessionCreatedReceived,
                            sessionUpdated: sessionUpdatedReceived
                        });
                    }
                });

            } catch (err) {
                logger.error(`[OpenAI TestConn] Error creating WebSocket: ${err.message}`, err);
                cleanupAndFinish('reject', { 
                    status: 'init_error', 
                    message: err.message 
                });
            }
        });
    }

} // End OpenAIRealtimeService Class

// Ensure only one instance is created and exported
let openAIRealtimeServiceInstance = null;

function getOpenAIServiceInstance() {
    if (!openAIRealtimeServiceInstance) {
        openAIRealtimeServiceInstance = new OpenAIRealtimeService();
        openAIRealtimeServiceInstance.startHealthCheck();
    }
    return openAIRealtimeServiceInstance;
}

// Export a function to get the singleton instance
module.exports = getOpenAIServiceInstance();