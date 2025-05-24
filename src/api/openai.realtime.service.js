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
            sessionId: null
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
     * Attempt to reconnect. Uses callId as primary key.
     */
    async attemptReconnect(callId) {
        if (!this.isReconnecting.get(callId)) return; // Should only be called if isReconnecting is true

        const attempts = this.reconnectAttempts.get(callId) || 0;
        if (attempts >= CONSTANTS.RECONNECT_MAX_ATTEMPTS) {
            logger.error(`[OpenAI Realtime] Max reconnect attempts reached for ${callId}`);
            this.isReconnecting.set(callId, false);
            this.notify(callId, 'openai_max_reconnect_failed', { attempts });
            this.cleanup(callId); // Full cleanup after max retries
            return;
        }

        logger.info(`[OpenAI Realtime] Attempting reconnect #${attempts + 1} for ${callId}`);
        this.reconnectAttempts.set(callId, attempts + 1);

        let conn = this.connections.get(callId);
        if (!conn) { // Should not happen if isReconnecting was true
            logger.error(`[OpenAI Realtime] Cannot reconnect ${callId}: state missing during attempt.`);
            this.isReconnecting.delete(callId);
            this.reconnectAttempts.delete(callId);
            return;
        }

        // Reset parts of the connection state for a fresh connection attempt
        conn.status = 'initializing'; // Or 'reconnecting_attempt'
        conn.webSocket = null;
        conn.sessionReady = false;
        // Do NOT clear conn.initialPrompt, conn.conversationId, etc.

        this.updateConnectionStatus(callId, 'reconnecting'); // More specific status

        try {
            await this.connect(callId); // This will set up new WebSocket and event handlers
            this.isReconnecting.set(callId, false); // Successful reconnect
            logger.info(`[OpenAI Realtime] Reconnect #${attempts + 1} successful for ${callId}`);
            this.notify(callId, 'openai_reconnected', { attempts: attempts + 1 });
        } catch (err) {
            logger.error(`[OpenAI Realtime] Reconnect #${attempts + 1} failed for ${callId}: ${err.message}`);
            const delay = this.calculateBackoffDelay(attempts + 1); // Use current attempt count for delay
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
            // This might happen if cleanup occurred between a failed attempt and a scheduled retry
            logger.error(`[OpenAI Realtime] Connect: Connection state missing for ${callId}. Aborting connect attempt.`);
            throw new Error(`Connect: Connection state missing for ${callId}`);
        }

        const model = config.openai.realtimeModel || 'gpt-4o-realtime-preview-2024-12-17';
        const voice = config.openai.realtimeVoice || 'alloy';
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;
        logger.info(`[OpenAI Realtime] Connecting to ${wsUrl} for callId: ${callId}`);

        // Prevent multiple concurrent connection attempts for the same callId
        if (connectionState.status === 'connecting' || connectionState.status === 'connected') {
            logger.warn(`[OpenAI Realtime] Connect called for ${callId} but already ${connectionState.status}. Ignoring.`);
            return;
        }

        this.updateConnectionStatus(callId, 'connecting'); // Set status before async operations
        connectionState.lastActivity = Date.now();

        // Clear any existing timeout before creating a new one
        if (this.connectionTimeouts.has(callId)) {
            clearTimeout(this.connectionTimeouts.get(callId));
            this.connectionTimeouts.delete(callId);
        }

        const connectionTimeoutId = setTimeout(() => {
            const currentConn = this.connections.get(callId);
            if (currentConn && currentConn.status === 'connecting') { // Only terminate if still in 'connecting'
                logger.error(`[OpenAI Realtime] Connection timeout for ${callId} after ${CONSTANTS.CONNECTION_TIMEOUT}ms.`);
                if (currentConn.webSocket) {
                    currentConn.webSocket.terminate(); // Force close
                }
                // The 'close' event handler will then trigger reconnection logic if appropriate
            }
            this.connectionTimeouts.delete(callId); // Ensure timeout is cleared
        }, CONSTANTS.CONNECTION_TIMEOUT);
        this.connectionTimeouts.set(callId, connectionTimeoutId);

        try {
            const ws = new WebSocket(wsUrl, {
                headers: {
                    Authorization: `Bearer ${config.openai.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });
            connectionState.webSocket = ws; // Assign to state immediately

            ws.on('open', () => {
                if (this.connectionTimeouts.has(callId)) { // Connection successful, clear timeout
                    clearTimeout(this.connectionTimeouts.get(callId));
                    this.connectionTimeouts.delete(callId);
                }
                logger.info(`[OpenAI Realtime] WebSocket opened for callId: ${callId}`);
                this.updateConnectionStatus(callId, 'connected');
                this.reconnectAttempts.set(callId, 0); // Reset on successful open
            });

            ws.on('message', (data) => {
                // Ensure connection still exists before processing
                if (!this.connections.has(callId)) {
                    logger.warn(`[OpenAI Realtime] Received message for already cleaned up callId ${callId}. Discarding.`);
                    return;
                }
                this.handleOpenAIMessage(callId, data).catch(err => logger.error(`[OpenAI Realtime] Error in handleOpenAIMessage for ${callId}: ${err.message}`, err));
            });

            ws.on('error', (error) => {
                if (this.connectionTimeouts.has(callId)) { // Error occurred, clear timeout
                    clearTimeout(this.connectionTimeouts.get(callId));
                    this.connectionTimeouts.delete(callId);
                }
                logger.error(`[OpenAI Realtime] WebSocket error for ${callId}: ${error.message}`);
                this.notify(callId, 'openai_error', { message: error.message || 'WebSocket error' });
                if (this.connections.has(callId)) {
                    this.updateConnectionStatus(callId, 'error');
                    // The 'close' event will usually follow an error and handle reconnection logic
                }
            });

            ws.on('close', (code, reason) => {
                if (this.connectionTimeouts.has(callId)) { // Closed, clear timeout
                    clearTimeout(this.connectionTimeouts.get(callId));
                    this.connectionTimeouts.delete(callId);
                }
                const reasonStr = reason ? reason.toString() : 'No reason provided';
                logger.info(`[OpenAI Realtime] WebSocket closed for ${callId}. Code: ${code}, Reason: ${reasonStr}`);
                
                const currentConnState = this.connections.get(callId);
                if (!currentConnState) { // If connection was already cleaned up
                    logger.info(`[OpenAI Realtime] WebSocket closed for ${callId}, but connection already cleaned up.`);
                    return;
                }

                this.notify(callId, 'openai_closed', { code, reason: reasonStr });
                this.updateConnectionStatus(callId, 'closed'); // Mark as closed first

                // Reconnection logic
                // code !== 1000 (normal closure)
                // code !== 1005 (no status Rcvd - often client-side disconnect)
                // code !== 4000+ (application specific errors that might not warrant reconnect)
                // Check if isReconnecting is already true to avoid multiple parallel attempts
                if (code !== 1000 && code < 4000 && !this.isReconnecting.get(callId)) {
                    logger.warn(`[OpenAI Realtime] Abnormal WebSocket closure for ${callId} (Code: ${code}). Initiating reconnect sequence.`);
                    this.isReconnecting.set(callId, true);
                    // Don't fully cleanup yet, attemptReconnect will handle state
                    currentConnState.webSocket = null; // Ensure old ws is not reused
                    currentConnState.sessionReady = false;
                    // Initial delay before first reconnect attempt
                    const initialDelay = this.calculateBackoffDelay(this.reconnectAttempts.get(callId) || 0);
                    logger.info(`[OpenAI Realtime] Will attempt reconnect for ${callId} in ${initialDelay}ms`);
                    setTimeout(() => { this.attemptReconnect(callId); }, initialDelay);
                } else if (code === 1000 || code >=4000) {
                    logger.info(`[OpenAI Realtime] WebSocket for ${callId} closed normally or with application error not warranting reconnect. Cleaning up.`);
                    this.cleanup(callId); // Full cleanup for normal closure or non-recoverable app errors
                } else if (this.isReconnecting.get(callId)) {
                    logger.info(`[OpenAI Realtime] WebSocket for ${callId} closed while a reconnect sequence was already active.`);
                }
            });
            logger.info(`[OpenAI Realtime] WebSocket client instance event handlers configured for ${callId}`);

        } catch (err) { // Catch synchronous errors from new WebSocket() itself
            if (this.connectionTimeouts.has(callId)) {
                clearTimeout(this.connectionTimeouts.get(callId));
                this.connectionTimeouts.delete(callId);
            }
            logger.error(`[OpenAI Realtime] CRITICAL: Error instantiating WebSocket for ${callId}: ${err.message}`, err);
            if (this.connections.has(callId)) {
                this.updateConnectionStatus(callId, 'error');
                // Attempt to trigger reconnect logic similar to 'close' if appropriate
                if (!this.isReconnecting.get(callId)) {
                    this.isReconnecting.set(callId, true);
                    const attempts = this.reconnectAttempts.get(callId) || 0;
                    const delay = this.calculateBackoffDelay(attempts);
                    logger.info(`[OpenAI Realtime] Will attempt reconnect after instantiation error for ${callId} in ${delay}ms`);
                    setTimeout(() => { this.attemptReconnect(callId); }, delay);
                }
            }
            throw err; // Re-throw to signal connection failure to initializer
        }
    }


    /**
     * Update connection status safely. Uses callId.
     */
    updateConnectionStatus(callId, status) {
        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] UpdateStatus: Attempted to update status for non-existent connection ${callId} to ${status}.`);
            return;
        }
        const oldStatus = conn.status;
        if (oldStatus === status) return; // No change
        conn.status = status;
        conn.lastActivity = Date.now(); // Update activity timestamp on status change
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
            logger.error(`[OpenAI Realtime] Failed JSON parse for ${callId}: ${err.message}. Data: ${data.toString().substring(0,100)}`);
            return;
        }

        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] Received message for non-existent or cleaned up connection ${callId}. Discarding.`);
            return;
        }
        conn.lastActivity = Date.now();

        // Enhanced logging for all incoming messages
        logger.info(`[OpenAI Realtime] RECEIVED from OpenAI (${callId}): type=${message.type}, Full: ${JSON.stringify(message)}`);


        try {
            switch (message.type) {
                
                case 'session.created':
                    logger.info(`[OpenAI Realtime] Session CREATED for ${callId}, OpenAI Session ID: ${message.session.id}`);
                    if (conn) { // Ensure conn still exists
                        conn.sessionId = message.session.id; // Store the session ID

                        const sessionConfig = {
                            type: 'session.update',
                            session: {
                                instructions: conn.initialPrompt || "You are Bianca, a helpful AI assistant.",
                                voice: config.openai.realtimeVoice || 'alloy',
                                input_audio_format: 'g711_ulaw',
                                output_audio_format: 'pcm16',
                                ...(config.openai.realtimeSessionConfig || {})
                            },
                        };
                        logger.info(`[OpenAI Realtime] Sending session.update for ${callId} (Session: ${conn.sessionId}). Payload: ${JSON.stringify(sessionConfig.session)}`);
                        try {
                            await this.sendJsonMessage(callId, sessionConfig);
                            logger.info(`[OpenAI Realtime] session.update sent for ${callId}. Now WAITING for session.updated from OpenAI before proceeding.`);
                            // DO NOT set sessionReady or send more data here yet.
                            // We will do that in the 'session.updated' case.
                        } catch (sendError) {
                            logger.error(`[OpenAI Realtime] Failed to send session.update for ${callId}: ${sendError.message}. Cleaning up.`);
                            this.cleanup(callId);
                        }
                    } else {
                        logger.warn(`[OpenAI Realtime] session.created received for ${callId}, but connection object no longer exists.`);
                    }
                    break;

                case 'response.content_part.added':
                    if (message.content_part.content_type === 'audio') {
                        logger.info(`[OpenAI Realtime] Received AUDIO content part from OpenAI for ${callId}, data length: ${message.content_part.data?.length || 0}`);
                        await this.processAudioResponse(callId, message.content_part.data); // Expects PCM
                    } else if (message.content_part.content_type === 'text') {
                        logger.info(`[OpenAI Realtime] Received TEXT content part from OpenAI for ${callId}: "${message.content_part.text}"`);
                    }
                    break;

                case 'conversation.item.created':
                    logger.info(`[OpenAI Realtime] Received conversation.item.created for ${callId}. Item: ${JSON.stringify(message.item)}`);
                    await this.handleConversationItem(callId, message.item, conn.conversationId);
                    break;

                case 'response.done':
                    logger.info(`[OpenAI Realtime] Assistant response done event for ${callId}`);
                    this.notify(callId, 'response_done', {});
                    break;

                case 'error':
                    logger.error(`[OpenAI Realtime] Error from OpenAI API for ${callId}: ${message.error?.message || 'Unknown API Error'}`, message.error);
                    this.notify(callId, 'openai_error', { error: message.error });
                    // Depending on the error, might need to close/reconnect or cleanup
                    break;

                case 'session.updated':
                    logger.info(`[OpenAI Realtime] Session UPDATED for ${callId}. Details: ${JSON.stringify(message.session)}`);
                    if (conn && conn.sessionId === message.session?.id && !conn.sessionReady) {
                        // This is the acknowledgment for the session.update we sent after session.created.
                        // Now the session is truly configured and ready on OpenAI's side.
                        logger.info(`[OpenAI Realtime] Confirmed session.updated for main call ${callId}. Setting sessionReady and proceeding with initial message & audio flush.`);

                        // Send initial user message
                        logger.info(`[OpenAI Realtime] Sending initial user message for ${callId} (Session: ${conn.sessionId})`);
                        const initialUserMessage = {
                            type: 'conversation.item.create',
                            item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello, are you there?' }] }
                        };

                        try {
                            await this.sendJsonMessage(callId, initialUserMessage);

                            conn.sessionReady = true;
                            logger.info(`[OpenAI Realtime] Session for ${callId} (ID: ${conn.sessionId}) is now FULLY READY. Flushing pending audio.`);
                            await this.flushPendingAudio(callId); // This will send buffered user audio
                            this.notify(callId, 'openai_session_ready', {});

                        } catch (sendError) {
                            logger.error(`[OpenAI Realtime] Error sending initial message or flushing audio for ${callId} after session.updated: ${sendError.message}. Cleaning up.`);
                            this.cleanup(callId);
                        }

                    } else if (conn && conn.sessionId === message.session?.id && conn.sessionReady) {
                        logger.info(`[OpenAI Realtime] Received subsequent session.updated for already ready session ${callId}. No action needed.`);
                    } else {
                        logger.warn(`[OpenAI Realtime] Received session.updated, but connection/sessionID mismatch or session already ready. CallId: ${callId}, ConnSessionId: ${conn?.sessionId}, MsgSessionId: ${message.session?.id}, SessionReady: ${conn?.sessionReady}`);
                    }
                    break;

                case 'session.expired':
                    logger.warn(`[OpenAI Realtime] Session expired for ${callId}`);
                    this.notify(callId, 'openai_session_expired', {});
                    if (!this.isReconnecting.get(callId)) {
                        this.isReconnecting.set(callId, true);
                        if (conn.webSocket) {
                            conn.webSocket.close(1000, "Session expired, attempting reconnect");
                        } else { // If WS already gone, directly attempt reconnect
                           const attempts = this.reconnectAttempts.get(callId) || 0;
                           const delay = this.calculateBackoffDelay(attempts);
                           logger.info(`[OpenAI Realtime] Session expired and WS gone for ${callId}. Will attempt reconnect in ${delay}ms`);
                           setTimeout(() => { this.attemptReconnect(callId); }, delay);
                        }
                    }
                    break;

                default:
                    logger.debug(`[OpenAI Realtime] Unhandled message type ${message.type} for ${callId}. Full: ${JSON.stringify(message)}`);
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

            logger.debug(`[OpenAI Realtime] Resampling OpenAI audio for ${callId} from ${openaiOutputRate}Hz to ${asteriskPlaybackRate}Hz. Input bytes: ${inputBuffer.length}`);
            const resampledBuffer = AudioUtils.resamplePcm(inputBuffer, openaiOutputRate, asteriskPlaybackRate);
            if (!resampledBuffer || resampledBuffer.length === 0) {
                logger.warn(`[OpenAI Realtime] Resampling OpenAI audio failed or resulted in empty buffer for ${callId}`);
                return;
            }
            logger.debug(`[OpenAI Realtime] Resampled audio buffer length for ${callId}: ${resampledBuffer.length}`);

            const ulawBase64ToNotify = await AudioUtils.convertPcmToUlaw(resampledBuffer);
            if (ulawBase64ToNotify && ulawBase64ToNotify.length > 0) {
                logger.info(`[OpenAI Realtime] Notifying ARI with processed uLaw audio chunk for ${callId}, base64 length: ${ulawBase64ToNotify.length}`);
                this.notify(callId, 'audio_chunk', { audio: ulawBase64ToNotify });
            } else {
                logger.warn(`[OpenAI Realtime] uLaw conversion of OpenAI audio failed or resulted in empty data for ${callId}`);
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error processing OpenAI audio for ${callId}: ${err.message}`, err);
        }
    }

    /**
     * Handle conversation items. Uses callId internally.
     */
    async handleConversationItem(callId, item, dbConversationId) {
        if (!item) return;
        // Already logged fully in handleOpenAIMessage, can add more specific logs if needed
        try {
            if (item.type === 'message') {
                const contentArray = item.content || [];
                const contentText = contentArray.map(part => (part?.type === 'text' ? part.text : '')).join('');

                if (contentText) {
                    logger.info(`[OpenAI Realtime] CONVO_ITEM (${item.role}, status: ${item.status || 'N/A'}) for ${callId}: "${contentText.substring(0, 100)}..."`);
                    if (dbConversationId && item.status === 'completed') {
                        try {
                            await Message.create({ role: item.role, content: contentText, conversationId: dbConversationId, openAIItemId: item.id });
                            logger.debug(`[OpenAI Realtime] Saved message (ID: ${item.id}) for ${callId}/${dbConversationId}`);
                        } catch (dbErr) {
                            logger.error(`[OpenAI Realtime] Failed to save message (ID: ${item.id}) for ${callId}/${dbConversationId}: ${dbErr.message}`);
                        }
                    }
                    if (item.status === 'completed') {
                        this.notify(callId, 'text_message', { role: item.role, content: contentText, itemId: item.id });
                    }
                }
                if (item.audio?.data) { // This might be for user's transcribed audio or assistant's audio
                    logger.info(`[OpenAI Realtime] CONVO_ITEM (${item.role}) for ${callId} contains audio data. Processing.`);
                    await this.processAudioResponse(callId, item.audio.data);
                } else if (!contentText && item.role === 'assistant' && item.status === 'completed') {
                    logger.debug(`[OpenAI Realtime] Completed assistant item with no text/audio for ${callId}. Item ID: ${item.id}`);
                }
            } else if (item.type === 'function_call') {
                logger.info(`[OpenAI Realtime] Function call received for ${callId}: ${item.function_call?.name || 'N/A'}. ID: ${item.id}. Args: ${JSON.stringify(item.function_call?.arguments)}`);
                this.notify(callId, 'function_call', { call: item.function_call, itemId: item.id });
            } else {
                logger.debug(`[OpenAI Realtime] Unhandled conversation item type: ${item.type} for ${callId}. Item ID: ${item.id}`);
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error in handleConversationItem for ${callId} (Item ID: ${item?.id}): ${err.message}`, err);
            this.notify(callId, 'openai_item_processing_error', { itemType: item?.type, itemId: item?.id, error: err.message });
        }
    }

    /**
     * Send JSON message. Uses callId.
     */
    /**
     * Send JSON message. Uses callId or a passed WebSocket for tests.
     */
    async sendJsonMessage(callId, messageObj) {
        let wsToSend = null;
        let identifier = callId;
        let conn = null; // Keep conn for lastActivity update if it's a regular call

        if (callId) {
            conn = this.connections.get(callId);
            if (conn) {
                wsToSend = conn.webSocket;
            }
        } else if (messageObj && messageObj._testWebSocket) { // Check for test WebSocket
            wsToSend = messageObj._testWebSocket;
            identifier = messageObj._testId || 'standalone-test'; // Use a test identifier for logging
            // Create a temporary structure for logging if needed, or just use identifier
        }
        
        // Remove internal props before stringifying, regardless of source
        if (messageObj && messageObj._testWebSocket) delete messageObj._testWebSocket;
        if (messageObj && messageObj._testId) delete messageObj._testId;


        if (!wsToSend || wsToSend.readyState !== WebSocket.OPEN) {
            logger.warn(`[OpenAI Realtime] Cannot send JSON - WS not open for ${identifier}. Type: ${messageObj?.type}. WS ReadyState: ${wsToSend?.readyState}`);
            return Promise.reject(new Error(`WebSocket not open for ${identifier}`));
        }
        try {
            const messageStr = JSON.stringify(messageObj);

            if (messageObj.type === 'input_audio_buffer.append') {
                logger.info(`[OpenAI Realtime] SENDING to OpenAI (${identifier}): type=${messageObj.type}, audio_length=${messageObj.audio?.length || 0}`);
            } else if (messageObj.type === 'input_audio_buffer.commit') {
                logger.info(`[OpenAI Realtime] SENDING to OpenAI (${identifier}): type=${messageObj.type}`);
            } else {
                logger.info(`[OpenAI Realtime] SENDING to OpenAI (${identifier}): type=${messageObj.type}, details: ${messageStr.substring(0, 250)}...`);
            }
            
            return new Promise((resolve, reject) => {
                wsToSend.send(messageStr, (error) => {
                    if (error) {
                        logger.error(`[OpenAI Realtime] WebSocket ws.send() ERROR for ${identifier} (type: ${messageObj.type}): ${error.message}`, error);
                        if(conn) conn.lastActivity = Date.now(); // Update lastActivity only if it's a regular connection
                        reject(error); 
                    } else {
                        logger.debug(`[OpenAI Realtime] WebSocket ws.send() successful for ${identifier} (type: ${messageObj.type})`);
                        if(conn) conn.lastActivity = Date.now(); // Update lastActivity only if it's a regular connection
                        resolve(true); 
                    }
                });
            });

        } catch (err) { 
            logger.error(`[OpenAI Realtime] Error stringifying message for OpenAI (${identifier}): ${err.message}`);
            return Promise.reject(err);
        }
    }


    /**
     * Flush pending audio. Uses callId. Sends data through sendAudioChunk.
     */
    async flushPendingAudio(callId) {
        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] flushPendingAudio: No connection found for ${callId}. Cannot flush.`);
            return;
        }
        if (!conn.sessionReady) {
            logger.warn(`[OpenAI Realtime] flushPendingAudio: Session not ready for ${callId}. Buffering continues.`);
            return;
        }

        const chunks = this.pendingAudio.get(callId);
        if (!chunks || chunks.length === 0) {
            logger.debug(`[OpenAI Realtime] No pending audio to flush for ${callId}.`);
            return;
        }

        logger.info(`[OpenAI Realtime] Flushing ${chunks.length} pending uLaw audio chunks for ${callId}`);
        const chunksToFlush = [...chunks]; // Create a copy
        this.pendingAudio.set(callId, []); // Clear original buffer immediately

        const BATCH_SIZE = 5; // Send in small batches
        for (let i = 0; i < chunksToFlush.length; i += BATCH_SIZE) {
            const batch = chunksToFlush.slice(i, i + BATCH_SIZE);
            // Sequentially process batches to avoid overwhelming the ws.send buffer or network
            for (const chunkULawBase64 of batch) {
                try {
                    // sendAudioChunk itself handles the actual sending via sendJsonMessage
                    await this.sendAudioChunk(callId, chunkULawBase64, true); // Pass a flag to bypass buffering
                } catch (sendErr) {
                    logger.error(`[OpenAI Realtime] Error sending a flushed audio chunk for ${callId}: ${sendErr.message}. Re-buffering remaining.`);
                    // Re-add remaining chunks (including current failed one) to the front of the pending buffer
                    const remainingToRebuffer = chunksToFlush.slice(i);
                    const currentPending = this.pendingAudio.get(callId) || [];
                    this.pendingAudio.set(callId, [...remainingToRebuffer, ...currentPending]);
                    return; // Stop flushing on error
                }
            }
            if (i + BATCH_SIZE < chunksToFlush.length) {
                await new Promise(resolve => setTimeout(resolve, 20)); // Small delay between batches
            }
        }
        logger.info(`[OpenAI Realtime] Finished flushing ${chunksToFlush.length} pending audio chunks for ${callId}.`);
        if (chunksToFlush.length > 0) { // If we sent anything, send a commit
            logger.info(`[OpenAI Realtime] Sending commit after flushing audio for ${callId}`);
            await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
        }
    }

    /**
     * Debounce commit. Uses callId.
     */
    debounceCommit(callId) {
        if (this.commitTimers.has(callId)) {
            clearTimeout(this.commitTimers.get(callId));
        }
        const conn = this.connections.get(callId);
        if (!conn?.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
            logger.debug(`[OpenAI Realtime] DebounceCommit: WS/Session not ready for ${callId}. Commit not scheduled.`);
            return;
        }

        const timer = setTimeout(async () => {
            this.commitTimers.delete(callId); // Remove before async operation
            const currentConn = this.connections.get(callId); // Re-fetch, state might have changed
            if (currentConn?.webSocket?.readyState === WebSocket.OPEN && currentConn.sessionReady) {
                logger.info(`[OpenAI Realtime] Sending debounced commit for ${callId}`);
                try {
                    await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
                } catch (commitErr) {
                    logger.error(`[OpenAI Realtime] Failed to send debounced commit for ${callId}: ${commitErr.message}`);
                }
            } else {
                logger.warn(`[OpenAI Realtime] Skipped debounced commit, WS/session not ready for ${callId} at execution time.`);
            }
        }, CONSTANTS.COMMIT_DEBOUNCE_DELAY);

        this.commitTimers.set(callId, timer);
    }

    /**
     * Send audio chunk. Expects uLaw base64 (from RTP listener).
     * If called from flushPendingAudio, bypassBuffering will be true.
     */
    async sendAudioChunk(callId, audioChunkBase64ULaw, bypassBuffering = false) {
        if (!audioChunkBase64ULaw || audioChunkBase64ULaw.length === 0) {
            logger.warn(`[OpenAI Realtime] sendAudioChunk: Empty audio chunk for ${callId}. Skipping.`);
            return;
        }

        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] sendAudioChunk: No connection found for ${callId}. Cannot send/buffer.`);
            return;
        }

        if (!bypassBuffering && (!conn.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN)) {
            logger.warn(`[OpenAI Realtime] sendAudioChunk: WS/Session not ready for ${callId}. Buffering audio.`);
            if (conn.status !== 'closed' && conn.status !== 'error') { // Only buffer if connection is in a potentially recoverable state
                const pending = this.pendingAudio.get(callId) || []; // Ensure array exists
                if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
                    pending.push(audioChunkBase64ULaw);
                    this.pendingAudio.set(callId, pending); // Make sure it's set back if it was initially undefined
                } else {
                    logger.warn(`[OpenAI Realtime] Pending audio buffer full for ${callId}. Dropping chunk. Consider increasing MAX_PENDING_CHUNKS or investigating session readiness delay.`);
                }
            }
            return;
        }

        // If bypassing buffer (i.e., called from flush) or if session is ready for direct send
        try {
            // logger.debug(`[OpenAI Realtime] Sending audio chunk for ${callId} directly, size: ${audioChunkBase64ULaw.length} chars`);
            const success = await this.sendJsonMessage(callId, {
                type: 'input_audio_buffer.append',
                audio: audioChunkBase64ULaw
            });

            if (success) {
                this.debounceCommit(callId); // Debounce a commit after successfully appending audio
            } else {
                // Error already logged by sendJsonMessage, but we might want to re-buffer if it failed to send
                logger.warn(`[OpenAI Realtime] Failed to send audio chunk for ${callId} (sessionReady=${conn.sessionReady}). Re-buffering if not from flush.`);
                if (!bypassBuffering) { // If it wasn't from flush, re-buffer it
                    const pending = this.pendingAudio.get(callId) || [];
                     if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) pending.push(audioChunkBase64ULaw);
                     this.pendingAudio.set(callId, pending);
                } else {
                    throw new Error("Failed to send flushed audio chunk."); // Propagate error if called from flush
                }
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error sending uLaw audio chunk for ${callId}: ${err.message}`, err);
            if (!bypassBuffering) { // If it wasn't from flush, re-buffer it
                const pending = this.pendingAudio.get(callId) || [];
                if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) pending.push(audioChunkBase64ULaw);
                this.pendingAudio.set(callId, pending);
            } else {
                throw err; // Re-throw if called from flush to signal failure
            }
        }
    }


    /**
     * Send a text message to OpenAI. Uses callId.
     */
    async sendTextMessage(callId, text, role = 'user', metadata = {}) {
        if (!text || typeof text !== 'string' || text.trim() === '') {
            logger.warn(`[OpenAI Realtime] Skipping empty or invalid text message for ${callId}`);
            return;
        }
        logger.info(`[OpenAI Realtime] Preparing to send ${role} text message for ${callId}: "${text.substring(0, 70)}..."`);
        try {
            let item;
            if (role === 'function_call_response') {
                if (!metadata.functionCallId) {
                    logger.error(`[OpenAI Realtime] Missing functionCallId for role '${role}' on ${callId}`);
                    return;
                }
                item = { type: 'function_call_response', function_call_id: metadata.functionCallId, content: text };
            } else { // Default to user or assistant message
                item = { type: 'message', role: role, content: [{ type: 'input_text', text }] };
            }
            await this.sendJsonMessage(callId, { type: 'conversation.item.create', item });
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error sending text message for ${callId}: ${err.message}`, err);
        }
    }

    /**
     * Start periodic health check.
     */
    startHealthCheck(interval = 60000) { // Default to 1 minute
        logger.info(`[OpenAI Realtime] Starting health check (interval: ${interval}ms)`);
        if (this._healthCheckInterval) clearInterval(this._healthCheckInterval);

        this._healthCheckInterval = setInterval(() => {
            const now = Date.now();
            const idleTimeout = config.openai.idleTimeout || 300000; // 5 minutes default

            // logger.debug(`[OpenAI Realtime Health Check] Running. Connections: ${this.connections.size}`);
            for (const [callId, conn] of this.connections.entries()) {
                if (conn.lastActivity && (now - conn.lastActivity > idleTimeout)) {
                    logger.warn(`[OpenAI Realtime] Connection ${callId} idle timeout (${idleTimeout}ms since last activity at ${new Date(conn.lastActivity).toISOString()}). Cleaning up.`);
                    this.disconnect(callId); // Use callId
                }
                // Optional: Add a ping mechanism if OpenAI supports it via WebSocket
                // if (conn.webSocket && conn.webSocket.readyState === WebSocket.OPEN) {
                //    conn.webSocket.ping(() => logger.debug(`Sent WebSocket ping to ${callId}`));
                // }
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
            logger.info(`[OpenAI Realtime] Disconnect called for ${callId}, but no active connection found.`);
            return;
        }
        logger.info(`[OpenAI Realtime] Disconnecting callId: ${callId} (Current Status: ${conn.status})`);

        if (this.connectionTimeouts.has(callId)) {
            clearTimeout(this.connectionTimeouts.get(callId));
            this.connectionTimeouts.delete(callId);
        }
        if (this.commitTimers.has(callId)) {
            clearTimeout(this.commitTimers.get(callId));
            this.commitTimers.delete(callId);
        }

        if (conn.webSocket) {
            const ws = conn.webSocket;
            // Remove listeners to prevent them firing during or after explicit close/terminate
            ws.removeAllListeners('open');
            ws.removeAllListeners('message');
            ws.removeAllListeners('error');
            ws.removeAllListeners('close');
            // ws.removeAllListeners('ping');
            // ws.removeAllListeners('pong');


            try {
                if (ws.readyState === WebSocket.OPEN) {
                    logger.info(`[OpenAI Realtime] Closing WebSocket for ${callId} with code 1000.`);
                    ws.close(1000, "Client initiated disconnect");
                } else if (ws.readyState === WebSocket.CONNECTING) {
                    logger.info(`[OpenAI Realtime] Terminating connecting WebSocket for ${callId}.`);
                    ws.terminate();
                } else {
                    logger.info(`[OpenAI Realtime] WebSocket for ${callId} already in state ${ws.readyState}. No action needed for ws object itself.`);
                }
            } catch (err) { // Should be rare as close/terminate are generally safe
                logger.error(`[OpenAI Realtime] Error during explicit WebSocket close/terminate for ${callId}: ${err.message}`);
            }
            conn.webSocket = null; // Nullify to prevent reuse
        }
        this.cleanup(callId); // Perform full cleanup of maps
    }

    /**
     * Cleanup internal state maps. Uses callId (Twilio SID).
     */
    cleanup(callId, clearReconnectFlags = true) {
        // Ensure timers are cleared again, in case disconnect wasn't called or failed mid-way
        if (this.connectionTimeouts.has(callId)) {
            clearTimeout(this.connectionTimeouts.get(callId));
            this.connectionTimeouts.delete(callId);
        }
        if (this.commitTimers.has(callId)) {
            clearTimeout(this.commitTimers.get(callId));
            this.commitTimers.delete(callId);
        }

        if (this.pendingAudio.has(callId)) {
            logger.info(`[OpenAI Realtime] Clearing ${this.pendingAudio.get(callId).length} pending audio chunks for ${callId} during cleanup.`);
            this.pendingAudio.delete(callId);
        }

        const deleted = this.connections.delete(callId);
        if (deleted) {
            logger.info(`[OpenAI Realtime] Cleaned up connection state map for callId: ${callId}.`);
        } else {
            logger.info(`[OpenAI Realtime] Cleanup called for ${callId}, but it was not found in connections map (possibly already cleaned).`);
        }

        if (clearReconnectFlags) {
            if (this.isReconnecting.delete(callId)) {
                 logger.debug(`[OpenAI Realtime] Cleared reconnecting flag for ${callId}.`);
            }
            if (this.reconnectAttempts.delete(callId)) {
                 logger.debug(`[OpenAI Realtime] Cleared reconnect attempts for ${callId}.`);
            }
        }
    }

    /**
     * Disconnect all connections.
     */
    async disconnectAll() {
        logger.info(`[OpenAI Realtime] Disconnecting all connections (current count: ${this.connections.size})`);
        const activeCallIds = [...this.connections.keys()]; // Get keys before iterating as disconnect modifies the map
        
        const disconnectPromises = activeCallIds.map(callId => {
            // disconnect is async if it were to await ws.close, but here it's mostly synchronous cleanup
            // Wrap in a promise to use with Promise.allSettled if needed, though direct call is fine
            return this.disconnect(callId).catch(err => {
                logger.error(`[OpenAI Realtime] Error during disconnectAll for callId ${callId}: ${err.message}`);
            });
        });
        
        await Promise.allSettled(disconnectPromises); // Wait for all disconnect operations
        
        this.stopHealthCheck(); // Stop health check after attempting to disconnect all
        logger.info(`[OpenAI Realtime] All connections processed for disconnection and health check stopped.`);
    }

    /**
     * NEW METHOD: Test basic WebSocket connection and session handshake with OpenAI.
     * This method is standalone and does not use the main `this.connections` map.
     * @param {string} testId - A unique identifier for this test run, for logging.
     * @returns {Promise<object>} Resolves with session details on success, rejects on error/timeout.
     */
    async testBasicConnectionAndSession(testId = `standalone-test-${Date.now()}`) {
        return new Promise(async (resolve, reject) => {
            logger.info(`[OpenAI TestConn] Starting test: ${testId}`);
            let wsClient = null;
            let testTimeoutId = null;
            let sessionCreatedReceived = false;
            let sessionUpdatedReceived = false;
            let openAIResponseSessionId = null;
            let receivedMessages = []; // To track received messages for debugging

            const cleanupAndFinish = (outcome, data) => {
                if (testTimeoutId) clearTimeout(testTimeoutId);
                testTimeoutId = null; // Prevent multiple calls

                if (wsClient) {
                    const tempWs = wsClient; // Avoid race if wsClient is nulled by another path
                    wsClient = null; // Prevent further operations on this ws
                    
                    tempWs.removeAllListeners(); // Important before close/terminate
                    if (tempWs.readyState === WebSocket.OPEN || tempWs.readyState === WebSocket.CONNECTING) {
                        logger.info(`[OpenAI TestConn] Closing test WebSocket for ${testId}. Current state: ${tempWs.readyState}`);
                        tempWs.close(1000, `Test ${testId} finished: ${outcome}`);
                    } else {
                         logger.info(`[OpenAI TestConn] Test WebSocket for ${testId} already in state ${tempWs.readyState}. Not closing again.`);
                    }
                } else {
                    logger.info(`[OpenAI TestConn] cleanupAndFinish: wsClient already null for ${testId}.`);
                }


                if (outcome === 'resolve') {
                    logger.info(`[OpenAI TestConn] Test ${testId} SUCCEEDED. Data: ${JSON.stringify(data)}`);
                    resolve(data);
                } else {
                    data.receivedMessages = receivedMessages; // Add received messages to error object
                    logger.error(`[OpenAI TestConn] Test ${testId} FAILED. Data: ${JSON.stringify(data)}`);
                    reject(data);
                }
            };

            testTimeoutId = setTimeout(() => {
                if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) { // Check if cleanupAndFinish hasn't run
                     cleanupAndFinish('reject', {
                        status: 'timeout',
                        message: `Test connection ${testId} timed out after ${CONSTANTS.TEST_CONNECTION_TIMEOUT}ms. SessionCreated: ${sessionCreatedReceived}, SessionUpdated: ${sessionUpdatedReceived}`
                    });
                } else {
                    logger.info(`[OpenAI TestConn] Timeout for ${testId}, but cleanupAndFinish seems to have already run or wsClient is null.`);
                }
            }, CONSTANTS.TEST_CONNECTION_TIMEOUT);

            try {
                const model = config.openai.realtimeModel || 'gpt-4o-realtime-preview-2024-12-17';
                const voice = config.openai.realtimeVoice || 'alloy';
                const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;
                logger.info(`[OpenAI TestConn] Connecting to ${wsUrl} for test: ${testId}`);

                wsClient = new WebSocket(wsUrl, {
                    headers: {
                        Authorization: `Bearer ${config.openai.apiKey}`,
                        'OpenAI-Beta': 'realtime=v1'
                    }
                });

                wsClient.on('open', async () => {
                    logger.info(`[OpenAI TestConn] WebSocket opened for test: ${testId}`);
                    // OpenAI should send 'session.created' automatically after 'open'
                });

                wsClient.on('message', async (data) => {
                    if (!wsClient) return; // If already cleaned up

                    let message;
                    try {
                        message = JSON.parse(data);
                        receivedMessages.push({ timestamp: new Date().toISOString(), type: message.type, data: message });
                        logger.info(`[OpenAI TestConn] RECEIVED from OpenAI (${testId}): type=${message.type}, Full: ${JSON.stringify(message)}`);
                    } catch (err) {
                        logger.error(`[OpenAI TestConn] Failed JSON parse for ${testId}: ${err.message}. Data: ${data.toString().substring(0,100)}`);
                        return; 
                    }

                    if (message.type === 'session.created') {
                        sessionCreatedReceived = true;
                        openAIResponseSessionId = message.session?.id;
                        logger.info(`[OpenAI TestConn] Session CREATED for ${testId}, OpenAI Session ID: ${openAIResponseSessionId}`);
                        
                        const sessionConfig = {
                            type: 'session.update',
                            session: {
                                instructions: `Test connection prompt for ${testId}.`,
                                voice: config.openai.realtimeVoice || 'alloy',
                                input_audio_format: 'g711_ulaw', // Required, even if not sending audio for this test
                                output_audio_format: 'pcm16',   // Required
                            },
                            _testWebSocket: wsClient, // Pass the ws object for sendJsonMessage
                            _testId: testId
                        };
                        logger.info(`[OpenAI TestConn] Sending session.update for ${testId}`);
                        try {
                            // Use the class's sendJsonMessage, but pass null for callId
                            // and the _testWebSocket and _testId will be picked up by the modified sendJsonMessage
                            await this.sendJsonMessage(null, sessionConfig);
                        } catch (sendErr) {
                            if (wsClient) cleanupAndFinish('reject', { status: 'error_sending_session_update', message: `Failed to send session.update: ${sendErr.message}` });
                        }
                    } else if (message.type === 'session.updated') {
                        sessionUpdatedReceived = true;
                        logger.info(`[OpenAI TestConn] Session UPDATED for ${testId}. Details: ${JSON.stringify(message.session)}`);
                        if (sessionCreatedReceived) { // Ensure created was received first
                            if (wsClient) cleanupAndFinish('resolve', {
                                status: 'success',
                                message: 'Session created and updated successfully.',
                                sessionId: openAIResponseSessionId || message.session?.id, // Prefer the one from session.created
                                sessionDetails: message.session,
                                receivedMessages
                            });
                        } else {
                            logger.warn(`[OpenAI TestConn] Received session.updated before session.created for ${testId}. This is unusual.`);
                        }
                    } else if (message.type === 'error') {
                        logger.error(`[OpenAI TestConn] Error message from OpenAI for ${testId}: ${JSON.stringify(message.error)}`);
                         if (wsClient) cleanupAndFinish('reject', { status: 'openai_error', error: message.error, sessionId: openAIResponseSessionId });
                    }
                });

                wsClient.on('error', (error) => {
                    logger.error(`[OpenAI TestConn] WebSocket error for ${testId}: ${error.message}`);
                    if (wsClient) cleanupAndFinish('reject', { status: 'ws_error', message: error.message, sessionId: openAIResponseSessionId });
                });

                wsClient.on('close', (code, reason) => {
                    const reasonStr = reason ? reason.toString() : 'No reason provided';
                    logger.info(`[OpenAI TestConn] WebSocket closed for ${testId}. Code: ${code}, Reason: ${reasonStr}`);
                    // If not already resolved/rejected by timeout or success/error message
                    // Check if cleanupAndFinish has effectively been called (testTimeoutId would be null or wsClient would be null)
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

            } catch (err) { // Synchronous errors from new WebSocket()
                logger.error(`[OpenAI TestConn] CRITICAL: Error instantiating WebSocket for test ${testId}: ${err.message}`, err);
                cleanupAndFinish('reject', { status: 'init_error', message: err.message });
            }
        });
    }

} // End OpenAIRealtimeService Class

// Ensure only one instance is created and exported
let openAIRealtimeServiceInstance = null;

function getOpenAIServiceInstance() {
    if (!openAIRealtimeServiceInstance) {
        openAIRealtimeServiceInstance = new OpenAIRealtimeService();
        openAIRealtimeServiceInstance.startHealthCheck(); // Start health check when instance is first created
    }
    return openAIRealtimeServiceInstance;
}

// Export a function to get the singleton instance
module.exports = getOpenAIServiceInstance();

// For potential direct script execution or testing (if not using module system)
// if (typeof module !== 'undefined' && !module.parent) {
//   const service = getOpenAIServiceInstance();
//   logger.info("OpenAIRealtimeService instance created for direct execution/testing.");
//   // Add test calls here if needed
// }
