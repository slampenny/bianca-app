// src/services/openai.realtime.service.js

const WebSocket = require('ws');
const { Buffer } = require('buffer');
const config = require('../config/config');
const logger = require('../config/logger');
const { Message } = require('../models'); // Assuming Message model is used for saving transcripts
const AudioUtils = require('../api/audio.utils'); // Assumes this uses alawmulaw and has resamplePcm

/**
 * Constants for configuration
 */
const CONSTANTS = {
    MAX_PENDING_CHUNKS: 100, // Maximum number of audio chunks to buffer
    RECONNECT_MAX_ATTEMPTS: 5, // Maximum number of reconnection attempts
    RECONNECT_BASE_DELAY: 1000, // Base delay for exponential backoff (milliseconds)
    COMMIT_DEBOUNCE_DELAY: 500, // Increased to 500ms for better batching
    CONNECTION_TIMEOUT: 15000, // WebSocket connection + handshake timeout (milliseconds)
    DEFAULT_SAMPLE_RATE: 24000, // OpenAI Realtime API uses 24kHz for PCM16
    ASTERISK_SAMPLE_RATE: 8000, // Rate of audio FOR Asterisk (uLaw)
    OPENAI_PCM_OUTPUT_RATE: 24000, // Expected rate FROM OpenAI for pcm16 output
    TEST_CONNECTION_TIMEOUT: 20000, // Timeout for the standalone test connection method (milliseconds)
    AUDIO_BATCH_SIZE: 50, // Send audio in batches of 10 chunks
};

const fs = require('fs'); // Fallback for local saving if S3 fails or is not configured
const path = require('path'); // For local saving

const DEBUG_AUDIO_LOCAL_DIR = path.join(__dirname, '..', '..', 'debug_audio_calls'); // Adjust path as needed

// Ensure the main directory exists when the service starts (or before first write)
try {
    if (!fs.existsSync(DEBUG_AUDIO_LOCAL_DIR)) {
        fs.mkdirSync(DEBUG_AUDIO_LOCAL_DIR, { recursive: true });
        logger.info(`[OpenAI Realtime] Created local debug audio directory: ${DEBUG_AUDIO_LOCAL_DIR}`);
    }
} catch (dirError) {
    logger.error(`[OpenAI Realtime] Could not create local debug audio directory ${DEBUG_AUDIO_LOCAL_DIR}: ${dirError.message}`);
}

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
    
    // The callId is already the primary identifier (Twilio SID)
    // We need to pass it directly to the callback
    try {
        this.notifyCallback(callId, eventType, data);
    } catch (err) {
        logger.error(`[OpenAI Realtime] Error in notification callback for CallID ${callId} / Event ${eventType}: ${err.message}`);
    }
}

    async appendAudioToLocalFile(callId, pcmBuffer) {
        if (!pcmBuffer || pcmBuffer.length === 0) {
            return;
        }
        // Ensure a directory for this specific callId exists
        const callAudioDir = path.join(DEBUG_AUDIO_LOCAL_DIR, callId);
        try {
            if (!fs.existsSync(callAudioDir)) {
                fs.mkdirSync(callAudioDir, { recursive: true });
            }
        } catch (dirError) {
            logger.error(`[OpenAI Realtime] Could not create call-specific debug audio directory ${callAudioDir}: ${dirError.message}`);
            return; // Don't try to write if directory fails
        }

        const filePath = path.join(callAudioDir, `output_for_openai.pcm`);
        try {
            fs.appendFileSync(filePath, pcmBuffer);
            // Log less frequently to avoid flooding, e.g., only on first append or periodically
            // logger.debug(`[OpenAI Realtime] Appended ${pcmBuffer.length} bytes to ${filePath}`);
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error appending to local debug audio file ${filePath}: ${err.message}`);
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
            audioChunksReceived: 0, // Track how many chunks we receive
            audioChunksSent: 0, // Track how many chunks we send to OpenAI
            lastCommitTime: 0, // Track when we last committed
            pendingCommit: false // Track if we have a pending commit
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

    isConnectionReady(callId) {
        const connection = this.connections.get(callId);
        return connection && 
            connection.ws && 
            connection.ws.readyState === WebSocket.OPEN &&
            connection.sessionReady === true;
    }

    sendResponseCreate(callId) {
        const connection = this.connections.get(callId);
        if (!connection || !connection.ws || connection.ws.readyState !== WebSocket.OPEN) {
            logger.warn(`[OpenAI Realtime] Cannot send response.create - no active connection for ${callId}`);
            return;
        }

        try {
            const responseCreateEvent = {
                type: 'response.create',
                response: {
                    modalities: ['text', 'audio'],
                    instructions: 'Please greet the caller warmly and ask how you can help them today.'
                }
            };
            
            connection.ws.send(JSON.stringify(responseCreateEvent));
            logger.info(`[OpenAI Realtime] Sent response.create for ${callId}`);
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error sending response.create for ${callId}: ${err.message}`);
        }
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
        // Reset counters on reconnect
        conn.audioChunksReceived = 0;
        conn.audioChunksSent = 0;
        conn.lastCommitTime = 0;
        conn.pendingCommit = false;

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
                case 'response.audio.delta': 
                    await this.handleResponseAudioDelta(callId, message);
                    break;
                case 'conversation.item.created':
                    await this.handleConversationItemCreated(callId, message);
                    break;

                case 'response.done':
                    logger.info(`[OpenAI Realtime] Assistant response done for ${callId}`);
                    this.notify(callId, 'response_done', {});
                    break;

                case 'conversation.item.input_audio_transcription.completed':
                    logger.info(`[OpenAI Realtime] Audio transcription completed for ${callId}: "${message.transcript}"`);
                    break;

                case 'response.audio_transcript.delta':
                    logger.info(`[OpenAI Realtime] Audio transcript delta for ${callId}: "${message.delta}"`);
                    break;

                case 'input_audio_buffer.speech_started':
                    logger.info(`[OpenAI Realtime] Speech started detected for ${callId}`);
                    this.notify(callId, 'speech_started', {});
                    break;

                case 'input_audio_buffer.speech_stopped':
                    logger.info(`[OpenAI Realtime] Speech stopped detected for ${callId}`);
                    this.notify(callId, 'speech_stopped', {});
                    // Automatically trigger response generation if VAD is disabled
                    const connForResponse = this.connections.get(callId);
                    if (connForResponse?.sessionReady) {
                        logger.info(`[OpenAI Realtime] Triggering response generation for ${callId}`);
                        try {
                            await this.sendJsonMessage(callId, { type: 'response.create' });
                        } catch (err) {
                            logger.error(`[OpenAI Realtime] Failed to trigger response: ${err.message}`);
                        }
                    }
                    break;

                case 'input_audio_buffer.committed':
                    logger.info(`[OpenAI Realtime] Audio buffer committed successfully for ${callId}`);
                    // Reset counters and flags when audio is actually committed
                    if (conn) {
                        conn.pendingCommit = false;
                        conn.lastCommitTime = Date.now();
                        // Reset counters since the audio has been processed
                        const chunksProcessed = conn.audioChunksSent || 0;
                        conn.audioChunksSent = 0;
                        logger.info(`[OpenAI Realtime] Reset audio counters for ${callId} after processing ${chunksProcessed} chunks`);
                    }
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
                modalities: ["text", "audio"],
                instructions: conn.initialPrompt || "You are Bianca, a helpful AI assistant.",
                voice: config.openai.realtimeVoice || 'alloy',
                // USE PCM16 instead of g711_ulaw for better quality and reliability
                input_audio_format: 'pcm16',  // Much better speech recognition
                output_audio_format: 'pcm16', // Higher quality output
                // Add turn detection for automatic response generation
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500  // Wait 1 second after speech stops
                },
                // Add input transcription to help with debugging
                input_audio_transcription: {
                    model: 'whisper-1'
                },
                //...(config.openai.realtimeSessionConfig || {})
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
            // Reset counters when session becomes ready
            conn.audioChunksReceived = 0;
            conn.audioChunksSent = 0;
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
            logger.info(`[OpenAI Realtime] Received 'response.content_part.added' with part_type=audio for ${callId}.`);
            if (part.audio && typeof part.audio === 'string' && part.audio.length > 0) {
                logger.info(`[OpenAI Realtime] 'response.content_part.added' (audio) has data. Processing via processAudioResponse.`);
                await this.processAudioResponse(callId, part.audio);
            } else {
                // This is the warning you were seeing. It's valid if OpenAI sends this structure without data.
                logger.warn(`[OpenAI Realtime] 'response.content_part.added' (audio) for ${callId} is missing 'part.audio' data. Audio is expected via 'response.audio.delta'.`);
            }
        } else if (part.type === 'text') {
            logger.info(`[OpenAI Realtime] Received TEXT content part for ${callId}: "${part.text}"`);
            // Note: 'conversation.item.created' usually handles full text message saving.
            // This 'content_part.added' for text is more like a delta.
            this.notify(callId, 'openai_text_delta', { text: part.text, sessionId: this.connections.get(callId)?.sessionId });
        } else {
            logger.debug(`[OpenAI Realtime] Unhandled part type '${part.type}' in response.content_part.added for ${callId}`);
        }
    }

    async handleResponseAudioDelta(callId, message) { // <<<< NEW HANDLER
        if (!message.delta || typeof message.delta !== 'string' || message.delta.length === 0) {
            logger.warn(`[OpenAI Realtime] Received 'response.audio.delta' for ${callId} but 'message.delta' (audio data) is missing or empty.`);
            return;
        }
        // logger.debug(`[OpenAI Realtime] Processing response.audio.delta for ${callId}, data length: ${message.delta.length}`);
        await this.processAudioResponse(callId, message.delta);
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
    // In OpenAIRealtimeService class
async handleApiError(callId, message) {
        const errorMsg = message.error?.message || 'Unknown OpenAI API error';
        const errorCode = message.error?.code || 'UNKNOWN_CODE';
        // Log the full error object for detailed debugging
        logger.error(`[OpenAI Realtime] API error from OpenAI for ${callId}. Code: ${errorCode}, Message: "${errorMsg}"`, { openAIError: message.error });

        const conn = this.connections.get(callId);

        if (errorMsg.includes('buffer too small') && errorMsg.includes('0.00ms')) {
            logger.error(`[OpenAI Realtime] CRITICAL DIAGNOSTIC: OpenAI reported 'buffer too small (0.00ms)' for ${callId} on commit. This means audio appends are failing or the data is invalid. Input audio pipeline needs urgent review.`);
            if (conn) {
                conn.pendingCommit = false; // The commit was processed (and failed), allow new attempts.
                // conn.audioChunksSent = 0; // Reset as this batch failed.
            }
        } else if (errorMsg.includes("Conversation already has an active response")) {
            logger.warn(`[OpenAI Realtime] API Error for ${callId}: "Conversation already has an active response". This often happens if a fallback response.create was sent while OpenAI was already generating. Current pendingCommit: ${conn?.pendingCommit}`);
            // No specific action needed here usually, just a diagnostic.
             if (conn) conn.pendingCommit = false; // If this error was related to a commit that also triggered a response.create
        } else if (errorCode === 'session_not_found' || errorCode === 'session_expired_error' || errorCode === 'session_internal_error') {
            logger.warn(`[OpenAI Realtime] Session error for ${callId}: ${errorCode}. Message: "${errorMsg}". Triggering session expiry handling.`);
            await this.handleSessionExpired(callId); // Treat as expired to force reconnect
            return; // Specific handling done
        } else if (errorCode === 'invalid_request_error' && errorMsg.includes('Invalid audio format')) {
             logger.error(`[OpenAI Realtime] OpenAI API Error for ${callId}: "Invalid audio format". Check input_audio_format and output_audio_format in session.update and actual audio data being sent/received.`);
             // This might be a critical configuration error.
             if(conn) conn.pendingCommit = false; // If related to a commit.
        }
        // Add more specific error code handling here as you discover them

        this.notify(callId, 'openai_api_error', { error: message.error, message: errorMsg, code: errorCode });
    }

    /**
     * Handle session expired
     */
    async handleSessionExpired(callId) {
        logger.warn(`[OpenAI Realtime] Session expired or reported as invalid for ${callId}. Initiating reconnect sequence if not already in progress.`);
        this.notify(callId, 'openai_session_expired', {});
        
        const conn = this.connections.get(callId);
        if (conn && !this.isReconnecting.get(callId)) { // Check if not already trying to reconnect
            this.isReconnecting.set(callId, true); // Mark that we are starting a reconnect process
            if (conn.webSocket) {
                logger.info(`[OpenAI Realtime] Closing WebSocket for ${callId} due to session expiry to trigger reconnect.`);
                conn.webSocket.close(1000, "Session expired, client initiating reconnect"); // Normal close to trigger handleClose
            } else {
                // If WS somehow already gone, directly attempt reconnect
                logger.info(`[OpenAI Realtime] WebSocket for ${callId} already gone. Directly attempting reconnect after session expiry.`);
                const delay = this.calculateBackoffDelay(this.reconnectAttempts.get(callId) || 0);
                setTimeout(() => this.attemptReconnect(callId), delay);
            }
        } else if (conn && this.isReconnecting.get(callId)) {
            logger.info(`[OpenAI Realtime] Session expired for ${callId}, but already in reconnecting state. Reconnect process will continue.`);
        } else if (!conn) {
            logger.warn(`[OpenAI Realtime] Session expired for ${callId}, but no connection state found.`);
        }
    }

    /**
     * Process audio response from OpenAI (PCM) -> Resample -> Convert to uLaw -> Notify ARI.
     */
    async processAudioResponse(callId, audioBase64PCM) {
        return this.processAudioResponseDebug(callId, audioBase64PCM);
        // if (!audioBase64PCM) {
        //     logger.warn(`[OpenAI Realtime] processAudioResponse: Empty audioBase64PCM for ${callId}`);
        //     return;
        // }
        // try {
        //     const inputBuffer = Buffer.from(audioBase64PCM, 'base64');
        //     if (inputBuffer.length === 0) {
        //         logger.warn(`[OpenAI Realtime] processAudioResponse: Decoded audio buffer is empty for ${callId}`);
        //         return;
        //     }
            
        //     // OpenAI sends PCM16 at 24kHz, need to downsample to 8kHz for Asterisk
        //     const openaiOutputRate = CONSTANTS.OPENAI_PCM_OUTPUT_RATE; // 24kHz
        //     const asteriskPlaybackRate = CONSTANTS.ASTERISK_SAMPLE_RATE; // 8kHz

        //     logger.debug(`[OpenAI Realtime] Resampling OpenAI audio for ${callId} from ${openaiOutputRate}Hz to ${asteriskPlaybackRate}Hz`);
        //     const resampledBuffer = AudioUtils.resamplePcm(inputBuffer, openaiOutputRate, asteriskPlaybackRate);
        //     if (!resampledBuffer || resampledBuffer.length === 0) {
        //         logger.warn(`[OpenAI Realtime] Resampling failed for ${callId}`);
        //         return;
        //     }

        //     const ulawBase64ToNotify = await AudioUtils.convertPcmToUlaw(resampledBuffer);
        //     if (ulawBase64ToNotify && ulawBase64ToNotify.length > 0) {
        //         logger.info(`[OpenAI Realtime] Notifying ARI with processed uLaw audio for ${callId}`);
        //         this.notify(callId, 'audio_chunk', { audio: ulawBase64ToNotify });
        //     } else {
        //         logger.warn(`[OpenAI Realtime] uLaw conversion failed for ${callId}`);
        //     }
        // } catch (err) {
        //     logger.error(`[OpenAI Realtime] Error processing audio for ${callId}: ${err.message}`, err);
        // }
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
     * Flush pending audio - FIXED VERSION with audio conversion
     */
    async flushPendingAudio(callId) {
        const conn = this.connections.get(callId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] flushPendingAudio: No connection for ${callId}.`);
            return;
        }
        if (!conn.sessionReady) {
            logger.warn(`[OpenAI Realtime] flushPendingAudio: Session not ready for ${callId}. Cannot flush.`);
            return;
        }

        const chunksULawBase64 = this.pendingAudio.get(callId);
        if (!chunksULawBase64 || chunksULawBase64.length === 0) {
            logger.info(`[OpenAI Realtime] No pending uLaw audio to flush for ${callId}.`);
            return;
        }

        logger.info(`[OpenAI Realtime] Flushing ${chunksULawBase64.length} pending uLaw audio chunks for ${callId}.`);
        const chunksToProcess = [...chunksULawBase64];
        this.pendingAudio.set(callId, []); 

        let successfullyProcessedAndSentCount = 0;
        let totalInputULawBytes = 0;
        let totalOutputPCM24Bytes = 0;

        for (const chunkULawBase64 of chunksToProcess) {
            let ulawBuffer, pcm8khzBuffer, pcm24khzBuffer, pcm24khzBase64ToSend;
            try {
                if (!chunkULawBase64 || chunkULawBase64.length === 0) {
                    logger.warn(`[OpenAI Realtime] flushPendingAudio (${callId}): Encountered empty base64 uLaw chunk. Skipping.`);
                    continue;
                }
                ulawBuffer = Buffer.from(chunkULawBase64, 'base64');
                totalInputULawBytes += ulawBuffer.length;
                if (!ulawBuffer || ulawBuffer.length === 0) {
                    logger.warn(`[OpenAI Realtime] flushPendingAudio (${callId}): Decoded uLaw buffer is empty. Original base64 length: ${chunkULawBase64.length}. Skipping.`);
                    continue;
                }

                pcm8khzBuffer = await AudioUtils.convertUlawToPcm(ulawBuffer);
                if (!pcm8khzBuffer || pcm8khzBuffer.length === 0) {
                    logger.warn(`[OpenAI Realtime] flushPendingAudio (${callId}): AudioUtils.convertUlawToPcm returned empty buffer. uLaw bytes: ${ulawBuffer.length}. Skipping.`);
                    continue;
                }

                pcm24khzBuffer = AudioUtils.resamplePcm(pcm8khzBuffer, CONSTANTS.ASTERISK_SAMPLE_RATE, CONSTANTS.DEFAULT_SAMPLE_RATE);
                if (!pcm24khzBuffer || pcm24khzBuffer.length === 0) {
                    logger.warn(`[OpenAI Realtime] flushPendingAudio (${callId}): AudioUtils.resamplePcm returned empty buffer. PCM 8kHz bytes: ${pcm8khzBuffer.length}. Skipping.`);
                    continue;
                }
                totalOutputPCM24Bytes += pcm24khzBuffer.length;
                
                
                await this.appendAudioToLocalFile(callId, pcm24khzBuffer);

                pcm24khzBase64ToSend = pcm24khzBuffer.toString('base64');
                if (!pcm24khzBase64ToSend) {
                    logger.warn(`[OpenAI Realtime] flushPendingAudio (${callId}): Base64 encoding of 24kHz PCM resulted in an empty string. PCM 24kHz bytes: ${pcm24khzBuffer.length}. Skipping.`);
                    continue;
                }
                // DETAILED LOG FOR EACH APPEND ATTEMPT
                logger.debug(`[OpenAI Realtime] flushPendingAudio (${callId}): Attempting append. uLaw bytes: ${ulawBuffer.length}, PCM8k bytes: ${pcm8khzBuffer.length}, PCM24k bytes: ${pcm24khzBuffer.length}, Base64 PCM24k len: ${pcm24khzBase64ToSend.length}`);

                await this.sendJsonMessage(callId, {
                    type: 'input_audio_buffer.append',
                    audio: pcm24khzBase64ToSend
                });
                conn.audioChunksSent++;
                successfullyProcessedAndSentCount++;

            } catch (audioProcessingError) {
                logger.error(`[OpenAI Realtime] flushPendingAudio (${callId}): Error processing a pending chunk: ${audioProcessingError.message}`, audioProcessingError.stack);
            }
        }

        logger.info(`[OpenAI Realtime] flushPendingAudio (${callId}): Finished processing. Sent ${successfullyProcessedAndSentCount} of ${chunksToProcess.length} chunks. Total input uLaw bytes: ${totalInputULawBytes}, Total output PCM24k bytes (before base64): ${totalOutputPCM24Bytes}.`);

        if (successfullyProcessedAndSentCount > 0) {
            if (conn.sessionReady && conn.webSocket?.readyState === WebSocket.OPEN && !conn.pendingCommit) {
                logger.info(`[OpenAI Realtime] flushPendingAudio (${callId}): Committing ${successfullyProcessedAndSentCount} appended audio chunks.`);
                try {
                    await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
                    conn.pendingCommit = true;
                } catch (commitErr) {
                    logger.error(`[OpenAI Realtime] flushPendingAudio (${callId}): Failed to send commit after flushing: ${commitErr.message}`);
                    conn.pendingCommit = false; // Ensure it's reset on commit send failure
                }
            } else {
                 logger.warn(`[OpenAI Realtime] flushPendingAudio (${callId}): Conditions not met for commit. sessionReady: ${conn.sessionReady}, wsState: ${conn.webSocket?.readyState}, pendingCommit: ${conn.pendingCommit}`);
            }
        } else if (chunksToProcess.length > 0) {
            logger.warn(`[OpenAI Realtime] flushPendingAudio (${callId}): No chunks were successfully processed. No commit will be sent.`);
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
            conn.pendingCommit = true;
            return true;
        } catch (err) {
            logger.error(`[OpenAI Realtime] Force commit failed for ${callId}: ${err.message}`);
            return false;
        }
    }

    /**
     * IMPROVED: Smarter debounce commit logic with response trigger
     */
    debounceCommit(callId) {
        const conn = this.connections.get(callId);
        if (!conn?.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
            logger.warn(`[OpenAI Realtime] DebounceCommit: Not ready for ${callId} - sessionReady: ${conn?.sessionReady}, ws state: ${conn?.webSocket?.readyState}`);
            return;
        }

        // Don't start new timer if we already have a pending commit
        if (conn.pendingCommit) {
            logger.debug(`[OpenAI Realtime] DebounceCommit: Already have pending commit for ${callId}`);
            return;
        }

        // Clear existing timer
        if (this.commitTimers.has(callId)) {
            clearTimeout(this.commitTimers.get(callId));
            logger.debug(`[OpenAI Realtime] Cleared existing commit timer for ${callId}`);
        }

        logger.debug(`[OpenAI Realtime] Setting commit timer (${CONSTANTS.COMMIT_DEBOUNCE_DELAY}ms) for ${callId}`);
        const timer = setTimeout(async () => {
            this.commitTimers.delete(callId);
            const currentConn = this.connections.get(callId);

            logger.info(`[OpenAI Realtime] checking commit conditions for ${callId} - ready first: ${currentConn?.webSocket?.readyState === WebSocket.OPEN} ready 2nd: ${currentConn?.sessionReady}, pending: ${currentConn?.pendingCommit}`);            
            
            if (currentConn?.webSocket?.readyState === WebSocket.OPEN && currentConn.sessionReady && !currentConn.pendingCommit) {
                logger.info(`[OpenAI Realtime] Sending debounced commit for ${callId}`);
                try {
                    await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
                    currentConn.pendingCommit = true;
                    
                    // Optional: Trigger response after a delay if no VAD response comes
                    setTimeout(async () => {
                        if (currentConn?.webSocket?.readyState === WebSocket.OPEN && currentConn.sessionReady) {
                            logger.info(`[OpenAI Realtime] Triggering manual response for ${callId} (fallback)`);
                            try {
                                await this.sendJsonMessage(callId, { type: 'response.create' });
                            } catch (respErr) {
                                logger.error(`[OpenAI Realtime] Failed to trigger manual response: ${respErr.message}`);
                            }
                        }
                    }, 2000); // Wait 2 seconds for VAD, then trigger manually
                    
                } catch (commitErr) {
                    logger.error(`[OpenAI Realtime] Failed to send commit: ${commitErr.message}`);
                }
            } else {
                logger.debug(`[OpenAI Realtime] Commit timer fired but conditions not met for ${callId} - ready: ${currentConn?.sessionReady}, pending: ${currentConn?.pendingCommit}`);
            }
        }, CONSTANTS.COMMIT_DEBOUNCE_DELAY);

        this.commitTimers.set(callId, timer);
    }

    /**
     * IMPROVED: Send audio chunk with audio conversion for OpenAI
     */
    async sendAudioChunk(callId, audioChunkBase64ULaw, bypassBuffering = false) {
        return this.sendAudioChunkDebug(callId, audioChunkBase64ULaw, bypassBuffering);
        // if (!audioChunkBase64ULaw || audioChunkBase64ULaw.length === 0) {
        //     logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): Empty base64 uLaw chunk. Skipping.`);
        //     return;
        // }

        // const conn = this.connections.get(callId);
        // if (!conn) {
        //     logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): No connection. Skipping.`);
        //     return;
        // }

        // conn.audioChunksReceived++;
        // if (conn.audioChunksReceived % 100 === 0) { // Log less frequently
        //     logger.info(`[OpenAI Realtime] Received ${conn.audioChunksReceived} audio chunks from RTP for ${callId}`);
        // }

        // if (!bypassBuffering && (!conn.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN)) {
        //     // logger.debug(`[OpenAI Realtime] sendAudioChunk (${callId}): Session not ready or WS not open. Buffering.`);
        //     if (conn.status !== 'closed' && conn.status !== 'error_terminal') {
        //         const pending = this.pendingAudio.get(callId) || [];
        //         if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
        //             pending.push(audioChunkBase64ULaw);
        //             this.pendingAudio.set(callId, pending);
        //         } else {
        //             logger.warn(`[OpenAI Realtime] Audio buffer full for ${callId}. Dropping uLaw chunk.`);
        //         }
        //     }
        //     return;
        // }

        // let ulawBuffer, pcm8khzBuffer, pcm24khzBuffer, pcm24khzBase64ToSend;
        // try {
        //     ulawBuffer = Buffer.from(audioChunkBase64ULaw, 'base64');
        //     if (!ulawBuffer || ulawBuffer.length === 0) {
        //         logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): Decoded uLaw buffer empty. Base64 len: ${audioChunkBase64ULaw.length}. Skipping.`);
        //         return;
        //     }

        //     pcm8khzBuffer = await AudioUtils.convertUlawToPcm(ulawBuffer);
        //     if (!pcm8khzBuffer || pcm8khzBuffer.length === 0) {
        //         logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): convertUlawToPcm empty. uLaw bytes: ${ulawBuffer.length}. Skipping.`);
        //         return;
        //     }

        //     pcm24khzBuffer = AudioUtils.resamplePcm(pcm8khzBuffer, CONSTANTS.ASTERISK_SAMPLE_RATE, CONSTANTS.DEFAULT_SAMPLE_RATE);
        //     if (!pcm24khzBuffer || pcm24khzBuffer.length === 0) {
        //         logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): resamplePcm empty. PCM8k bytes: ${pcm8khzBuffer.length}. Skipping.`);
        //         return;
        //     }

        //     await this.appendAudioToLocalFile(callId, pcm24khzBuffer); 
            
        //     pcm24khzBase64ToSend = pcm24khzBuffer.toString('base64');
        //     if (!pcm24khzBase64ToSend) {
        //         logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): Base64 encoding empty. PCM24k bytes: ${pcm24khzBuffer.length}. Skipping.`);
        //         return;
        //     }
        //     // DETAILED LOG FOR EACH APPEND ATTEMPT
        //     logger.debug(`[OpenAI Realtime] sendAudioChunk (${callId}): Appending. uLaw bytes: ${ulawBuffer.length}, PCM8k: ${pcm8khzBuffer.length}, PCM24k: ${pcm24khzBuffer.length}, B64PCM24k len: ${pcm24khzBase64ToSend.length}`);

        //     await this.sendJsonMessage(callId, {
        //         type: 'input_audio_buffer.append',
        //         audio: pcm24khzBase64ToSend
        //     });

        //     conn.audioChunksSent++;
        //     if (conn.audioChunksSent > 0 && conn.audioChunksSent % CONSTANTS.AUDIO_BATCH_SIZE === 0) {
        //         // logger.info(`[OpenAI Realtime] Sent ${conn.audioChunksSent} converted chunks since last commit, triggering debounce commit for ${callId}`);
        //         this.debounceCommit(callId);
        //     }

        // } catch (audioProcessingError) {
        //     logger.error(`[OpenAI Realtime] sendAudioChunk (${callId}): Audio processing error: ${audioProcessingError.message}`, audioProcessingError.stack);
        //     return;
        // }
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

        // Upload debug audio before cleanup
        await this.handleCallEnd(callId);

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
 * Debug audio data by logging samples
 */
debugAudioBuffer(label, buffer, format = 'pcm16') {
    if (!buffer || buffer.length === 0) {
        logger.warn(`[AUDIO DEBUG] ${label}: Empty buffer`);
        return;
    }

    const info = AudioUtils.getAudioInfo(buffer, format);
    logger.info(`[AUDIO DEBUG] ${label}: ${info.bytes} bytes, ${info.samples} samples, ${info.durationMs}ms`);

    // Log first few samples
    if (format === 'pcm16' && buffer.length >= 10) {
        const samples = [];
        for (let i = 0; i < Math.min(10, buffer.length / 2); i++) {
            samples.push(buffer.readInt16LE(i * 2));
        }
        logger.info(`[AUDIO DEBUG] ${label} first samples: ${samples.join(', ')}`);
        
        // Check if samples are in expected range
        const maxSample = Math.max(...samples.map(Math.abs));
        if (maxSample > 32767) {
            logger.error(`[AUDIO DEBUG] ${label}: Sample overflow detected! Max: ${maxSample}`);
        } else if (maxSample < 100) {
            logger.warn(`[AUDIO DEBUG] ${label}: Very quiet audio. Max amplitude: ${maxSample}`);
        }
    } else if (format === 'ulaw' && buffer.length >= 10) {
        const samples = [];
        for (let i = 0; i < Math.min(10, buffer.length); i++) {
            samples.push(buffer[i]);
        }
        logger.info(`[AUDIO DEBUG] ${label} first ulaw bytes: ${samples.map(b => '0x' + b.toString(16)).join(', ')}`);
    }
}

/**
 * Save audio to file for analysis
 */
async saveDebugAudio(callId, label, buffer, format = 'pcm16', sampleRate = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${callId}_${label}_${timestamp}.${format === 'pcm16' ? 'raw' : 'ulaw'}`;
    const filepath = path.join(DEBUG_AUDIO_LOCAL_DIR, callId, filename);
    
    try {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filepath, buffer);
        logger.info(`[AUDIO DEBUG] Saved ${filepath} (${buffer.length} bytes)`);
        
        // Also save format info
        const infoPath = filepath + '.info.json';
        const defaultSampleRate = format === 'pcm16' ? 24000 : 8000;
        fs.writeFileSync(infoPath, JSON.stringify({
            format,
            sampleRate: sampleRate || defaultSampleRate,
            channels: 1,
            bytesPerSample: format === 'pcm16' ? 2 : 1,
            samples: Math.floor(buffer.length / (format === 'pcm16' ? 2 : 1)),
            durationMs: Math.floor(buffer.length / (format === 'pcm16' ? 2 : 1) / ((sampleRate || defaultSampleRate) / 1000))
        }, null, 2));
    } catch (err) {
        logger.error(`[AUDIO DEBUG] Failed to save debug audio: ${err.message}`);
    }
}

/**
 * Updated processAudioResponse with debugging
 */
async processAudioResponseDebug(callId, audioBase64PCM) {
    if (!audioBase64PCM) {
        logger.warn(`[OpenAI Realtime] processAudioResponse: Empty audioBase64PCM for ${callId}`);
        return;
    }
    
    try {
        // Initialize files on first audio from OpenAI if needed
        const conn = this.connections.get(callId);
        if (conn && !conn._debugFilesInitialized) {
            this.initializeContinuousDebugFiles(callId);
            conn._debugFilesInitialized = true;
        }
        
        // STAGE 1: Decode base64 from OpenAI
        const inputBuffer = Buffer.from(audioBase64PCM, 'base64');
        if (inputBuffer.length === 0) {
            logger.warn(`[OpenAI Realtime] processAudioResponse: Decoded audio buffer is empty for ${callId}`);
            return;
        }
        
        // Append RAW input from OpenAI
        await this.appendToContinuousDebugFile(callId, 'continuous_from_openai_pcm24k.raw', inputBuffer);
        
        // STAGE 2: Resample from 24kHz to 8kHz
        const openaiOutputRate = CONSTANTS.OPENAI_PCM_OUTPUT_RATE; // 24kHz
        const asteriskPlaybackRate = CONSTANTS.ASTERISK_SAMPLE_RATE; // 8kHz

        const resampledBuffer = AudioUtils.resamplePcm(inputBuffer, openaiOutputRate, asteriskPlaybackRate);
        
        if (!resampledBuffer || resampledBuffer.length === 0) {
            logger.error(`[AUDIO DEBUG] Resampling FAILED for ${callId}`);
            return;
        }
        
        // Append resampled audio
        await this.appendToContinuousDebugFile(callId, 'continuous_from_openai_pcm8k.raw', resampledBuffer);

        // STAGE 3: Convert PCM to uLaw
        const ulawBase64 = await AudioUtils.convertPcmToUlaw(resampledBuffer);
        
        if (!ulawBase64 || ulawBase64.length === 0) {
            logger.error(`[AUDIO DEBUG] PCM to uLaw conversion FAILED`);
            return;
        }
        
        // Append final uLaw
        const ulawRawBuffer = Buffer.from(ulawBase64, 'base64');
        await this.appendToContinuousDebugFile(callId, 'continuous_from_openai_ulaw.ulaw', ulawRawBuffer);
        
        // Log progress every 100 chunks
        if (!conn._openaiChunkCount) conn._openaiChunkCount = 0;
        conn._openaiChunkCount++;
        if (conn._openaiChunkCount % 100 === 0) {
            logger.info(`[AUDIO DEBUG] Processed ${conn._openaiChunkCount} chunks from OpenAI for ${callId}`);
        }
        
        this.notify(callId, 'audio_chunk', { audio: ulawBase64 });
        
    } catch (err) {
        logger.error(`[OpenAI Realtime] Error processing audio for ${callId}: ${err.message}`, err);
    }
}

async appendToContinuousDebugFile(callId, filename, buffer) {
    if (!buffer || buffer.length === 0) return;
    
    const filepath = path.join(DEBUG_AUDIO_LOCAL_DIR, callId, filename);
    try {
        fs.appendFileSync(filepath, buffer);
    } catch (err) {
        logger.error(`[AUDIO DEBUG] Failed to append to ${filename}: ${err.message}`);
    }
}

/**
 * Initialize continuous debug files for a call
 */
initializeContinuousDebugFiles(callId) {
    const callAudioDir = path.join(DEBUG_AUDIO_LOCAL_DIR, callId);
    try {
        if (!fs.existsSync(callAudioDir)) {
            fs.mkdirSync(callAudioDir, { recursive: true });
        }
        
        // Create empty files or clear existing ones
        const files = [
            'continuous_from_asterisk_ulaw.ulaw',
            'continuous_from_asterisk_pcm8k.raw',
            'continuous_from_asterisk_pcm24k.raw',
            'continuous_from_openai_pcm24k.raw',
            'continuous_from_openai_pcm8k.raw',
            'continuous_from_openai_ulaw.ulaw'
        ];
        
        files.forEach(filename => {
            const filepath = path.join(callAudioDir, filename);
            fs.writeFileSync(filepath, Buffer.alloc(0)); // Create empty file
        });
        
        logger.info(`[AUDIO DEBUG] Initialized continuous debug files for ${callId}`);
    } catch (err) {
        logger.error(`[AUDIO DEBUG] Failed to initialize debug files: ${err.message}`);
    }
}

/**
 * Upload continuous audio files to S3 after call ends
 */
/**
 * Upload continuous audio files to S3 after call ends - FIXED VERSION
 * Only uploads 2 files: one combined file from Asterisk and one from OpenAI
 */
async uploadDebugAudioToS3(callId) {
    const S3Service = require('./s3.service');
    
    try {
        const callAudioDir = path.join(DEBUG_AUDIO_LOCAL_DIR, callId);
        
        // Only upload the TWO main continuous files
        const filesToUpload = [
            {
                source: 'continuous_from_asterisk_ulaw.ulaw',
                format: 'mulaw',
                sampleRate: 8000,
                channels: 1,
                s3Key: `debug-audio/${callId}/caller_to_openai_8khz.wav`,
                description: 'Complete audio from caller to OpenAI (8kHz)'
            },
            {
                source: 'continuous_from_openai_pcm24k.raw',
                format: 's16le',
                sampleRate: 24000,
                channels: 1,
                s3Key: `debug-audio/${callId}/openai_to_caller_24khz.wav`,
                description: 'Complete audio from OpenAI to caller (24kHz)'
            }
        ];
        
        const uploadedFiles = [];
        
        for (const file of filesToUpload) {
            const sourceFile = path.join(callAudioDir, file.source);
            
            // Check if file exists and has content
            if (!fs.existsSync(sourceFile)) {
                logger.warn(`[AUDIO DEBUG] File not found: ${sourceFile}`);
                continue;
            }
            
            const stats = fs.statSync(sourceFile);
            if (stats.size === 0) {
                logger.warn(`[AUDIO DEBUG] File is empty: ${sourceFile}`);
                continue;
            }
            
            logger.info(`[AUDIO DEBUG] Converting and uploading ${file.source} (${stats.size} bytes) to S3...`);
            
            // Convert to WAV format for easy playback
            const wavFile = sourceFile.replace(/\.[^.]+$/, '.wav');
            const ffmpegCommand = `ffmpeg -f ${file.format} -ar ${file.sampleRate} -ac ${file.channels} -i "${sourceFile}" -y "${wavFile}"`;
            
            try {
                // Execute ffmpeg conversion
                const { exec } = require('child_process');
                await new Promise((resolve, reject) => {
                    exec(ffmpegCommand, (error, stdout, stderr) => {
                        if (error) {
                            logger.error(`[AUDIO DEBUG] FFmpeg error for ${file.source}: ${error.message}`);
                            logger.error(`[AUDIO DEBUG] FFmpeg stderr: ${stderr}`);
                            reject(error);
                        } else {
                            logger.info(`[AUDIO DEBUG] Successfully converted ${file.source} to WAV`);
                            resolve();
                        }
                    });
                });
                
                // Upload to S3
                const fileContent = fs.readFileSync(wavFile);
                const uploadResult = await S3Service.uploadFile(
                    fileContent,
                    file.s3Key,
                    'audio/wav',
                    {
                        callId: callId,
                        originalFormat: file.format,
                        sampleRate: file.sampleRate.toString(),
                        direction: file.source.includes('asterisk') ? 'inbound' : 'outbound',
                        originalSize: stats.size.toString(),
                        convertedSize: fileContent.length.toString()
                    }
                );
                
                // Get presigned URL for easy download
                const downloadUrl = await S3Service.getPresignedUrl(file.s3Key, 3600); // 1 hour expiry
                
                uploadedFiles.push({
                    key: file.s3Key,
                    url: downloadUrl,
                    description: file.description,
                    originalSize: stats.size,
                    convertedSize: fileContent.length
                });
                
                logger.info(`[AUDIO DEBUG] Successfully uploaded ${file.s3Key} to S3`);
                
                // Clean up local WAV file
                fs.unlinkSync(wavFile);
                
            } catch (err) {
                logger.error(`[AUDIO DEBUG] Failed to process ${file.source}: ${err.message}`);
            }
        }
        
        // Log the download URLs in a clean format
        if (uploadedFiles.length > 0) {
            logger.info(`[AUDIO DEBUG] ===== DEBUG AUDIO READY FOR CALL ${callId} =====`);
            uploadedFiles.forEach(file => {
                const sizeMB = (file.originalSize / 1024 / 1024).toFixed(2);
                logger.info(`[AUDIO DEBUG] ${file.description}`);
                logger.info(`[AUDIO DEBUG]   Size: ${sizeMB} MB | URL: ${file.url}`);
            });
            logger.info(`[AUDIO DEBUG] ===============================================`);
        }
        
        // Optionally clean up local files after successful upload
        const cleanup = config.debug?.cleanupLocalFiles ?? false;
        if (cleanup && uploadedFiles.length === filesToUpload.length) {
            try {
                fs.rmSync(callAudioDir, { recursive: true, force: true });
                logger.info(`[AUDIO DEBUG] Cleaned up local debug files for ${callId}`);
            } catch (err) {
                logger.error(`[AUDIO DEBUG] Failed to cleanup local files: ${err.message}`);
            }
        }
        
        return uploadedFiles;
        
    } catch (err) {
        logger.error(`[AUDIO DEBUG] Failed to upload debug audio to S3 for ${callId}: ${err.message}`, err);
        return [];
    }
}

/**
 * Call this when a call ends to upload debug audio
 */
async handleCallEnd(callId) {
    try {
        // Upload debug audio if it exists
        const conn = this.connections.get(callId);
        if (conn?._debugFilesInitialized) {
            logger.info(`[AUDIO DEBUG] Call ended, uploading debug audio for ${callId}...`);
            const uploadedFiles = await this.uploadDebugAudioToS3(callId);
            
            // You could also save these URLs to your database
            if (uploadedFiles.length > 0 && conn.conversationId) {
                // Example: Update conversation record with debug audio URLs
                // await Conversation.update(
                //     { debugAudioUrls: uploadedFiles },
                //     { where: { id: conn.conversationId } }
                // );
            }
        }
    } catch (err) {
        logger.error(`[AUDIO DEBUG] Error handling call end for ${callId}: ${err.message}`);
    }
}

// Alternative: Simple version without ffmpeg (uploads raw files)
async uploadRawDebugAudioToS3(callId) {
    const S3Service = require('./s3.service');
    
    try {
        const callAudioDir = path.join(DEBUG_AUDIO_LOCAL_DIR, callId);
        const uploadedFiles = [];
        
        // Just upload the two main continuous files
        const files = [
            { name: 'continuous_from_asterisk_ulaw.ulaw', desc: 'Caller to OpenAI (uLaw)' },
            { name: 'continuous_from_openai_pcm24k.raw', desc: 'OpenAI to Caller (PCM 24kHz)' }
        ];
        
        for (const file of files) {
            const filepath = path.join(callAudioDir, file.name);
            if (fs.existsSync(filepath) && fs.statSync(filepath).size > 0) {
                const fileContent = fs.readFileSync(filepath);
                const s3Key = `debug-audio/${callId}/${file.name}`;
                
                await S3Service.uploadFile(fileContent, s3Key, 'application/octet-stream');
                const url = await S3Service.getPresignedUrl(s3Key, 3600);
                
                uploadedFiles.push({ key: s3Key, url, description: file.desc });
                logger.info(`[AUDIO DEBUG] Uploaded ${s3Key}`);
            }
        }
        
        return uploadedFiles;
        
    } catch (err) {
        logger.error(`[AUDIO DEBUG] Failed to upload raw audio to S3: ${err.message}`);
        return [];
    }
}

/**
 * Updated sendAudioChunk with debugging
 */
async sendAudioChunkDebug(callId, audioChunkBase64ULaw, bypassBuffering = false) {
    if (!audioChunkBase64ULaw || audioChunkBase64ULaw.length === 0) {
        logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): Empty base64 uLaw chunk. Skipping.`);
        return;
    }

    const conn = this.connections.get(callId);
    if (!conn) {
        logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): No connection. Skipping.`);
        return;
    }

    // Initialize files on first audio from Asterisk if needed
    if (!conn._debugFilesInitialized) {
        this.initializeContinuousDebugFiles(callId);
        conn._debugFilesInitialized = true;
    }

    conn.audioChunksReceived++;

    if (!bypassBuffering && (!conn.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN)) {
        if (conn.status !== 'closed' && conn.status !== 'error_terminal') {
            const pending = this.pendingAudio.get(callId) || [];
            if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
                pending.push(audioChunkBase64ULaw);
                this.pendingAudio.set(callId, pending);
            } else {
                logger.warn(`[OpenAI Realtime] Audio buffer full for ${callId}. Dropping uLaw chunk.`);
            }
        }
        return;
    }

    try {
        // STAGE 1: Decode base64 uLaw from Asterisk
        const ulawBuffer = Buffer.from(audioChunkBase64ULaw, 'base64');
        if (!ulawBuffer || ulawBuffer.length === 0) {
            logger.warn(`[AUDIO DEBUG] Decoded uLaw buffer empty`);
            return;
        }

        // Append RAW uLaw from Asterisk
        await this.appendToContinuousDebugFile(callId, 'continuous_from_asterisk_ulaw.ulaw', ulawBuffer);

        // STAGE 2: Convert uLaw to PCM 8kHz
        const pcm8khzBuffer = await AudioUtils.convertUlawToPcm(ulawBuffer);
        if (!pcm8khzBuffer || pcm8khzBuffer.length === 0) {
            logger.error(`[AUDIO DEBUG] uLaw to PCM conversion FAILED`);
            return;
        }

        // Append PCM 8kHz
        await this.appendToContinuousDebugFile(callId, 'continuous_from_asterisk_pcm8k.raw', pcm8khzBuffer);

        // STAGE 3: Resample PCM from 8kHz to 24kHz
        const pcm24khzBuffer = AudioUtils.resamplePcm(pcm8khzBuffer, CONSTANTS.ASTERISK_SAMPLE_RATE, CONSTANTS.DEFAULT_SAMPLE_RATE);
        if (!pcm24khzBuffer || pcm24khzBuffer.length === 0) {
            logger.error(`[AUDIO DEBUG] Resampling FAILED`);
            return;
        }

        // Append PCM 24kHz
        await this.appendToContinuousDebugFile(callId, 'continuous_from_asterisk_pcm24k.raw', pcm24khzBuffer);

        // Also append to the existing output_for_openai.pcm file
        await this.appendAudioToLocalFile(callId, pcm24khzBuffer);
        
        // STAGE 4: Convert to base64 for OpenAI
        const pcm24khzBase64ToSend = pcm24khzBuffer.toString('base64');
        if (!pcm24khzBase64ToSend) {
            logger.error(`[AUDIO DEBUG] Base64 encoding FAILED`);
            return;
        }

        // Log progress every 100 chunks
        if (conn.audioChunksReceived % 100 === 0) {
            logger.info(`[AUDIO DEBUG] Processed ${conn.audioChunksReceived} chunks from Asterisk for ${callId}`);
        }

        await this.sendJsonMessage(callId, {
            type: 'input_audio_buffer.append',
            audio: pcm24khzBase64ToSend
        });

        conn.audioChunksSent++;
        if (conn.audioChunksSent > 0 && conn.audioChunksSent % CONSTANTS.AUDIO_BATCH_SIZE === 0) {
            this.debounceCommit(callId);
        }

    } catch (audioProcessingError) {
        logger.error(`[OpenAI Realtime] sendAudioChunk (${callId}): Audio processing error: ${audioProcessingError.message}`, audioProcessingError.stack);
        return;
    }
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
                                input_audio_format: 'pcm16',
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

    /**
 * Helper to test audio conversion chain independently
 */
async testAudioConversionChain() {
    logger.info(`[AUDIO DEBUG] Testing audio conversion chain...`);
    
    try {
        // Create a test tone (1kHz sine wave at 8kHz sample rate, 100ms duration)
        const sampleRate = 8000;
        const duration = 0.1; // 100ms
        const frequency = 1000; // 1kHz
        const numSamples = Math.floor(sampleRate * duration);
        
        // Create PCM buffer with sine wave
        const pcmBuffer = Buffer.alloc(numSamples * 2);
        for (let i = 0; i < numSamples; i++) {
            const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16383; // Half amplitude
            pcmBuffer.writeInt16LE(Math.round(sample), i * 2);
        }
        
        logger.info(`[AUDIO DEBUG] Created test PCM: ${pcmBuffer.length} bytes, ${numSamples} samples`);
        
        // Test PCM to uLaw
        const ulawBase64 = await AudioUtils.convertPcmToUlaw(pcmBuffer);
        const ulawBuffer = Buffer.from(ulawBase64, 'base64');
        logger.info(`[AUDIO DEBUG] PCM → uLaw: ${ulawBuffer.length} bytes`);
        
        // Test uLaw back to PCM
        const pcmBackBuffer = await AudioUtils.convertUlawToPcm(ulawBuffer);
        logger.info(`[AUDIO DEBUG] uLaw → PCM: ${pcmBackBuffer.length} bytes`);
        
        // Test resampling up
        const pcm24khz = AudioUtils.resamplePcm(pcmBuffer, 8000, 24000);
        logger.info(`[AUDIO DEBUG] Resample 8k→24k: ${pcm24khz.length} bytes`);
        
        // Test resampling down
        const pcm8khzAgain = AudioUtils.resamplePcm(pcm24khz, 24000, 8000);
        logger.info(`[AUDIO DEBUG] Resample 24k→8k: ${pcm8khzAgain.length} bytes`);
        
        // Save test files
        await this.saveDebugAudio('TEST', 'test_original_pcm_8khz', pcmBuffer, 'pcm16', 8000);
        await this.saveDebugAudio('TEST', 'test_ulaw', ulawBuffer, 'ulaw', 8000);
        await this.saveDebugAudio('TEST', 'test_pcm_back_from_ulaw', pcmBackBuffer, 'pcm16', 8000);
        await this.saveDebugAudio('TEST', 'test_resampled_24khz', pcm24khz, 'pcm16', 24000);
        await this.saveDebugAudio('TEST', 'test_resampled_back_8khz', pcm8khzAgain, 'pcm16', 8000);
        
        logger.info(`[AUDIO DEBUG] Audio conversion chain test complete. Check TEST directory for files.`);
        
    } catch (err) {
        logger.error(`[AUDIO DEBUG] Audio conversion test failed: ${err.message}`, err);
    }
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