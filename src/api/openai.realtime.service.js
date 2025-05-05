const WebSocket = require('ws');
const stream = require('stream');
const prism = require('prism-media');
const { Buffer } = require('buffer');
const config = require('../config/config');
const logger = require('../config/logger');
const { Message } = require('../models');

// Import the audio utilities module (extracted helper functions)
const AudioUtils = require('./audio.utils');

/**
 * Constants for configuration
 */
const CONSTANTS = {
    MAX_PENDING_CHUNKS: 100, // Maximum number of audio chunks to buffer
    RECONNECT_MAX_ATTEMPTS: 5, // Maximum number of reconnection attempts
    RECONNECT_BASE_DELAY: 1000, // Base delay for exponential backoff (milliseconds)
    COMMIT_DEBOUNCE_DELAY: 300, // Debounce delay for commit messages (milliseconds)
    CONNECTION_TIMEOUT: 10000, // WebSocket connection timeout (milliseconds)
    DEFAULT_SAMPLE_RATE: 8000, // Default sample rate for audio processing
};

/**
 * Manages connections to OpenAI's realtime API
 * Handles audio transcoding, message tracking, and connection lifecycle
 */
class OpenAIRealtimeService {
    constructor() {
        // Connection tracking maps
        this.connections = new Map(); // asteriskChannelId -> connection state object
        this.pendingAudio = new Map(); // asteriskChannelId -> array of base64 uLaw audio chunks
        this.commitTimers = new Map(); // asteriskChannelId -> debounce timers for input_audio_buffer.commit
        this.isReconnecting = new Map(); // asteriskChannelId -> boolean 
        this.reconnectAttempts = new Map(); // asteriskChannelId -> number of reconnect attempts
        this.connectionTimeouts = new Map(); // asteriskChannelId -> connection timeout

        // Notification callback for external services (like ari.client.js)
        this.notifyCallback = null;
        
        // Log at info level for service initialization
        logger.info('[OpenAI Realtime] Service initialized');
    }

    /**
     * Calculate backoff delay for reconnection attempts
     * @param {number} attempt - Current attempt number
     * @returns {number} - Delay in milliseconds
     */
    calculateBackoffDelay(attempt) {
        // Exponential backoff with jitter
        const expBackoff = Math.min(
            CONSTANTS.RECONNECT_BASE_DELAY * Math.pow(2, attempt),
            30000 // Max 30 second delay
        );
        // Add random jitter (±20%)
        const jitter = expBackoff * 0.2 * (Math.random() * 2 - 1);
        return Math.floor(expBackoff + jitter);
    }

    /**
     * Set the callback function for notifying other services about events
     * @param {Function} callback - Function taking (asteriskChannelId, eventType, data)
     */
    setNotificationCallback(callback) {
        this.notifyCallback = callback;
        logger.info('[OpenAI Realtime] Notification callback registered');
    }

    /**
     * Notify subscribed services about events
     * @param {string} asteriskChannelId - The call identifier (Asterisk Channel ID)
     * @param {string} eventType - The type of event ('audio_chunk', 'text_message', 'openai_error', etc.)
     * @param {Object} data - Event data payload
     */
    notify(asteriskChannelId, eventType, data = {}) {
        if (this.notifyCallback) {
            try {
                this.notifyCallback(asteriskChannelId, eventType, data);
            } catch (err) {
                logger.error(`[OpenAI Realtime] Error in notification callback for ${asteriskChannelId}/${eventType}: ${err.message}`);
            }
        } else {
            // Only log as debug to avoid filling logs
            logger.debug(`[OpenAI Realtime] No notification callback set to notify for ${eventType}`);
        }
    }

    /**
     * Initialize a connection to OpenAI for a call
     * @param {string} asteriskChannelId - The call identifier (Using Asterisk Channel ID)
     * @param {string} callSid - The call identifier for the carrier
     * @param {string|null} conversationId - Database ID for this conversation (can be null)
     * @param {string} initialPrompt - System prompt for the AI
     * @returns {Promise<boolean>} - Success indicator
     */
    async initialize(asteriskChannelId, callSid, conversationId, initialPrompt) {
        if (this.connections.has(asteriskChannelId)) {
            logger.warn(`[OpenAI Realtime] Connection attempt for already existing asteriskChannelId: ${asteriskChannelId}. Current status: ${this.connections.get(asteriskChannelId).status}`);
            // Return if connection is already in a good state
            return this.connections.get(asteriskChannelId).status !== 'error' && 
                   this.connections.get(asteriskChannelId).status !== 'closed';
        }

        logger.info(`[OpenAI Realtime] Initializing for asteriskChannelId: ${asteriskChannelId}`);

        // Create tracking object
        this.connections.set(asteriskChannelId, {
            status: 'initializing',
            conversationId,
            callSid,
            webSocket: null,
            sessionReady: false,
            startTime: Date.now(),
            initialPrompt: initialPrompt,
            lastActivity: Date.now()
        });

        // Reset reconnection attempt counter
        this.reconnectAttempts.set(asteriskChannelId, 0);
        this.isReconnecting.set(asteriskChannelId, false);

        // Connect to OpenAI
        try {
            await this.connect(asteriskChannelId, callSid, conversationId, initialPrompt, this.connections.get(asteriskChannelId)?.sessionId);

            return true;
        } catch (err) {
            logger.error(`[OpenAI Realtime] Initialization failed during connect for ${asteriskChannelId}: ${err.message}`);
            this.cleanup(asteriskChannelId); // Clean up if connect fails immediately
            return false;
        }
    }

    /**
     * Attempt to reconnect to OpenAI after a disconnection
     * @param {string} asteriskChannelId - The call identifier
     * @param {string} callSid - The call SID
     * @param {string|null} conversationId - Database ID for conversation
     * @param {string} initialPrompt - System prompt for the AI
     */
    async attemptReconnect(asteriskChannelId, callSid, conversationId, initialPrompt) {
        if (!this.isReconnecting.get(asteriskChannelId)) {
            logger.info(`[OpenAI Realtime] Skipping reconnect for ${asteriskChannelId} - not in reconnecting state`);
            return;
        }

        const attempts = this.reconnectAttempts.get(asteriskChannelId) || 0;
        if (attempts >= CONSTANTS.RECONNECT_MAX_ATTEMPTS) {
            logger.error(`[OpenAI Realtime] Max reconnection attempts (${CONSTANTS.RECONNECT_MAX_ATTEMPTS}) reached for ${asteriskChannelId}`);
            this.isReconnecting.set(asteriskChannelId, false);
            this.notify(asteriskChannelId, 'openai_max_reconnect_failed', { attempts });
            return;
        }

        logger.info(`[OpenAI Realtime] Attempting reconnect #${attempts + 1} for ${asteriskChannelId}`);
        this.reconnectAttempts.set(asteriskChannelId, attempts + 1);

        // Update connection state for reconnection
        if (this.connections.has(asteriskChannelId)) {
            this.updateConnectionStatus(asteriskChannelId, 'reconnecting');
        } else {
            // If connection was completely cleaned up, reinitialize
            this.connections.set(asteriskChannelId, {
                status: 'reconnecting',
                conversationId,
                callSid,
                webSocket: null,
                sessionReady: false,
                startTime: Date.now(),
                initialPrompt: initialPrompt,
                lastActivity: Date.now()
            });
        }

        try {
            await this.connect(asteriskChannelId, callSid, conversationId, initialPrompt);
            this.isReconnecting.set(asteriskChannelId, false);
            logger.info(`[OpenAI Realtime] Reconnect #${attempts + 1} successful for ${asteriskChannelId}`);
            this.notify(asteriskChannelId, 'openai_reconnected', { attempts: attempts + 1 });
        } catch (err) {
            logger.error(`[OpenAI Realtime] Reconnect #${attempts + 1} failed for ${asteriskChannelId}: ${err.message}`);
            
            // Schedule another reconnect attempt with exponential backoff
            const delay = this.calculateBackoffDelay(attempts + 1);
            logger.info(`[OpenAI Realtime] Will retry connection for ${asteriskChannelId} in ${delay}ms`);
            
            setTimeout(() => {
                this.attemptReconnect(asteriskChannelId, callSid, conversationId, initialPrompt);
            }, delay);
        }
    }

    /**
     * Create and configure WebSocket connection to OpenAI
     * @param {string} asteriskChannelId - The Asterisk channel identifier
     * @param {string} callSid - The call identifier
     * @param {string|null} conversationId - Database ID for conversation
     * @param {string} initialPrompt - System prompt for the AI
     */
    async connect(asteriskChannelId, callSid, conversationId, initialPrompt, resumeSessionId = null) {
        // Get model and voice from config
        const model = config.openai.realtimeModel || 'gpt-4o-realtime-preview-2024-12-17';
        const voice = config.openai.realtimeVoice || 'alloy';
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;

        logger.info(`[OpenAI Realtime] Connecting to ${wsUrl} for asteriskChannelId: ${asteriskChannelId}`);

        let connectionState = this.connections.get(asteriskChannelId);
        if (!connectionState) {
            logger.error(`[OpenAI Realtime] Connection state missing during connect for ${asteriskChannelId}! Cannot proceed.`);
            throw new Error('Connection state missing');
        }
        
        if (connectionState.status === 'connected' || connectionState.status === 'connecting') {
            logger.warn(`[OpenAI Realtime] Connect called for ${asteriskChannelId} but already connecting/connected. Aborting duplicate.`);
            return;
        }
        
        connectionState.status = 'connecting';
        connectionState.lastActivity = Date.now();

        try {
            // Set up connection timeout
            const connectionTimeout = setTimeout(() => {
                if (this.connections.has(asteriskChannelId)) {
                    const conn = this.connections.get(asteriskChannelId);
                    if (conn.status === 'connecting' && conn.webSocket) {
                        logger.error(`[OpenAI Realtime] Connection timeout for ${asteriskChannelId}`);
                        conn.webSocket.terminate();
                        this.updateConnectionStatus(asteriskChannelId, 'error');
                        this.notify(asteriskChannelId, 'openai_connection_timeout', {});
                    }
                }
                if (this.connectionTimeouts.has(asteriskChannelId)) {
                    this.connectionTimeouts.delete(asteriskChannelId);
                }
            }, CONSTANTS.CONNECTION_TIMEOUT);
            
            this.connectionTimeouts.set(asteriskChannelId, connectionTimeout);

            const ws = new WebSocket(wsUrl, {
                headers: {
                    Authorization: `Bearer ${config.openai.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1',
                },
            });

            connectionState.webSocket = ws;

            // --- WebSocket Event Handlers ---
            ws.on('open', () => {
                // Clear connection timeout
                if (this.connectionTimeouts.has(asteriskChannelId)) {
                    clearTimeout(this.connectionTimeouts.get(asteriskChannelId));
                    this.connectionTimeouts.delete(asteriskChannelId);
                }
                
                logger.info(`[OpenAI Realtime] WebSocket opened for connection: ${asteriskChannelId}`);
                this.updateConnectionStatus(asteriskChannelId, 'connected');
                // Configuration is sent upon receiving 'session.created' message
            });

            ws.on('message', async (data) => {
                // Only log first part of message to avoid huge logs
                if (logger.isLevelEnabled('debug')) {
                    logger.debug(`[OpenAI Realtime] Raw message received for ${asteriskChannelId}: ${data.toString().substring(0, 100)}...`);
                }
                await this.handleOpenAIMessage(asteriskChannelId, data);
            });

            ws.on('error', (error) => {
                logger.error(`[OpenAI Realtime] WebSocket error for ${asteriskChannelId}: ${error.message}`);
                this.notify(asteriskChannelId, 'openai_error', { message: error.message || 'WebSocket error' });
                
                if (this.connections.has(asteriskChannelId)) {
                    this.updateConnectionStatus(asteriskChannelId, 'error');
                }
                // The 'close' event usually follows 'error', let it handle cleanup/retry
            });

            ws.on('close', async (code, reason) => {
                // Clear connection timeout if it exists
                if (this.connectionTimeouts.has(asteriskChannelId)) {
                    clearTimeout(this.connectionTimeouts.get(asteriskChannelId));
                    this.connectionTimeouts.delete(asteriskChannelId);
                }
                
                const reasonStr = reason ? reason.toString() : 'No reason provided';
                logger.info(`[OpenAI Realtime] WebSocket closed for ${asteriskChannelId}. Code: ${code}, Reason: ${reasonStr}`);
                this.notify(asteriskChannelId, 'openai_closed', { code, reason: reasonStr });
                
                if (this.connections.has(asteriskChannelId)) {
                    this.updateConnectionStatus(asteriskChannelId, 'closed');
                
                    // Implement reconnection logic for abnormal closures
                    if (code !== 1000 && !this.isReconnecting.get(asteriskChannelId)) {
                        const conn = this.connections.get(asteriskChannelId);
                        // Store vital info before cleaning up
                        const savedCallSid = conn.callSid;
                        const savedConvId = conn.conversationId;
                        const savedPrompt = conn.initialPrompt;
                        
                        this.isReconnecting.set(asteriskChannelId, true);
                        
                        // Clean up the current connection
                        this.cleanup(asteriskChannelId, false); // Don't clear reconnect flags
                        
                        // Attempt reconnect with backoff
                        const attempts = this.reconnectAttempts.get(asteriskChannelId) || 0;
                        const delay = this.calculateBackoffDelay(attempts);
                        
                        logger.info(`[OpenAI Realtime] Will attempt reconnect for ${asteriskChannelId} in ${delay}ms (attempt #${attempts + 1})`);
                        
                        setTimeout(() => {
                            this.attemptReconnect(asteriskChannelId, savedCallSid, savedConvId, savedPrompt);
                        }, delay);
                    } else {
                        // Normal closure or already reconnecting - do regular cleanup
                        this.cleanup(asteriskChannelId);
                    }
                }
            });
            // --- End WebSocket Event Handlers ---

            logger.info(`[OpenAI Realtime] WebSocket client created and handlers attached for ${asteriskChannelId}`);

        } catch (err) {
            // Clear connection timeout if it exists
            if (this.connectionTimeouts.has(asteriskChannelId)) {
                clearTimeout(this.connectionTimeouts.get(asteriskChannelId));
                this.connectionTimeouts.delete(asteriskChannelId);
            }
            
            logger.error(`[OpenAI Realtime] Error initiating WebSocket connection for ${asteriskChannelId}: ${err.message}`);
            if (this.connections.has(asteriskChannelId)) {
                this.updateConnectionStatus(asteriskChannelId, 'error');
                this.cleanup(asteriskChannelId); // Clean up state on connection initiation error
            }
            throw err; // Re-throw error to be caught by initialize
        }
    }

    /**
     * Update the connection status, ensuring state object exists
     * @param {string} asteriskChannelId - The call identifier
     * @param {string} status - New connection status
     */
    updateConnectionStatus(asteriskChannelId, status) {
        const conn = this.connections.get(asteriskChannelId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] Attempted to update status for non-existent/cleaned connection ${asteriskChannelId} to ${status}`);
            return;
        }
        
        const oldStatus = conn.status;
        if (oldStatus === status) return;

        conn.status = status;
        conn.lastActivity = Date.now();
        logger.info(`[OpenAI Realtime] Connection ${asteriskChannelId} status changed: ${oldStatus} -> ${status}`);
    }

    /**
     * Process messages received from the OpenAI WebSocket
     * @param {string} asteriskChannelId - The call identifier
     * @param {Buffer|string} data - Raw message data
     */
    async handleOpenAIMessage(asteriskChannelId, data) {
        let message;
        try {
            message = JSON.parse(data);
        } catch (err) {
            logger.error(`[OpenAI Realtime] Failed to parse JSON message for ${asteriskChannelId}: ${err.message}. Data: ${data.toString().substring(0, 100)}...`);
            return;
        }

        const conn = this.connections.get(asteriskChannelId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] Received message for unknown/cleaned connection: ${asteriskChannelId}. Type: ${message.type}`);
            return;
        }
        
        // Update last activity timestamp
        conn.lastActivity = Date.now();
        
        try {
            switch (message.type) {
                case 'session.created':
                    logger.info(`[OpenAI Realtime] Session created for ${asteriskChannelId}`);
                    
                    conn.sessionId = message.session.id;
                    // Send session configuration now that session exists
                    const sessionConfig = {
                        type: 'session.update',
                        session: {
                            instructions: conn.initialPrompt || "You are Bianca, a helpful AI assistant.",
                            voice: config.openai.realtimeVoice || 'alloy',
                            output_audio_format: config.openai.outputAudioFormat || 'pcm16',
                            // Add other configurable parameters from config
                            ...(config.openai.realtimeSessionConfig || {})
                        },
                    };
                    
                    logger.info(`[OpenAI Realtime] Sending session.update for ${asteriskChannelId}`);
                    if (logger.isLevelEnabled('debug')) {
                        logger.debug(`[OpenAI Realtime] Session config: ${JSON.stringify(sessionConfig)}`);
                    }
                    
                    await this.sendJsonMessage(asteriskChannelId, sessionConfig);

                    // Send initial user message to prompt AI's greeting
                    logger.info(`[OpenAI Realtime] Sending initial user message to trigger greeting for ${asteriskChannelId}`);
                    const initialUserMessage = {
                        type: 'conversation.item.create',
                        item: { 
                            type: 'message', 
                            role: 'user', 
                            content: [{ type: 'input_text', text: 'Hello, are you there?' }] 
                        },
                    };
                    await this.sendJsonMessage(asteriskChannelId, initialUserMessage);

                    conn.sessionReady = true; // Mark session ready AFTER sending config/prompt
                    await this.flushPendingAudio(asteriskChannelId); // Send any buffered audio
                    this.notify(asteriskChannelId, 'openai_session_ready', {}); // Notify ARI client session is ready
                    break;

                case 'response.content_part.added':
                    if (message.content_part.content_type === 'audio') {
                        if (logger.isLevelEnabled('debug')) {
                            logger.debug(`[OpenAI Realtime] Received audio content part for ${asteriskChannelId}, size: ${message.content_part.data ? message.content_part.data.length : 0}`);
                        }
                        await this.processAudioResponse(asteriskChannelId, message.content_part.data); // data is base64 pcm
                    } else if (message.content_part.content_type === 'text') {
                        if (logger.isLevelEnabled('debug')) {
                            logger.debug(`[OpenAI Realtime] Received text content part for ${asteriskChannelId}: ${message.content_part.text?.substring(0, 50) || ''}`);
                        }
                        // Text parts often accompany audio or are intermediates, usually handled by conversation.item.created
                    } else {
                        logger.debug(`[OpenAI Realtime] Received unhandled content part type: ${message.content_part.content_type} for ${asteriskChannelId}`);
                    }
                    break;

                case 'conversation.item.created':
                    logger.debug(`[OpenAI Realtime] Received conversation.item.created for ${asteriskChannelId}`);
                    await this.handleConversationItem(asteriskChannelId, message.item, conn.conversationId);
                    break;

                case 'response.done':
                    logger.info(`[OpenAI Realtime] Assistant response done event for asteriskChannelId: ${asteriskChannelId}`);
                    this.notify(asteriskChannelId, 'response_done', {});
                    break;

                case 'error':
                    logger.error(`[OpenAI Realtime] Error message from OpenAI API for ${asteriskChannelId}: ${message.error.message}`);
                    this.notify(asteriskChannelId, 'openai_error', { 
                        message: message.error.message,
                        code: message.error.code,
                        type: message.error.type
                    });
                    // Depending on severity, might want to disconnect or just log
                    break;

                case 'session.updated':
                    logger.info(`[OpenAI Realtime] Session updated event for ${asteriskChannelId}`);
                    if (logger.isLevelEnabled('debug')) {
                        logger.debug(`[OpenAI Realtime] Session update details: ${JSON.stringify(message.session)}`);
                    }
                    break;

                case 'session.expired':
                    logger.warn(`[OpenAI Realtime] Session expired for ${asteriskChannelId}`);
                    this.notify(asteriskChannelId, 'openai_session_expired', {});
                    // Consider reconnecting here
                    break;

                default:
                    logger.debug(`[OpenAI Realtime] Unhandled message type received for ${asteriskChannelId}: ${message.type}`);
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error processing message content for ${asteriskChannelId} (type: ${message?.type}): ${err.message}`);
            if(err.stack) logger.error(`[OpenAI Realtime] Processing Error Stack: ${err.stack}`);
            
            // For critical errors, consider notifying
            this.notify(asteriskChannelId, 'openai_message_processing_error', { 
                messageType: message?.type,
                error: err.message
            });
        }
    }

    /**
     * Process an audio response from OpenAI (PCM16 Base64) and notify ARI (uLaw Base64)
     * @param {string} asteriskChannelId - The call identifier
     * @param {string} audioBase64PCM - Base64 encoded PCM audio data
     */
    async processAudioResponse(asteriskChannelId, audioBase64PCM) {
        logger.info(`[OpenAI Realtime] Received audio from OpenAI for ${asteriskChannelId}, raw base64 length: ${audioBase64PCM.length}`);

        if (!audioBase64PCM) {
            logger.warn(`[OpenAI Realtime] processAudioResponse called with empty audio for ${asteriskChannelId}`);
            return;
        }
        
        try {
            const inputBuffer = Buffer.from(audioBase64PCM, 'base64');
            if (inputBuffer.length === 0) {
                logger.warn(`[OpenAI Realtime] Decoded PCM buffer is empty for ${asteriskChannelId}`);
                return;
            }

            // Get sample rate from config or default
            const sampleRate = config.openai.outputSampleRate || CONSTANTS.DEFAULT_SAMPLE_RATE;
            
            // Use the extracted utility for audio conversion
            const ulawBase64 = await AudioUtils.convertPcmToUlaw(inputBuffer, sampleRate);
            
            if (ulawBase64 && ulawBase64.length > 0) {
                logger.debug(`[OpenAI Realtime] Transcoded PCM to uLaw for ${asteriskChannelId}, uLaw size: ${ulawBase64.length}`);
                this.notify(asteriskChannelId, 'audio_chunk', { audio: ulawBase64 }); // Send uLaw to ARI handler
            } else {
                logger.warn(`[OpenAI Realtime] No uLaw data generated after transcoding for ${asteriskChannelId}`);
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error processing audio response for ${asteriskChannelId}: ${err.message}`);
            if(err.stack) logger.error(`[OpenAI Realtime] Processing Error Stack: ${err.stack}`);
        }
    }

    /**
     * Handle conversation items (messages, function calls) from OpenAI
     * @param {string} asteriskChannelId - The call identifier
     * @param {Object} item - Conversation item from OpenAI
     * @param {string|null} conversationId - Database ID for the conversation (can be null)
     */
    async handleConversationItem(asteriskChannelId, item, conversationId) {
        if (!item) return;

        try {
            if (item.type === 'message' /*&& (item.role === 'assistant' || item.role === 'user')*/) {
                const contentArray = item.content || [];
                const contentText = contentArray
                    .map(part => (part && (part.type === 'input_text' || part.type === 'text') ? part.text : ''))
                    .join('');

                logger.info(`[OpenAI Realtime] ${item.role} message text for ${asteriskChannelId} (status: ${item.status || 'N/A'}): "${contentText.substring(0, 50)}..."`);

                // Save completed messages to database if possible and text exists
                if (conversationId && contentText && item.status === 'completed') {
                    try {
                        // Use a try-catch block for the database operation
                        const dbMessage = new Message({ 
                            role: item.role, 
                            content: contentText, 
                            conversationId 
                        });
                        await dbMessage.save();
                        logger.debug(`[OpenAI Realtime] Saved completed message to DB for ${asteriskChannelId}/${conversationId}`);
                    } catch (dbErr) {
                        logger.error(`[OpenAI Realtime] Failed to save message to DB for ${asteriskChannelId}/${conversationId}: ${dbErr.message}`);
                    }
                }

                if (item.audio?.data && item.audio.data.length > 0) {
                    logger.info(`[OpenAI Realtime] Received audio in conversation.item.created for ${asteriskChannelId}, size: ${item.audio.data.length}`);
                    await this.processAudioResponse(asteriskChannelId, item.audio.data);
                } else {
                    logger.debug(`[OpenAI Realtime] Skipping audio playback for ${asteriskChannelId} — no audio data.`);
                }
                
                // Notify about text message content
                if (contentText && item.status === 'completed') {
                    this.notify(asteriskChannelId, 'text_message', { 
                        role: item.role, 
                        content: contentText 
                    });
                }

            } else if (item.type === 'function_call') {
                logger.info(`[OpenAI Realtime] Function call received for ${asteriskChannelId}: ${item.function_call ? item.function_call.name : 'N/A'}`);
                this.notify(asteriskChannelId, 'function_call', { call: item.function_call });
                
                // TODO: Implement function call handling
                // Need logic here to execute the function and send back a function_call_response
            } else {
                logger.debug(`[OpenAI Realtime] Unhandled conversation item type: ${item.type} for ${asteriskChannelId}`);
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error handling conversation item for ${asteriskChannelId}: ${err.message}`);
            if(err.stack) logger.error(`[OpenAI Realtime] Conversation Item Error Stack: ${err.stack}`);
        }
    }

    /**
     * Send a JSON message to OpenAI WebSocket
     * @param {string} asteriskChannelId - The call identifier
     * @param {Object} messageObj - Message object to send
     * @returns {Promise<boolean>} - Success indicator
     */
    async sendJsonMessage(asteriskChannelId, messageObj) {
        const conn = this.connections.get(asteriskChannelId);
        if (!conn || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
            logger.warn(`[OpenAI Realtime] Cannot send JSON - invalid WS state for ${asteriskChannelId}. Status: ${conn?.status}, ReadyState: ${conn?.webSocket?.readyState}`);
            return false;
        }
        
        try {
            const messageStr = JSON.stringify(messageObj);
            if (logger.isLevelEnabled('debug')) {
                // Only log part of the message to avoid huge logs
                logger.debug(`[OpenAI Realtime] Sending JSON type ${messageObj.type}: ${messageStr.substring(0, 100)}...`);
            }
            conn.webSocket.send(messageStr);
            conn.lastActivity = Date.now(); // Update last activity timestamp
            return true;
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error sending JSON message to ${asteriskChannelId}: ${err.message}`);
            return false;
        }
    }

    /**
     * Flush any pending audio chunks for a call (sent when session is ready)
     * @param {string} asteriskChannelId - The call identifier
     */
    async flushPendingAudio(asteriskChannelId) {
        const chunks = this.pendingAudio.get(asteriskChannelId);
        if (!chunks || chunks.length === 0) {
            logger.debug(`[OpenAI Realtime] No pending audio to flush for ${asteriskChannelId}`);
            return;
        }
        
        logger.info(`[OpenAI Realtime] Flushing ${chunks.length} pending audio chunks for ${asteriskChannelId}`);
        
        // Process chunks in batches to avoid overwhelming the connection
        const BATCH_SIZE = 5;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const sendPromises = batch.map(chunk => this.sendAudioChunk(asteriskChannelId, chunk));
            
            try {
                await Promise.all(sendPromises);
                logger.debug(`[OpenAI Realtime] Processed batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(chunks.length/BATCH_SIZE)} for ${asteriskChannelId}`);
            } catch (err) {
                logger.error(`[OpenAI Realtime] Error occurred during batch processing for ${asteriskChannelId}: ${err.message}`);
                // Continue with next batch despite errors
            }
            
            // Small delay between batches to avoid overwhelming the connection
            if (i + BATCH_SIZE < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        logger.info(`[OpenAI Realtime] Finished flushing all pending audio for ${asteriskChannelId}`);
        this.pendingAudio.delete(asteriskChannelId);
    }

    /**
     * Debounce audio commits to avoid sending too many commit messages
     * @param {string} asteriskChannelId - The call identifier
     */
    debounceCommit(asteriskChannelId) {
        if (this.commitTimers.has(asteriskChannelId)) {
            clearTimeout(this.commitTimers.get(asteriskChannelId));
        }
        
        const conn = this.connections.get(asteriskChannelId);
        if (!conn || !conn.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
            logger.debug(`[OpenAI Realtime] Skipping debounceCommit, connection/session not ready for ${asteriskChannelId}`);
            return;
        }
        
        const timer = setTimeout(async () => {
            // Check connection again *before* sending, in case it closed during timeout
            const currentConn = this.connections.get(asteriskChannelId);
            if (currentConn && currentConn.webSocket && currentConn.webSocket.readyState === WebSocket.OPEN) {
                await this.sendJsonMessage(asteriskChannelId, { type: 'input_audio_buffer.commit' });
            } else {
                logger.warn(`[OpenAI Realtime] Skipped sending debounced commit, connection closed or missing for ${asteriskChannelId}`);
            }
            this.commitTimers.delete(asteriskChannelId);
        }, CONSTANTS.COMMIT_DEBOUNCE_DELAY);
        
        this.commitTimers.set(asteriskChannelId, timer);
    }

    /**
     * Send an audio chunk received from Asterisk (uLaw Base64) to OpenAI (as PCM Base64)
     * @param {string} asteriskChannelId - The call identifier (Asterisk Channel ID)
     * @param {string} audioChunkBase64 - Base64 encoded audio chunk (uLaw format expected)
     */
    async sendAudioChunk(asteriskChannelId, audioChunkBase64) {
        if (!audioChunkBase64 || typeof audioChunkBase64 !== 'string' || audioChunkBase64.trim() === '') {
            logger.warn(`[OpenAI Realtime] Skipping empty audio chunk for ${asteriskChannelId}`);
            return;
        }

        const conn = this.connections.get(asteriskChannelId);
        // Buffer if session isn't ready yet
        if (!conn || !conn.sessionReady) {
            logger.debug(`[OpenAI Realtime] Buffering audio chunk for ${asteriskChannelId} (sessionReady: ${conn?.sessionReady})`);
            
            // Create buffer if it doesn't exist
            if (!this.pendingAudio.has(asteriskChannelId)) {
                this.pendingAudio.set(asteriskChannelId, []);
            }
            
            const pendingChunks = this.pendingAudio.get(asteriskChannelId);
            
            // Check buffer size limit
            if (pendingChunks.length >= CONSTANTS.MAX_PENDING_CHUNKS) {
                // Remove oldest chunks if buffer is full (FIFO)
                const overflow = pendingChunks.length - CONSTANTS.MAX_PENDING_CHUNKS + 1;
                pendingChunks.splice(0, overflow);
                logger.warn(`[OpenAI Realtime] Dropped ${overflow} oldest audio chunk(s) due to buffer limit for ${asteriskChannelId}`);
            }
            
            // Add new chunk to buffer
            pendingChunks.push(audioChunkBase64);
            return;
        }

        // If connected and ready, process and send
        if (conn.webSocket && conn.webSocket.readyState === WebSocket.OPEN) {
            try {
                // Get input sample rate from config or default
                const inputSampleRate = config.openai.inputSampleRate || CONSTANTS.DEFAULT_SAMPLE_RATE;
                
                // Use the extracted utility for audio conversion
                const pcmBase64 = await AudioUtils.convertUlawToPcm(audioChunkBase64, inputSampleRate);

                if (pcmBase64 && pcmBase64.length > 0) {
                    logger.debug(`[OpenAI Realtime] Sending PCM chunk to OpenAI for ${asteriskChannelId}, PCM size: ${pcmBase64.length}`);
                    
                    // Update last activity timestamp
                    conn.lastActivity = Date.now();
                    
                    const success = await this.sendJsonMessage(asteriskChannelId, { 
                        type: 'input_audio_buffer.append', 
                        audio: pcmBase64 
                    });
                    
                    if (success) {
                        this.debounceCommit(asteriskChannelId);
                    }
                } else {
                    logger.warn(`[OpenAI Realtime] PCM conversion resulted in empty data for ${asteriskChannelId}, not sending.`);
                }
            } catch (err) {
                logger.error(`[OpenAI Realtime] Error processing/sending audio chunk for ${asteriskChannelId}: ${err.message}`);
                if (err.stack) logger.error(`[OpenAI Realtime] Audio Chunk Error Stack: ${err.stack}`);
            }
        } else {
            logger.warn(`[OpenAI Realtime] Cannot send audio chunk - WebSocket not open or connection missing for ${asteriskChannelId}. State: ${conn?.webSocket?.readyState}`);
            
            // If WebSocket closed but we thought session was ready, buffer the chunk for potential reconnect
            if (conn && conn.status !== 'closed' && conn.status !== 'error') {
                if (!this.pendingAudio.has(asteriskChannelId)) {
                    this.pendingAudio.set(asteriskChannelId, []);
                }
                this.pendingAudio.get(asteriskChannelId).push(audioChunkBase64);
                logger.debug(`[OpenAI Realtime] Re-buffered audio chunk for ${asteriskChannelId} due to WebSocket state`);
            }
        }
    }

    /**
     * Send a text message to OpenAI
     * @param {string} asteriskChannelId - The call identifier
     * @param {string} text - Text message to send
     * @param {string} role - 'user' or 'function_call_response'
     * @param {Object} metadata - e.g., { functionCallId: '...' }
     */
    async sendTextMessage(asteriskChannelId, text, role = 'user', metadata = {}) {
        if (!text || typeof text !== 'string') {
            logger.warn(`[OpenAI Realtime] Skipping empty text message for ${asteriskChannelId}`);
            return;
        }
        
        try {
            let item;
            if (role === 'function_call_response') {
                if (!metadata.functionCallId) {
                    logger.error(`[OpenAI Realtime] Missing functionCallId in metadata for function_call_response on ${asteriskChannelId}`);
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
                    role: 'user', 
                    content: [{ type: 'input_text', text }] 
                };
            }
            
            const success = await this.sendJsonMessage(asteriskChannelId, { 
                type: 'conversation.item.create', 
                item 
            });
            
            if (success) {
                logger.info(`[OpenAI Realtime] Sent ${role} text message for ${asteriskChannelId}: ${text.substring(0, 50)}...`);
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error sending text message for ${asteriskChannelId}: ${err.message}`);
        }
    }

    /**
     * Start a periodic connection health check to detect and clean up stale connections
     * @param {number} interval - Check interval in milliseconds
     */
    startHealthCheck(interval = 60000) {
        // Clear any existing interval
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
        }
        
        this._healthCheckInterval = setInterval(() => {
            const now = Date.now();
            const idleTimeout = config.openai.idleTimeout || 300000; // 5 minutes default
            
            // Check each connection for inactivity
            for (const [asteriskChannelId, conn] of this.connections.entries()) {
                if (!conn.lastActivity) continue;
                
                const idleTime = now - conn.lastActivity;
                if (idleTime > idleTimeout) {
                    logger.warn(`[OpenAI Realtime] Connection ${asteriskChannelId} has been idle for ${Math.floor(idleTime/1000)}s, exceeding threshold of ${Math.floor(idleTimeout/1000)}s. Cleaning up.`);
                    this.disconnect(asteriskChannelId);
                }
            }
        }, interval);
        
        logger.info(`[OpenAI Realtime] Started health check with interval ${interval}ms`);
    }

    /**
     * Stop the health check interval
     */
    stopHealthCheck() {
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = null;
            logger.info(`[OpenAI Realtime] Stopped health check`);
        }
    }

    /**
     * Disconnect from OpenAI and clean up resources for a specific call
     * @param {string} asteriskChannelId - The call identifier (Asterisk Channel ID)
     */
    async disconnect(asteriskChannelId) {
        const conn = this.connections.get(asteriskChannelId);
        if (!conn) {
            logger.warn(`[OpenAI Realtime] Disconnect called for non-existent or already cleaned connection: ${asteriskChannelId}`);
            return;
        }
        
        logger.info(`[OpenAI Realtime] Disconnecting asteriskChannelId: ${asteriskChannelId} (Current status: ${conn.status})`);
        
        try {
            if (conn.webSocket) {
                // Attempt to close gracefully first, but terminate quickly if needed
                if (conn.webSocket.readyState === WebSocket.OPEN) {
                    logger.info(`[OpenAI Realtime] Sending close frame to WebSocket for ${asteriskChannelId}`);
                    conn.webSocket.close(1000, "Client initiated disconnect");
                    
                    // Set a timeout to force termination if close doesn't complete
                    setTimeout(() => {
                        if (this.connections.has(asteriskChannelId) && 
                            this.connections.get(asteriskChannelId).webSocket) {
                            logger.warn(`[OpenAI Realtime] Forcing WebSocket termination for ${asteriskChannelId}`);
                            this.connections.get(asteriskChannelId).webSocket.terminate();
                        }
                    }, 3000);
                } else if (conn.webSocket.readyState === WebSocket.CONNECTING) {
                    logger.info(`[OpenAI Realtime] Terminating connecting WebSocket for ${asteriskChannelId}`);
                    conn.webSocket.terminate();
                }
                
                // Clean up listeners immediately after initiating close/terminate
                conn.webSocket.removeAllListeners();
            }
        } catch (err) {
            logger.error(`[OpenAI Realtime] Error closing/terminating WebSocket for ${asteriskChannelId}: ${err.message}`);
        }
        
        // Perform cleanup regardless of WS state, as the 'close' event might not fire
        this.cleanup(asteriskChannelId);
    }

    /**
     * Clean up internal state for a call (timers, maps)
     * @param {string} asteriskChannelId - The call identifier
     * @param {boolean} clearReconnectFlags - Whether to clear reconnection flags
     */
    cleanup(asteriskChannelId, clearReconnectFlags = true) {
        // Clear connection timeout if it exists
        if (this.connectionTimeouts.has(asteriskChannelId)) {
            clearTimeout(this.connectionTimeouts.get(asteriskChannelId));
            this.connectionTimeouts.delete(asteriskChannelId);
            logger.debug(`[OpenAI Realtime] Cleared connection timeout during cleanup for ${asteriskChannelId}`);
        }
        
        // Clear commit timer if it exists
        if (this.commitTimers.has(asteriskChannelId)) {
            clearTimeout(this.commitTimers.get(asteriskChannelId));
            this.commitTimers.delete(asteriskChannelId);
            logger.debug(`[OpenAI Realtime] Cleared commit timer during cleanup for ${asteriskChannelId}`);
        }
        
        // Clear pending audio buffer if it exists
        if (this.pendingAudio.has(asteriskChannelId)) {
            this.pendingAudio.delete(asteriskChannelId);
            logger.debug(`[OpenAI Realtime] Cleared pending audio buffer during cleanup for ${asteriskChannelId}`);
        }
        
        // Remove main connection state
        const deletedConn = this.connections.delete(asteriskChannelId);
        if (deletedConn) {
            logger.info(`[OpenAI Realtime] Cleaned up resources for asteriskChannelId: ${asteriskChannelId}. Connection state removed.`);
        } else {
            logger.debug(`[OpenAI Realtime] Cleanup called for ${asteriskChannelId}, but connection state already removed.`);
        }
        
        // Reset reconnect flags if requested
        if (clearReconnectFlags) {
            this.isReconnecting.delete(asteriskChannelId);
            this.reconnectAttempts.delete(asteriskChannelId);
            logger.debug(`[OpenAI Realtime] Cleared reconnection flags for ${asteriskChannelId}`);
        }
    }

    /**
     * Disconnect all active connections and clean up resources
     */
    async disconnectAll() {
        logger.info(`[OpenAI Realtime] Disconnecting all connections (count: ${this.connections.size})`);
        
        // Clone the keys to avoid iterator invalidation during disconnect
        const activeConnections = [...this.connections.keys()];
        
        const disconnectPromises = activeConnections.map(asteriskChannelId => {
            return this.disconnect(asteriskChannelId).catch(err => {
                logger.error(`[OpenAI Realtime] Error disconnecting ${asteriskChannelId}: ${err.message}`);
                // Continue with other disconnections despite errors
                return null;
            });
        });
        
        await Promise.all(disconnectPromises);
        
        // Stop health check
        this.stopHealthCheck();
        
        logger.info(`[OpenAI Realtime] All connections disconnected`);
    }
}

// Create and export a singleton instance
const openAIRealtimeService = new OpenAIRealtimeService();

// Start health check on init
openAIRealtimeService.startHealthCheck();

module.exports = openAIRealtimeService;