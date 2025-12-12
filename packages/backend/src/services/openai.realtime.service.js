// src/services/openai.realtime.service.js

/**
 * MESSAGE FLOW ARCHITECTURE:
 * 
 * This service handles real-time conversation between users and AI assistant.
 * The key challenge is ensuring messages are saved in the correct chronological order.
 * 
 * MESSAGE SAVING STRATEGY:
 * 1. ACCUMULATE: Both user and AI messages are accumulated in memory (not saved immediately)
 * 2. SAVE WHEN COMPLETE: Messages are only saved when the speaker finishes their turn
 * 3. TIMESTAMP CONSISTENCY: All messages get timestamps when saved, not when first generated
 * 
 * USER MESSAGE FLOW:
 * 1. User speaks → Audio transcribed → Accumulated in pendingUserTranscript
 * 2. User stops speaking → input_audio_buffer.speech_stopped event
 * 3. pendingUserTranscript saved to database with timestamp
 * 
 * AI MESSAGE FLOW:
 * 1. AI generates text → response.content_part.added event → Accumulated in pendingAssistantTranscript
 * 2. AI finishes speaking → response.done event
 * 3. pendingAssistantTranscript saved to database with timestamp
 * 
 * FALLBACK MECHANISMS:
 * - Stale transcript cleanup: Messages saved after timeout if speaker doesn't finish cleanly
 * - Call end cleanup: Any remaining messages saved when call ends
 * 
 * This ensures messages appear in conversation in the order speakers actually finished speaking,
 * not in the order text was first generated or transcribed.
 */

const WebSocket = require('ws');
const { Buffer } = require('buffer');
const config = require('../config/config');
const logger = require('../config/logger');
const { Call, Conversation, Message } = require('../models'); // Assuming Message model is used for saving transcripts
const AudioUtils = require('../api/audio.utils'); // Assumes this uses alawmulaw and has resamplePcm
const { emergencyProcessor } = require('./emergencyProcessor.service');
const { getConversationContextWindow } = require('../utils/conversationContextWindow');

// STRANGLER FIG: Import new modular components (backward compatible)
const { CONVERSATION_STATES: NEW_CONVERSATION_STATES, StateMachine } = require('./ai/realtime/state.machine');
const CONSTANTS = require('./ai/realtime/constants');
const ReconnectionManager = require('./ai/realtime/reconnection.manager');
const AudioProcessor = require('./ai/realtime/audio.processor');
const ConnectionManager = require('./ai/realtime/connection.manager');
const MessageHandler = require('./ai/realtime/message.handler');

// STRANGLER FIG: Keep old constants for backward compatibility
// These will be removed once all code is migrated
const CONVERSATION_STATES = NEW_CONVERSATION_STATES;
const STATE_TRANSITIONS = require('./ai/realtime/state.machine').STATE_TRANSITIONS;

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
  logger.error(
    `[OpenAI Realtime] Could not create local debug audio directory ${DEBUG_AUDIO_LOCAL_DIR}: ${dirError.message}`
  );
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
    
    // OPTIMIZATION: Batch commit timer system instead of per-call timers
    this.pendingCommits = new Map(); // callId -> timestamp when commit was requested
    this.globalCommitTimer = null; // Single timer for all commits
    
    // STRANGLER FIG: Use new ReconnectionManager module
    this.reconnectionManager = new ReconnectionManager();
    // Keep old maps for backward compatibility (will delegate to reconnectionManager)
    this.pendingReconnections = this.reconnectionManager.pendingReconnections;
    this.globalReconnectTimer = null; // Managed by reconnectionManager
    
    // STRANGLER FIG: Use new ConnectionManager module
    this.connectionManager = new ConnectionManager();
    // Keep old map for backward compatibility (will delegate to connectionManager)
    this.connectionTimeouts = this.connectionManager.connectionTimeouts;
    
    this.isReconnecting = new Map(); // callId -> boolean
    this.reconnectAttempts = new Map(); // callId -> number
    this._healthCheckInterval = null; // Store interval ID

    this.notifyCallback = null;

    logger.info('[OpenAI Realtime] Service initialized with BATCH COMMIT optimization and STATE MACHINE');
  }

  /**
   * STATE MACHINE METHODS
   * These methods manage conversation state transitions to prevent race conditions
   */

  /**
   * STRANGLER FIG: State machine methods now delegate to modular StateMachine
   * Old methods kept for backward compatibility - they wrap the new module
   */
  
  /**
   * Initialize conversation state for a new call
   */
  initializeConversationState(callId) {
    const conn = this.connections.get(callId);
    if (!conn) return;
    StateMachine.initialize(conn);
  }

  /**
   * Transition to a new conversation state with validation
   */
  transitionState(callId, newState, reason = 'unknown') {
    const conn = this.connections.get(callId);
    if (!conn) {
      logger.error(`[State Machine] Cannot transition state for ${callId} - no connection`);
      return false;
    }
    return StateMachine.transition(conn, newState, reason);
  }

  /**
   * Check if a state transition is allowed
   */
  canTransitionTo(callId, newState) {
    const conn = this.connections.get(callId);
    if (!conn) return false;
    return StateMachine.canTransitionTo(conn, newState);
  }

  /**
   * Get current conversation state
   */
  getConversationState(callId) {
    const conn = this.connections.get(callId);
    return StateMachine.getCurrentState(conn);
  }

  /**
   * Check if we're in a state where AI can respond
   */
  canAIRespond(callId) {
    const conn = this.connections.get(callId);
    if (!conn) return false;
    return StateMachine.canAIRespond(conn);
  }

  /**
   * Check if we're in a state where user can speak
   */
  canUserSpeak(callId) {
    const conn = this.connections.get(callId);
    if (!conn) return false;
    return StateMachine.canUserSpeak(conn);
  }

  /**
   * Check if we're in the grace period after greeting completion
   */
  isInGracePeriod(callId) {
    const conn = this.connections.get(callId);
    if (!conn) return false;
    return StateMachine.isInGracePeriod(conn, CONSTANTS.GRACE_PERIOD_MS);
  }

  /**
   * OPTIMIZATION: Start global commit timer that processes ALL pending commits in batches
   */
  startGlobalCommitTimer() {
    // NO-OP with server VAD
    logger.debug(`[OpenAI Realtime] Manual commit timer disabled - using server VAD`);
}

  /**
   * OPTIMIZATION: Stop global commit timer when no pending commits
   */
  stopGlobalCommitTimer() {
    if (this.globalCommitTimer) {
        clearInterval(this.globalCommitTimer);
        this.globalCommitTimer = null;
    }
    // Don't log as "stopped" - it should never start with VAD
  }

  /**
   * OPTIMIZATION: Process a single commit (extracted from timer logic)
   */
  async processCommit(callId) {
    const conn = this.connections.get(callId);
    
    if (conn?.webSocket?.readyState === WebSocket.OPEN && conn.sessionReady) {
      try {
        await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
        conn.lastCommitTime = Date.now();
        conn.firstSpeechTime = null;
        conn.hasHeardSpeech = false;
        
        logger.info(`[OpenAI Realtime] 🚀 BATCH: Commit sent for ${callId}`);
      } catch (commitErr) {
        logger.error(`[OpenAI Realtime] 🚀 BATCH: Commit failed for ${callId}: ${commitErr.message}`);
        throw commitErr;
      }
    }
  }

  /**
   * STRANGLER FIG: Reconnection methods now delegate to ReconnectionManager
   * Old methods kept for backward compatibility - they wrap the new module
   */
  
  /**
   * OPTIMIZATION: Start global reconnection timer that processes ALL pending reconnections
   */
  startGlobalReconnectTimer() {
    this.reconnectionManager.startGlobalReconnectTimer((callId) => this.attemptReconnect(callId));
    this.globalReconnectTimer = this.reconnectionManager.globalReconnectTimer;
  }

  /**
   * OPTIMIZATION: Stop global reconnect timer when no pending reconnections
   */
  stopGlobalReconnectTimer() {
    this.reconnectionManager.stopGlobalReconnectTimer();
    this.globalReconnectTimer = null;
  }

  /**
   * OPTIMIZATION: Schedule a reconnection attempt using batch system
   */
  scheduleReconnect(callId, delay, attempt = 0) {
    this.reconnectionManager.scheduleReconnect(callId, delay, attempt);
  }

  /**
   * Calculate backoff delay for reconnection attempts
   */
  calculateBackoffDelay(attempt) {
    return this.reconnectionManager.calculateBackoffDelay(attempt);
  }

  /**
   * Create initial silence buffer to prevent static burst
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Base64 encoded silence
   */
  /**
   * STRANGLER FIG: Audio processing methods now delegate to AudioProcessor
   * Old methods kept for backward compatibility - they wrap the new module
   */
  
  createInitialSilence(durationMs = CONSTANTS.INITIAL_SILENCE_MS) {
    return AudioProcessor.createInitialSilence(durationMs);
  }

  isAudioSilence(audioBase64) {
    return AudioProcessor.isAudioSilence(audioBase64);
  }

  monitorAudioQuality(callId) {
    const conn = this.connections.get(callId);
    if (!conn) return;
    AudioProcessor.monitorAudioQuality(conn, conn.startTime);
  }

  validateAudioChunk(audioBase64) {
    return AudioProcessor.validateAudioChunk(audioBase64);
  }

  checkCommitReadiness(callId) {
    const conn = this.connections.get(callId);
    if (!conn) {
      return { canCommit: false, reason: 'No connection found' };
    }
    return AudioProcessor.checkCommitReadiness(conn);
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
      logger.error(
        `[OpenAI Realtime] Error in notification callback for CallID ${callId} / Event ${eventType}: ${err.message}`
      );
    }
  }

  async appendAudioToLocalFile(callId, pcmBuffer) {
    const useDebugMode = config.openai?.debugAudio !== false;
    if (!useDebugMode) return;

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
      logger.error(
        `[OpenAI Realtime] Could not create call-specific debug audio directory ${callAudioDir}: ${dirError.message}`
      );
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
  async initialize(initialAsteriskChannelId, callSid, conversationId, initialPrompt, patientId = null) {
    const callId = callSid || initialAsteriskChannelId; // Prefer callSid if available
    if (!callId) {
      logger.error('[OpenAI Realtime] Initialize: Critical - Missing call identifier.');
      return false;
    }
    if (this.connections.has(callId)) {
      const existingConn = this.connections.get(callId);
      logger.warn(
        `[OpenAI Realtime] Initialize: Connection already exists for callId: ${callId}. Status: ${existingConn.status}`
      );
      // Allow re-initialization if in a recoverable state, or just return true if already good
      return existingConn.status !== 'error' && existingConn.status !== 'closed';
    }

    logger.info(`[OpenAI Realtime] Initializing for callId: ${callId} (Initial Asterisk ID: ${initialAsteriskChannelId})`);
    logger.info(`[OpenAI Realtime] Initial prompt: "${initialPrompt?.substring(0, 100)}..."`);
    if (patientId) {
      logger.info(`[OpenAI Realtime] Emergency detection enabled for patient: ${patientId}`);
    }

    // Ensure Conversation exists (for outbound calls, it might not exist yet)
    let finalConversationId = conversationId;
    if (!finalConversationId && callSid) {
      try {
        // Find the Call record
        const call = await Call.findOne({ callSid });
        if (call) {
          // Check if Conversation already exists for this call
          let conversation = await Conversation.findOne({ callId: call._id });
          if (!conversation) {
            // Create Conversation when call is answered and conversation starts
            conversation = await Conversation.create({
              callId: call._id,
              patientId: call.patientId,
            });
            
            // Update Call with conversation reference
            call.conversationId = conversation._id;
            await call.save();
            
            logger.info(`[OpenAI Realtime] Created Conversation ${conversation._id} for call ${call._id}`);
          }
          finalConversationId = conversation._id.toString();
        }
      } catch (err) {
        logger.error(`[OpenAI Realtime] Error ensuring Conversation exists: ${err.message}`);
        // Continue with provided conversationId or null
      }
    }

    this.connections.set(callId, {
      status: 'initializing',
      conversationId: finalConversationId,
      callSid, // Store the Twilio CallSid if provided
      asteriskChannelId: initialAsteriskChannelId, // Store the Asterisk channel ID
      patientId, // Store patient ID for emergency detection
      webSocket: null,
      sessionReady: false,
      startTime: Date.now(),
      initialPrompt,
      lastActivity: Date.now(),
      sessionId: null,
      audioChunksReceived: 0, // Track how many chunks we receive
      audioChunksSent: 0, // Track how many chunks we send to OpenAI
      lastCommitTime: 0, // Track when we last committed
      pendingCommit: false, // Track if we have a pending commit
      // Track each speaker independently
      pendingUserTranscript: '',
      pendingAssistantTranscript: '',

      // Add message IDs to track what's currently being spoken
      activeUserMessageId: null,
      activeAssistantMessageId: null,

      // Track timing for each speaker
      lastUserSpeechTime: null,
      lastAssistantSpeechTime: null,
      _userHasSpoken: false, // Track if user has spoken to trigger first response
      _waitingForInitialGreeting: true, // Track if we're waiting for Bianca's initial greeting
      _initialGreetingTriggered: false, // Prevent multiple initial greeting triggers
      _initialGreetingCompletedAt: null, // Track when initial greeting finished (to prevent lingering audio from triggering response)

      // CRITICAL: Speech end detection variables
      lastSpeechTime: null, // When we last heard speech
      hasHeardSpeech: false, // Whether we've heard any speech yet
      firstSpeechTime: null, // When speech started for current utterance

      // State machine properties
      conversationState: null,
      stateHistory: []
    });
    this.reconnectAttempts.set(callId, 0);
    this.isReconnecting.set(callId, false);
    this.pendingAudio.set(callId, []); // Initialize buffer

    // Initialize conversation state
    this.initializeConversationState(callId);

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
   * STRANGLER FIG: Connection timeout methods now delegate to ConnectionManager
   */
  
  /**
   * Clear connection timeout
   */
  clearConnectionTimeout(callId) {
    this.connectionManager.clearConnectionTimeout(callId);
  }

  /**
   * Set connection timeout with unified handling
   */
  setConnectionTimeout(callId, duration = CONSTANTS.CONNECTION_TIMEOUT) {
    this.connectionManager.setConnectionTimeout(callId, duration, (callId) => {
      const conn = this.connections.get(callId);
      if (conn && !conn.sessionReady) {
        logger.error(`[OpenAI Realtime] Connection timeout for ${callId} after ${duration}ms`);
        this.handleConnectionTimeout(callId);
      }
    });
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
      this.scheduleReconnect(callId, delay, 0);
    }
  }

  /**
   * STRANGLER FIG: Connection methods now delegate to ConnectionManager
   */
  
  /**
   * Attach all WebSocket event handlers immediately after creation
   */
  attachWebSocketHandlers(ws, callId) {
    ConnectionManager.attachWebSocketHandlers(ws, callId, {
      onOpen: (callId) => this.handleOpen(callId),
      onMessage: (callId, data) => this.handleMessage(callId, data),
      onError: (callId, error) => this.handleError(callId, error),
      onClose: (callId, code, reason) => this.handleClose(callId, code, reason),
    });
  }

  isConnectionReady(callId) {
    const connection = this.connections.get(callId);
    return ConnectionManager.isConnectionReady(connection);
  }

  /**
   * Send response.create to trigger OpenAI to generate responses - ENHANCED with diagnostics
   */
  async sendResponseCreate(callId) {
    logger.info(`[OpenAI Realtime] DEBUG: sendResponseCreate called for ${callId}`);
    const connection = this.connections.get(callId);
    if (!connection) {
      logger.error(`[OpenAI Realtime] CRITICAL: Cannot send response.create - no connection object for ${callId}`);
      return;
    }

    if (!connection.webSocket) {
      logger.error(`[OpenAI Realtime] CRITICAL: Cannot send response.create - no WebSocket for ${callId}`);
      return;
    }

    if (connection.webSocket.readyState !== WebSocket.OPEN) {
      logger.error(`[OpenAI Realtime] CRITICAL: Cannot send response.create - WebSocket not open for ${callId} (state: ${connection.webSocket.readyState})`);
      return;
    }

    if (!connection.sessionReady) {
      logger.error(`[OpenAI Realtime] CRITICAL: Cannot send response.create - session not ready for ${callId}`);
      return;
    }

    // STATE MACHINE: Check if we can create a response in current state
    if (!this.canAIRespond(callId)) {
      const currentState = this.getConversationState(callId);
      logger.warn(`[OpenAI Realtime] Cannot create response in state ${currentState} for ${callId}`);
      return;
    }

    try {
      const responseCreateEvent = {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
        },
      };

      const messageStr = JSON.stringify(responseCreateEvent);
      connection.webSocket.send(messageStr);
      // Don't set _responseCreated for initial greeting - allow commits
      connection._responseStartTime = Date.now(); // Track when response was created
      logger.info(`[OpenAI Realtime] SUCCESS: Sent response.create for ${callId}`);
      logger.debug(`[OpenAI Realtime] Response.create payload: ${messageStr}`);

      // STATE MACHINE: Transition to appropriate state based on current state
      const currentState = this.getConversationState(callId);
      if (currentState === CONVERSATION_STATES.WAITING_FOR_GREETING) {
        this.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'initial_greeting_triggered');
      } else if (currentState === CONVERSATION_STATES.GREETING_COMPLETE || currentState === CONVERSATION_STATES.CONVERSATION_ACTIVE) {
        this.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'ai_response_triggered');
      }

      // Add timeout to reset response flag if it gets stuck
      setTimeout(() => {
        const currentConn = this.connections.get(callId);
        if (currentConn && currentConn._responseCreated && currentConn._responseStartTime === connection._responseStartTime) {
          logger.warn(`[OpenAI Realtime] Response timeout for ${callId} - resetting response flag after 10 seconds`);
          currentConn._responseCreated = false;
          currentConn._responseStartTime = null;

          // Force a new response generation after timeout
          setTimeout(async () => {
            try {
              // Check grace period to prevent dual responses after initial greeting
              const currentConn = this.connections.get(callId);
              if (currentConn) {
                const timeSinceGreeting = currentConn._initialGreetingCompletedAt 
                  ? Date.now() - currentConn._initialGreetingCompletedAt 
                  : Infinity;
                const GRACE_PERIOD_MS = 3000; // 3 seconds to clear lingering audio from connection/transfer

                if (timeSinceGreeting < GRACE_PERIOD_MS) {
                  logger.info(
                    `[OpenAI Realtime] Skipping timeout recovery for ${callId} - in grace period ` +
                    `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${GRACE_PERIOD_MS}ms)`
                  );
                  return;
                }
              }
              
              logger.info(`[OpenAI Realtime] Attempting to generate new response after timeout for ${callId}`);
              await this.sendResponseCreate(callId);
            } catch (err) {
              logger.error(`[OpenAI Realtime] Failed to generate new response after timeout for ${callId}: ${err.message}`);
            }
          }, 1000);
        }
      }, 20000); // 20 second timeout

      // Add a more aggressive timeout check every 5 seconds
      const aggressiveTimeout = setInterval(() => {
        const currentConn = this.connections.get(callId);
        if (currentConn && currentConn._responseCreated && currentConn._responseStartTime) {
          const responseAge = Date.now() - currentConn._responseStartTime;
          if (responseAge > 30000) { // 30 seconds
            logger.warn(`[OpenAI Realtime] Aggressive timeout for ${callId} - response stuck for ${responseAge}ms, forcing reset`);
            currentConn._responseCreated = false;
            currentConn._responseStartTime = null;
            clearInterval(aggressiveTimeout);

            // Force a new response generation
            setTimeout(async () => {
              try {
                // Check grace period to prevent dual responses after initial greeting
                const currentConn = this.connections.get(callId);
                if (currentConn) {
                  const timeSinceGreeting = currentConn._initialGreetingCompletedAt 
                    ? Date.now() - currentConn._initialGreetingCompletedAt 
                    : Infinity;
                  const GRACE_PERIOD_MS = 3000; // 3 seconds to clear lingering audio from connection/transfer

                  if (timeSinceGreeting < GRACE_PERIOD_MS) {
                    logger.info(
                      `[OpenAI Realtime] Skipping aggressive timeout recovery for ${callId} - in grace period ` +
                      `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${GRACE_PERIOD_MS}ms)`
                    );
                    return;
                  }
                }
                
                logger.info(`[OpenAI Realtime] Attempting to generate new response after aggressive timeout for ${callId}`);
                await this.sendResponseCreate(callId);
              } catch (err) {
                logger.error(`[OpenAI Realtime] Failed to generate new response after aggressive timeout for ${callId}: ${err.message}`);
              }
            }, 1000);
          }
        } else {
          clearInterval(aggressiveTimeout);
        }
      }, 5000);

      // Log diagnostic info
      logger.info(`[OpenAI Realtime] Connection state for ${callId}:`, {
        sessionReady: connection.sessionReady,
        audioChunksReceived: connection.audioChunksReceived,
        audioChunksSent: connection.audioChunksSent,
        validAudioChunksSent: connection.validAudioChunksSent,
        pendingCommit: connection.pendingCommit
      });
    } catch (err) {
      logger.error(`[OpenAI Realtime] CRITICAL: Error sending response.create for ${callId}: ${err.message}`);
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
      await this.handleOpenAIMessageInternal(callId, data);
    } catch (err) {
      logger.error(`[OpenAI Realtime] Error in handleMessage for ${callId}: ${err.message}`, err);
      // Don't let message handling errors crash the entire connection
      // Just log and continue
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
      this.scheduleReconnect(callId, delay, this.reconnectAttempts.get(callId) || 0);
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

    // STRANGLER FIG: Use ConnectionManager to create connection
    // Clear any existing timeout before creating a new connection
    this.clearConnectionTimeout(callId);

    try {
      // Create WebSocket using ConnectionManager
      const ws = ConnectionManager.createConnection(
        connectionState,
        callId,
        (ws, callId) => this.attachWebSocketHandlers(ws, callId)
      );

      // Set a single timeout for the entire connection + handshake process
      this.setConnectionTimeout(callId);
    } catch (err) {
      logger.error(`[OpenAI Realtime] CRITICAL: Error creating WebSocket for ${callId}: ${err.message}`, err);
      this.handleConnectionError(callId, err);
      throw err;
    }
  }

  /**
   * STRANGLER FIG: Handle connection errors - uses ReconnectionManager for error classification
   */
  handleConnectionError(callId, error) {
    this.clearConnectionTimeout(callId);
    this.updateConnectionStatus(callId, 'error');

    // Use ReconnectionManager to classify error
    const { shouldReconnect, recoveryAction } = this.reconnectionManager.classifyError(error);
    const errorMessage = error.message || error.toString();

    this.notify(callId, 'openai_connection_error', {
      error: errorMessage,
      recoveryAction,
      shouldReconnect
    });

    if (shouldReconnect && !this.isReconnecting.get(callId)) {
      this.isReconnecting.set(callId, true);
      const attempts = this.reconnectAttempts.get(callId) || 0;
      const delay = this.calculateBackoffDelay(attempts);
      logger.info(`[OpenAI Realtime] Will attempt ${recoveryAction} for ${callId} in ${delay}ms`);
      this.scheduleReconnect(callId, delay, attempts);
    } else if (!shouldReconnect) {
      logger.error(`[OpenAI Realtime] Non-recoverable error for ${callId}, cleaning up`);
      this.cleanup(callId);
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

    // Store pending audio before resetting state
    const pendingAudio = this.pendingAudio.get(callId) || [];
    const hadPendingAudio = pendingAudio.length > 0;

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

      // ENHANCED RECOVERY: Flush any buffered audio after successful reconnection
      if (hadPendingAudio) {
        logger.info(`[OpenAI Realtime] Flushing ${pendingAudio.length} buffered audio chunks after reconnection for ${callId}`);
        setTimeout(async () => {
          try {
            await this.flushPendingAudio(callId);
            // After flushing, automatically trigger response generation if we have audio
            const currentConn = this.connections.get(callId);
            if (currentConn && currentConn.validAudioChunksSent > 0) {
              // Check grace period to prevent dual responses after initial greeting
              const timeSinceGreeting = currentConn._initialGreetingCompletedAt 
                ? Date.now() - currentConn._initialGreetingCompletedAt 
                : Infinity;
              const GRACE_PERIOD_MS = 3000; // 3 seconds to clear lingering audio from connection/transfer

              if (timeSinceGreeting < GRACE_PERIOD_MS) {
                logger.info(
                  `[OpenAI Realtime] Skipping reconnection recovery for ${callId} - in grace period ` +
                  `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${GRACE_PERIOD_MS}ms)`
                );
              } else {
                logger.info(`[OpenAI Realtime] Auto-triggering response generation after recovery for ${callId}`);
                await this.sendResponseCreate(callId);
              }
            }
          } catch (flushErr) {
            logger.error(`[OpenAI Realtime] Error flushing audio after reconnection for ${callId}: ${flushErr.message}`);
          }
        }, 1000); // Small delay to ensure session is fully ready
      }

    } catch (err) {
      logger.error(`[OpenAI Realtime] Reconnect #${attempts + 1} failed for ${callId}: ${err.message}`);
      const delay = this.calculateBackoffDelay(attempts + 1);
      logger.info(`[OpenAI Realtime] Will retry connection for ${callId} in ${delay}ms`);
      this.scheduleReconnect(callId, delay, attempts + 1);
    }
  }

  /**
   * STRANGLER FIG: Connection status and health methods now delegate to ConnectionManager
   */
  
  /**
   * Update connection status safely
   */
  updateConnectionStatus(callId, status) {
    const conn = this.connections.get(callId);
    if (!conn) {
      logger.warn(`[OpenAI Realtime] UpdateStatus: Attempted to update non-existent connection ${callId} to ${status}`);
      return;
    }
    ConnectionManager.updateConnectionStatus(conn, status);
  }

  /**
   * Validate connection health with enhanced monitoring
   */
  async checkConnectionHealth(callId) {
    const conn = this.connections.get(callId);
    if (!conn) return false;
    return ConnectionManager.checkConnectionHealth(conn, (error) => {
      this.handleConnectionError(callId, error);
    });
  }

  async handleSessionCreated(callId, message) {
    const conn = this.connections.get(callId);
    if (!conn) return;

    logger.info(`[OpenAI Realtime] Session CREATED for ${callId}, Session ID: ${message.session.id}`);
    conn.sessionId = message.session.id;

    // CRITICAL: Add turn detection to prevent AI from talking over user
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: conn.initialPrompt || 'You are Bianca, a helpful AI assistant. Always respond in English.',
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

    logger.info(`[OpenAI Realtime] Sending session.update with turn detection for ${callId}`);
    logger.debug(`[OpenAI Realtime] Session config: ${JSON.stringify(sessionConfig.session, null, 2)}`);

    try {
      await this.sendJsonMessage(callId, sessionConfig);
      logger.info(`[OpenAI Realtime] Session.update with turn detection sent successfully for ${callId}`);
    } catch (sendError) {
      logger.error(`[OpenAI Realtime] Failed to send session.update for ${callId}: ${sendError.message}`);
      this.cleanup(callId);
    }
  }

  // 3. COMPLETE handleOpenAIMessage method with turn detection
  // Replace the entire handleOpenAIMessage method in openai.realtime.service.js:

  async handleOpenAIMessage(callId, data) {
    if (!this.connections.has(callId)) {
      logger.warn(`[OpenAI Realtime] Received message for cleaned up callId ${callId}. Discarding.`);
      return;
    }

    try {
      await this.handleOpenAIMessageInternal(callId, data);
    } catch (err) {
      logger.error(`[OpenAI Realtime] Error in handleMessage for ${callId}: ${err.message}`, err);
    }
  }

  /**
   * STRANGLER FIG: Message handling now uses MessageHandler for parsing
   */
  
  async handleOpenAIMessageInternal(callId, data) {
    // Use MessageHandler to parse message
    const message = MessageHandler.parseMessage(data);
    if (!message) {
      logger.error(`[OpenAI Realtime] Failed to parse message for ${callId}`);
      return;
    }

    const conn = this.connections.get(callId);
    if (!conn) {
      logger.warn(`[OpenAI Realtime] Received message for non-existent connection ${callId}. Discarding.`);
      return;
    }
    conn.lastActivity = Date.now();

    // Log all message types for debugging
    logger.info(`[OpenAI Realtime] RECEIVED from OpenAI (${callId}): type=${message.type}`);

    // Enhanced debugging for response-related messages
    if (message.type.startsWith('response.')) {
      logger.debug(`[OpenAI Realtime] Full response message for ${callId}: ${JSON.stringify(message)}`);
    }

    try {
      switch (message.type) {
        case 'session.created':
          await this.handleSessionCreated(callId, message);
          break;

        case 'session.updated':
          await this.handleSessionUpdated(callId, message);
          break;

        case 'response.content_part.added':
          // STRANGLER FIG: Use MessageHandler for content part processing
          MessageHandler.handleContentPartAdded(
            conn,
            message,
            (text, sessionId) => {
              this.notify(callId, 'openai_text_delta', {
                text,
                sessionId
              });
            },
            (audioBase64) => this.processAudioResponse(callId, audioBase64)
          );
          break;

        case 'response.audio.delta':
          // Track that AI is speaking
          if (conn && !conn._aiIsSpeaking) {
            conn._aiIsSpeaking = true;
            conn._lastAiSpeechStart = Date.now();
            logger.info(`[OpenAI Realtime] AI STARTED SPEAKING for ${callId}`);
            
            // CRITICAL: Only create placeholder if user is NOT currently speaking
            // If user is speaking, defer placeholder creation until user finishes
            // This ensures user's message gets finalized first (gets earlier _id), then AI placeholder is created
            if (!conn._userIsSpeaking) {
              // User is not speaking - create AI placeholder now
              await this.createPlaceholderAssistantMessage(callId);
            } else {
              // User is still speaking - defer AI placeholder creation
              // It will be created when user finishes speaking (in speech_stopped handler)
              logger.info(`[OpenAI Realtime] AI started speaking but user is still speaking - deferring placeholder creation for ${callId}`);
              conn._pendingAiPlaceholder = true;
            }
          }

          // STRANGLER FIG: Use MessageHandler for audio delta processing
          MessageHandler.handleResponseAudioDelta(
            conn,
            message,
            (audioBase64) => this.processAudioResponse(callId, audioBase64)
          );
          break;

        case 'conversation.item.created':
          await this.handleConversationItemCreated(callId, message);
          break;

        case 'response.done':
          logger.info(`[OpenAI Realtime] AI FINISHED SPEAKING for ${callId}`);
          await this.handleResponseDone(callId);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          await this.handleInputAudioTranscriptionCompleted(callId, message);
          break;

        case 'response.audio_transcript.delta':
          // STRANGLER FIG: Use MessageHandler for audio transcript delta
          MessageHandler.handleResponseAudioTranscriptDelta(conn, message);
          break;

        case 'response.audio_transcript.done':
          // STRANGLER FIG: Use MessageHandler for audio transcript done
          MessageHandler.handleResponseAudioTranscriptDone(conn, message);
          break;

        case 'input_audio_buffer.speech_started':
          logger.info(`[OpenAI Realtime] USER SPEECH STARTED for ${callId}`);

          if (conn) {
            conn._userIsSpeaking = true;
            conn._lastUserSpeechStart = Date.now();

            // STATE MACHINE: Transition to user speaking state
            if (this.canUserSpeak(callId)) {
              this.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
            }

            // Create placeholder message when user starts speaking
            // This ensures the timestamp reflects when user actually started speaking
            await this.createPlaceholderUserMessage(callId);

            // CRITICAL: If AI is currently speaking, we need to interrupt it
            if (conn._aiIsSpeaking) {
              logger.info(`[OpenAI Realtime] USER INTERRUPTING AI - canceling AI response for ${callId}`);
              try {
                // Cancel any ongoing AI response
                await this.sendJsonMessage(callId, { type: 'response.cancel' });
                conn._aiIsSpeaking = false;
                // Transition back to conversation active since AI was interrupted
                this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'ai_response_canceled');
              } catch (err) {
                logger.error(`[OpenAI Realtime] Failed to cancel AI response: ${err.message}`);
              }
            }
          }

          this.notify(callId, 'speech_started', {});
          break;

        case 'input_audio_buffer.speech_stopped':
          logger.info(`[OpenAI Realtime] USER SPEECH STOPPED for ${callId}`);

          if (conn) {
            conn._userIsSpeaking = false;
            conn._lastUserSpeechEnd = Date.now();

            // CRITICAL: Wait a moment for transcription to complete (race condition)
            // The transcript might arrive via input_audio_transcription.completed AFTER speech_stopped
            // So we wait a bit, then check again
            setTimeout(async () => {
              const currentConn = this.connections.get(callId);
              if (!currentConn) return;

              // Save user transcript now that user has finished speaking
              // CRITICAL: We MUST update the existing placeholder (not create new) to preserve queue position
              let userMessageFinalized = false;
              if (currentConn.pendingUserTranscript && currentConn.pendingUserTranscript.trim()) {
                logger.info(`[OpenAI Realtime] Saving user transcript now that user finished speaking: "${currentConn.pendingUserTranscript}"`);
                
                // Update the existing placeholder message if it exists (preserve original _id and position in queue)
                if (currentConn.activeUserMessageId) {
                  try {
                    const { Message } = require('../models');
                    // CRITICAL: Verify the message exists before updating
                    const originalMessage = await Message.findById(currentConn.activeUserMessageId);
                    if (!originalMessage) {
                      throw new Error(`Placeholder message ${currentConn.activeUserMessageId} not found`);
                    }
                    
                    // CRITICAL: Update the EXISTING message - this preserves its _id and position in queue
                    await Message.findByIdAndUpdate(
                      currentConn.activeUserMessageId,
                      { 
                        content: currentConn.pendingUserTranscript.trim(),
                        messageType: 'user_message',
                      },
                      { timestamps: false, runValidators: false } // Disable auto-timestamps
                    );
                    logger.info(`[OpenAI Realtime] Updated placeholder user message ${currentConn.activeUserMessageId} with transcript: "${currentConn.pendingUserTranscript}" (preserved _id and queue position)`);
                    userMessageFinalized = true;
                    currentConn.activeUserMessageId = null; // Clear the active message ID
                  } catch (err) {
                    logger.error(`[OpenAI Realtime] Failed to update placeholder user message: ${err.message}`);
                    // DO NOT create new message - this would break queue order
                    // Instead, log error and keep placeholder as-is
                    logger.error(`[OpenAI Realtime] CRITICAL: Cannot update user placeholder, but not creating new message to preserve queue order`);
                  }
                } else {
                  // No placeholder exists - this shouldn't happen, but create new message as fallback
                  logger.warn(`[OpenAI Realtime] No active user message ID - creating new message (this may break queue order)`);
                  await this.saveCompleteMessage(callId, 'patient', currentConn.pendingUserTranscript);
                  userMessageFinalized = true;
                }
                
                currentConn.pendingUserTranscript = ''; // Clear the pending transcript
              } else if (currentConn.activeUserMessageId) {
                // No transcript yet - DON'T delete placeholder, wait for it
                // The transcript might arrive via input_audio_transcription.completed
                logger.info(`[OpenAI Realtime] User stopped speaking but transcript not ready yet - keeping placeholder ${currentConn.activeUserMessageId} and waiting for transcript`);
                // Set a flag to indicate we're waiting for transcript
                currentConn._waitingForUserTranscript = true;
              }
              
              // CRITICAL: If AI started speaking while user was speaking, create AI placeholder NOW
              // BUT: This must happen AFTER the user's message update is complete
              // Only create if user message was successfully finalized
              if (currentConn._pendingAiPlaceholder && currentConn._aiIsSpeaking && userMessageFinalized) {
                logger.info(`[OpenAI Realtime] User finished speaking and message finalized - now creating deferred AI placeholder for ${callId}`);
                await this.createPlaceholderAssistantMessage(callId);
                currentConn._pendingAiPlaceholder = false;
              } else if (currentConn._pendingAiPlaceholder && currentConn._aiIsSpeaking) {
                logger.warn(`[OpenAI Realtime] AI placeholder deferred but user message not finalized - skipping placeholder creation to preserve queue order`);
              }
            }, 500); // Wait 500ms for transcription to complete

            // STATE MACHINE: Only trigger AI response if we're in the right state
            if (!conn._aiIsSpeaking && this.canAIRespond(callId)) {
              // Check if we're in grace period after initial greeting
              if (this.isInGracePeriod(callId)) {
                const timeSinceGreeting = Date.now() - conn._initialGreetingCompletedAt;
                logger.info(
                  `[OpenAI Realtime] Ignoring speech_stopped for ${callId} - in grace period ` +
                  `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${CONSTANTS.GRACE_PERIOD_MS}ms). ` +
                  `This prevents lingering audio from "hello" or transfer message from triggering response.`
                );
                return; // Don't trigger response - this is likely lingering audio
              }

              // Transition to AI_RESPONDING state
              if (this.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking')) {
                logger.info(`[OpenAI Realtime] User finished speaking - will trigger AI response for ${callId}`);

                // Small delay to ensure audio processing is complete
                setTimeout(async () => {
                  const currentConn = this.connections.get(callId);
                  if (currentConn && this.getConversationState(callId) === CONVERSATION_STATES.AI_RESPONDING) {
                    try {
                      logger.info(`[OpenAI Realtime] DEBUG: About to trigger response for ${callId} - _responseCreated: ${currentConn._responseCreated}, _responseStartTime: ${currentConn._responseStartTime}`);
                      await this.sendResponseCreate(callId);
                      currentConn._aiIsSpeaking = true;
                      logger.info(`[OpenAI Realtime] Triggered AI response after user finished speaking for ${callId}`);
                    } catch (err) {
                      logger.error(`[OpenAI Realtime] Failed to trigger AI response: ${err.message}`);
                      // Revert state on error
                      this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'response_failed');
                    }
                  } else {
                    logger.info(`[OpenAI Realtime] Skipping auto-response trigger for ${callId} - state changed or connection lost`);
                  }
                }, 200);
              } else {
                logger.warn(`[OpenAI Realtime] Cannot transition to AI_RESPONDING state for ${callId}`);
              }
            } else if (conn._aiIsSpeaking) {
              logger.info(`[OpenAI Realtime] User finished speaking but AI is already speaking for ${callId}`);
            } else {
              logger.info(`[OpenAI Realtime] User finished speaking but cannot respond in current state: ${this.getConversationState(callId)}`);
            }
          }

          this.notify(callId, 'speech_stopped', {});
          break;

        case 'input_audio_buffer.committed':
          logger.info(`[OpenAI Realtime] Audio buffer committed successfully for ${callId}`);
          if (conn) {
            conn.pendingCommit = false;
            conn.lastCommitTime = Date.now();
            const chunksProcessed = conn.audioChunksSent || 0;
            const validChunksProcessed = conn.validAudioChunksSent || 0;
            const bytesProcessed = conn.totalAudioBytesSent || 0;
            conn.audioChunksSent = 0;
            conn.validAudioChunksSent = 0;
            conn.totalAudioBytesSent = 0;
            conn.consecutiveBufferErrors = 0;
            logger.info(`[OpenAI Realtime] Reset audio counters for ${callId} after processing ${chunksProcessed} chunks (${validChunksProcessed} valid, ${bytesProcessed} bytes)`);
            
            // Clear the buffer after successful commit to prevent duplicate processing
            try {
              await this.sendJsonMessage(callId, { type: 'input_audio_buffer.clear' });
              logger.info(`[OpenAI Realtime] Cleared audio buffer after commit for ${callId}`);
            } catch (clearErr) {
              logger.warn(`[OpenAI Realtime] Could not clear buffer after commit for ${callId}: ${clearErr.message}`);
            }
          }
          break;

        case 'input_audio_buffer.cleared':
          logger.info(`[OpenAI Realtime] Audio buffer cleared for ${callId}`);
          if (conn) {
            conn._bufferClearedTime = Date.now();
            conn._bufferClearedByOpenAI = true;
            logger.info(`[OpenAI Realtime] Tracked buffer clear time for ${callId}`);
          }
          break;

        case 'input_audio_buffer.appended':
          logger.info(`[OpenAI Realtime] Audio buffer append acknowledged for ${callId}`);
          const connAck = this.connections.get(callId);
          if (connAck) {
            connAck.lastAcknowledgmentTime = Date.now();
            connAck.acknowledgmentCount = (connAck.acknowledgmentCount || 0) + 1;
            logger.debug(`[OpenAI Realtime] Acknowledgment #${connAck.acknowledgmentCount} for ${callId}`);
          }
          break;

        case 'response.created':
          logger.info(`[OpenAI Realtime] Response created for ${callId}`);
          const connResponse = this.connections.get(callId);
          if (connResponse) {
            connResponse._responseCreated = true;
            logger.info(`[OpenAI Realtime] OpenAI acknowledged response.create for ${callId}`);
          }
          break;

        case 'error':
          await this.handleApiError(callId, message);
          break;

        case 'session.expired':
          await this.handleSessionExpired(callId);
          break;

        default:
          logger.info(`[OpenAI Realtime] Unhandled message type ${message.type} for ${callId}`);
          const connMsg = this.connections.get(callId);
          if (connMsg) {
            connMsg.lastMessageTime = Date.now();
            connMsg.messageCount = (connMsg.messageCount || 0) + 1;
            logger.debug(`[OpenAI Realtime] Message #${connMsg.messageCount} received for ${callId}: ${message.type}`);
          }
      }
    } catch (err) {
      logger.error(`[OpenAI Realtime] Error processing message type ${message?.type} for ${callId}: ${err.message}`, err);
      this.notify(callId, 'openai_message_processing_error', { messageType: message?.type, error: err.message });
    }
  }

  /**
   * Handle session.created - Send session.update immediately like test method
   */
  /**
   * STRANGLER FIG: Session handling now uses MessageHandler for config building
   */
  
  async handleSessionCreated(callId, message) {
    const conn = this.connections.get(callId);
    if (!conn) return;

    logger.info(`[OpenAI Realtime] Session CREATED for ${callId}, Session ID: ${message.session.id}`);
    conn.sessionId = message.session.id;

    // Use MessageHandler to build session config
    const sessionConfig = MessageHandler.buildSessionConfig(conn);

    logger.info(`[OpenAI Realtime] Sending session.update with turn detection for ${callId}`);
    logger.debug(`[OpenAI Realtime] Session config: ${JSON.stringify(sessionConfig.session, null, 2)}`);

    try {
      await this.sendJsonMessage(callId, sessionConfig);
      logger.info(`[OpenAI Realtime] Session.update with turn detection sent for ${callId}`);
    } catch (sendError) {
      logger.error(`[OpenAI Realtime] Failed to send session.update: ${sendError.message}`);
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
    logger.debug(`[OpenAI Realtime] Session update response for ${callId}: ${JSON.stringify(message)}`);

    // Track session update timing
    conn.sessionUpdateTime = Date.now();
    logger.info(`[OpenAI Realtime] Session update timestamp for ${callId}: ${new Date().toISOString()}`);

    if (!conn.sessionReady) {
      // Clear the connection timeout since handshake is complete
      this.clearConnectionTimeout(callId);

      conn.sessionReady = true;
      // CRITICAL: Set session setup flag to prevent commits during setup
      conn._sessionSetupInProgress = true;

      // CRITICAL: Clear session setup flag immediately when session is updated
      conn._sessionSetupInProgress = false;
      logger.info(`[OpenAI Realtime] Session setup complete for ${callId} - commits now allowed`);

      // Reset send counters when session becomes ready (but preserve receive tracking)
      // Keep audioChunksReceived and firstAudioReceivedTime to maintain timing info
      conn.audioChunksSent = 0;
      conn.validAudioChunksSent = 0;

      // Flush pending audio to OpenAI (this includes the user's "hello")
      const pendingAudio = this.pendingAudio.get(callId);
      if (pendingAudio && pendingAudio.length > 0) {
        logger.info(`[OpenAI Realtime] Flushing ${pendingAudio.length} pending audio chunks for ${callId} (includes user's initial speech)`);
        logger.info(`[OpenAI Realtime] First chunk size: ${pendingAudio[0]?.length || 0} bytes`);
        await this.flushPendingAudio(callId);
      } else {
        logger.info(`[OpenAI Realtime] No pending audio to flush for ${callId}`);
      }

      logger.info(`[OpenAI Realtime] Audio pipeline ready for ${callId} - waiting for user input`);
      logger.info(`[OpenAI Realtime] Session ready for ${callId}. Triggering initial greeting.`);

      try {
        // Trigger initial greeting immediately - Bianca should say hello first
        logger.info(`[OpenAI Realtime] Session ready for ${callId} - triggering initial greeting`);
        
        // Prevent multiple initial greeting triggers
        if (!conn._initialGreetingTriggered) {
          conn._initialGreetingTriggered = true;
          conn._waitingForInitialGreeting = true;
          
          // STATE MACHINE: Transition to waiting for greeting and trigger initial greeting
          if (this.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready')) {
            await this.sendResponseCreate(callId);
            logger.info(`[OpenAI Realtime] Initial greeting triggered for ${callId}`);
          } else {
            logger.warn(`[OpenAI Realtime] Cannot transition to WAITING_FOR_GREETING state for ${callId}`);
          }
        } else {
          logger.info(`[OpenAI Realtime] Initial greeting already triggered for ${callId}, skipping`);
        }
        
        this.notify(callId, 'openai_session_ready', {});
      } catch (err) {
        logger.error(`[OpenAI Realtime] Error in session setup for ${callId}: ${err.message}`);
        this.cleanup(callId);
      }
    }
  }

  /**
   * STRANGLER FIG: These methods are now handled by MessageHandler in the switch statement
   * Keeping method stubs for backward compatibility (they're called from switch statement)
   */
  
  async handleResponseAudioDelta(callId, message) {
    const conn = this.connections.get(callId);
    MessageHandler.handleResponseAudioDelta(
      conn,
      message,
      (audioBase64) => this.processAudioResponse(callId, audioBase64)
    );
  }

  async handleContentPartAdded(callId, message) {
    const conn = this.connections.get(callId);
    MessageHandler.handleContentPartAdded(
      conn,
      message,
      (text, sessionId) => {
        this.notify(callId, 'openai_text_delta', {
          text,
          sessionId
        });
      },
      (audioBase64) => this.processAudioResponse(callId, audioBase64)
    );
  }

  async handleResponseAudioTranscriptDelta(callId, message) {
    const conn = this.connections.get(callId);
    MessageHandler.handleResponseAudioTranscriptDelta(conn, message);
  }

  async handleResponseAudioTranscriptDone(callId, message) {
    const conn = this.connections.get(callId);
    MessageHandler.handleResponseAudioTranscriptDone(conn, message);
  }

  /**
   * Handle response.done - Save complete assistant response
   * 
   * MESSAGE FLOW LOGIC:
   * 1. This is called when the AI finishes speaking (response.done event)
   * 2. We save any accumulated AI text from pendingAssistantTranscript
   * 3. This ensures AI messages are saved with timestamps reflecting when AI actually finished speaking
   * 4. The message gets a timestamp when it's saved to the database, not when text was first generated
   */
  async handleResponseDone(callId) {
    logger.info(`[OpenAI Realtime] Assistant response done for ${callId}`);

    const conn = this.connections.get(callId);
    if (!conn) {
      this.notify(callId, 'response_done', {});
      return;
    }

    // Save AI transcript now that AI has finished speaking
    if (conn.pendingAssistantTranscript && conn.pendingAssistantTranscript.trim()) {
      logger.info(`[OpenAI Realtime] Saving AI transcript now that AI finished speaking: "${conn.pendingAssistantTranscript}"`);
      
      // Update the existing placeholder message if it exists
      if (conn.activeAssistantMessageId) {
        try {
          const { Message } = require('../models');
          // CRITICAL: Read original timestamp before updating to preserve it
          const originalMessage = await Message.findById(conn.activeAssistantMessageId);
          const originalTimestamp = originalMessage?.createdAt;
          
          await Message.findByIdAndUpdate(
            conn.activeAssistantMessageId,
            { 
              content: conn.pendingAssistantTranscript.trim(),
              messageType: 'assistant_response',
              createdAt: originalTimestamp // Explicitly preserve the original timestamp
            },
            { timestamps: false, runValidators: false } // Disable auto-timestamps
          );
          logger.info(`[OpenAI Realtime] Updated placeholder assistant message with transcript: "${conn.pendingAssistantTranscript}" (preserved timestamp: ${originalTimestamp?.toISOString()})`);
          conn.activeAssistantMessageId = null; // Clear the active message ID
        } catch (err) {
          logger.error(`[OpenAI Realtime] Failed to update placeholder assistant message: ${err.message}`);
          // Fallback: create new message if update fails
          await this.saveCompleteMessage(callId, 'assistant', conn.pendingAssistantTranscript);
        }
      } else {
        // No placeholder exists, create new message
        await this.saveCompleteMessage(callId, 'assistant', conn.pendingAssistantTranscript);
      }
      
      conn.pendingAssistantTranscript = ''; // Clear the pending transcript
    } else if (conn.activeAssistantMessageId) {
      // No transcript but placeholder exists - remove the placeholder
      try {
        const { Message } = require('../models');
        await Message.findByIdAndDelete(conn.activeAssistantMessageId);
        logger.info(`[OpenAI Realtime] Removed placeholder assistant message with no transcript for ${callId}`);
        conn.activeAssistantMessageId = null;
      } catch (err) {
        logger.error(`[OpenAI Realtime] Failed to remove placeholder assistant message: ${err.message}`);
      }
    }

    // Reset response flag so new commits can trigger new responses
    conn._aiIsSpeaking = false;
    conn._responseCreated = false;
    conn._responseStartTime = null; // Clear timeout tracking

    // STATE MACHINE: Transition based on current state
    const currentState = this.getConversationState(callId);
    if (currentState === CONVERSATION_STATES.GREETING_ACTIVE) {
      // Initial greeting completed
      conn._initialGreetingCompletedAt = Date.now();
      conn._waitingForInitialGreeting = false; // Clear the flag to allow user input
      this.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'initial_greeting_completed');
      logger.info(`[OpenAI Realtime] Initial greeting completed for ${callId} - entering grace period and allowing user input`);
    } else if (currentState === CONVERSATION_STATES.AI_RESPONDING) {
      // Regular AI response completed
      this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'ai_response_completed');
      logger.info(`[OpenAI Realtime] AI response completed for ${callId} - ready for user input`);
    }

    logger.info(`[OpenAI Realtime] Reset response flag for ${callId} - ready for new responses`);

    this.notify(callId, 'response_done', {});
  }

  startTranscriptCleanupInterval() {
    if (this._transcriptCleanupInterval) {
      clearInterval(this._transcriptCleanupInterval);
    }

    this._transcriptCleanupInterval = setInterval(async () => {
      const now = Date.now();
      const STALE_THRESHOLD = 5000; // 5 seconds of silence

      for (const [callId, conn] of this.connections.entries()) {
        // Check user transcript independently
        if (conn.pendingUserTranscript && conn.pendingUserTranscript.trim()) {
          const userSilenceTime = now - (conn.lastUserSpeechTime || 0);
          if (userSilenceTime > STALE_THRESHOLD) {
            // Capture the transcript to save
            const transcriptToSave = conn.pendingUserTranscript;
            logger.debug(`[Transcript Cleanup] Saving stale user transcript for ${callId} (silent for ${userSilenceTime}ms)`);

            try {
              // CRITICAL: If there's an active placeholder, UPDATE it instead of creating a new message
              if (conn.activeUserMessageId) {
                logger.info(`[Transcript Cleanup] Updating existing placeholder ${conn.activeUserMessageId} with stale transcript`);
                const { Message } = require('../models');
                await Message.findByIdAndUpdate(
                  conn.activeUserMessageId,
                  { 
                    content: transcriptToSave.trim(),
                    messageType: 'user_message',
                  },
                  { timestamps: false, runValidators: false }
                );
                conn.activeUserMessageId = null;
              } else {
                // No placeholder - create new message (shouldn't happen, but fallback)
                logger.warn(`[Transcript Cleanup] No placeholder exists - creating new message (may break queue order)`);
                await this.saveCompleteMessage(callId, 'patient', transcriptToSave);
              }
              
              // Only clear if it hasn't changed
              if (conn.pendingUserTranscript === transcriptToSave) {
                conn.pendingUserTranscript = '';
                conn.lastUserSpeechTime = null;
              }
            } catch (err) {
              logger.error(`[Transcript Cleanup] Error: ${err.message}`);
            }
          }
        }

        // Check assistant transcript independently
        if (conn.pendingAssistantTranscript && conn.pendingAssistantTranscript.trim()) {
          const assistantSilenceTime = now - (conn.lastAssistantTextTime || 0);
          if (assistantSilenceTime > STALE_THRESHOLD) {
            // Capture the transcript to save
            const transcriptToSave = conn.pendingAssistantTranscript;
            logger.debug(`[Transcript Cleanup] Saving stale assistant transcript for ${callId} (silent for ${assistantSilenceTime}ms)`);

            try {
              await this.saveCompleteMessage(callId, 'assistant', transcriptToSave);
              // Only clear if it hasn't changed
              if (conn.pendingAssistantTranscript === transcriptToSave) {
                conn.pendingAssistantTranscript = '';
                conn.lastAssistantTextTime = null;
              }
            } catch (err) {
              logger.error(`[Transcript Cleanup] Error: ${err.message}`);
            }
          }
        }
      }
    }, 2000); // Check every 2 seconds

    logger.info('[OpenAI Realtime] Started transcript cleanup interval');
  }

  async saveCompleteMessage(callId, role, content) {
    const conn = this.connections.get(callId);
    if (!conn?.conversationId || !content?.trim()) {
      logger.warn(`[OpenAI Realtime] Cannot save ${role} message for ${callId}: conn=${!!conn}, conversationId=${conn?.conversationId}, content="${content}"`);
      return;
    }

    // Track utterance in context window for context-aware emergency detection
    if (conn.patientId) {
      try {
        const contextWindow = getConversationContextWindow();
        const contextRole = role === 'assistant' ? 'assistant' : 'user';
        contextWindow.addUtterance(conn.patientId, content.trim(), contextRole, Date.now());
        logger.debug(`[Context Window] Added ${contextRole} utterance for patient ${conn.patientId}`);
      } catch (error) {
        logger.warn(`[Context Window] Failed to track utterance: ${error.message}`);
      }
    }

    try {
      logger.info(`[OpenAI Realtime] Attempting to save ${role} message for ${callId}: "${content}"`);
      const conversationService = require('./conversation.service');
      await conversationService.saveRealtimeMessage(
        conn.conversationId,
        role,
        content.trim(),
        role === 'assistant' ? 'assistant_response' : 
        role === 'debug-user' ? 'debug_user_message' :
        'user_message'
      );
      logger.info(`[OpenAI Realtime] Successfully saved ${role} message (${content.length} chars) to conversation ${conn.conversationId}`);

      // EMERGENCY DETECTION: Post-message analysis for user messages
      if ((role === 'user' || role === 'patient') && conn.patientId && content && content.trim().length > 10) {
        try {
          logger.info(`[Emergency Detection] Processing utterance for emergency detection`, {
            patientId: conn.patientId,
            text: content.substring(0, 100),
            callId
          });
          
          const emergencyResult = await emergencyProcessor.processUtterance(
            conn.patientId,
            content,
            Date.now()
          );

          logger.info(`[Emergency Detection] Emergency detection result - shouldAlert: ${emergencyResult.shouldAlert}`, {
            patientId: conn.patientId,
            shouldAlert: emergencyResult.shouldAlert,
            reason: emergencyResult.reason,
            processing: emergencyResult.processing
          });

          if (emergencyResult.shouldAlert && !emergencyResult.processing.falsePositive) {
            logger.warn(`[Emergency Detection] 🚨 EMERGENCY DETECTED for patient ${conn.patientId}: ${emergencyResult.reason}`);
            
            const alertResult = await emergencyProcessor.createAlert(
              conn.patientId,
              emergencyResult.alertData,
              content
            );

            if (alertResult.success) {
              logger.info(`[Emergency Detection] ✅ Alert created successfully: ${alertResult.alert._id}`);
            } else {
              logger.error(`[Emergency Detection] ❌ Failed to create alert: ${alertResult.error}`);
            }
          } else {
            logger.debug(`[Emergency Detection] No alert needed - ${emergencyResult.reason}`);
          }
        } catch (error) {
          logger.error(`[Emergency Detection] ❌ Error in post-message detection for ${callId}:`, error);
        }
      }
    } catch (err) {
      logger.error(`[OpenAI Realtime] Failed to save ${role} message: ${err.message}`, err);
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
   * Create placeholder user message when user starts speaking
   * 
   * MESSAGE FLOW LOGIC:
   * 1. Create a placeholder message with timestamp when user starts speaking
   * 2. Store the message ID in the connection for later updating
   * 3. This ensures the timestamp reflects when user actually started speaking
   */
  async createPlaceholderUserMessage(callId) {
    const conn = this.connections.get(callId);
    if (!conn?.conversationId) return;

    try {
      const conversationService = require('./conversation.service');
      const message = await conversationService.saveRealtimeMessage(
        conn.conversationId,
        'patient', // Use 'patient' not 'user' - Message model enum only accepts 'patient', 'assistant', 'system', 'debug-user'
        '[Speaking...]', // Placeholder content
        'user_message'
      );
      
      if (message) {
        conn.activeUserMessageId = message._id;
        logger.info(`[OpenAI Realtime] Created placeholder user message ${message._id} for ${callId}`);
      }
    } catch (err) {
      logger.error(`[OpenAI Realtime] Failed to create placeholder user message: ${err.message}`);
    }
  }

  /**
   * Create placeholder assistant message when AI starts speaking
   * 
   * MESSAGE FLOW LOGIC:
   * 1. Create a placeholder message with timestamp when AI starts speaking
   * 2. Store the message ID in the connection for later updating
   * 3. This ensures the timestamp reflects when AI actually started speaking
   */
  async createPlaceholderAssistantMessage(callId) {
    const conn = this.connections.get(callId);
    if (!conn?.conversationId) return;

    try {
      const conversationService = require('./conversation.service');
      const message = await conversationService.saveRealtimeMessage(
        conn.conversationId,
        'assistant',
        '[Speaking...]', // Placeholder content
        'assistant_response'
      );
      
      if (message) {
        conn.activeAssistantMessageId = message._id;
        logger.info(`[OpenAI Realtime] Created placeholder assistant message ${message._id} for ${callId}`);
      }
    } catch (err) {
      logger.error(`[OpenAI Realtime] Failed to create placeholder assistant message: ${err.message}`);
    }
  }

  /**
   * Handle input audio transcription completed - UPDATED
   * 
   * MESSAGE FLOW LOGIC:
   * 1. This is called when user speech is transcribed (conversation.item.input_audio_transcription.completed)
   * 2. Update the existing placeholder message with the actual transcript
   * 3. This ensures the timestamp reflects when user started speaking, not when transcript was created
   */
  async handleInputAudioTranscriptionCompleted(callId, message) {
    if (!message.transcript) return;

    const conn = this.connections.get(callId);
    if (!conn) return;

    // Ignore user input until Bianca has given her initial greeting
    if (conn._waitingForInitialGreeting) {
      logger.info(`[OpenAI Realtime] Ignoring user input for ${callId} - waiting for Bianca's initial greeting`);
      return;
    }

    logger.info(`[OpenAI Realtime] User audio transcription completed for ${callId}: "${message.transcript}"`);

    // EMERGENCY DETECTION: Real-time analysis of user transcript
    logger.debug(`[Emergency Detection] Checking transcript - patientId: ${conn.patientId}, transcript length: ${message.transcript?.trim().length || 0}`);
    
    if (conn.patientId && message.transcript && message.transcript.trim().length > 10) {
      try {
        logger.info(`[Emergency Detection] Processing utterance for emergency detection: "${message.transcript.substring(0, 100)}..."`);
        const emergencyResult = await emergencyProcessor.processUtterance(
          conn.patientId,
          message.transcript,
          Date.now()
        );

        logger.info(`[Emergency Detection] Emergency detection result - shouldAlert: ${emergencyResult.shouldAlert}, reason: ${emergencyResult.reason}`);

        if (emergencyResult.shouldAlert) {
          logger.warn(`[Emergency Detection] EMERGENCY DETECTED for patient ${conn.patientId}: ${emergencyResult.reason}`);
          logger.warn(`[Emergency Detection] Alert data:`, emergencyResult.alertData);
          
          // Create alert and notify caregivers
          logger.info(`[Emergency Detection] Calling createAlert for patient ${conn.patientId}`);
          const alertResult = await emergencyProcessor.createAlert(
            conn.patientId,
            emergencyResult.alertData,
            message.transcript
          );

          logger.info(`[Emergency Detection] createAlert result - success: ${alertResult.success}, error: ${alertResult.error || 'none'}`);
          if (alertResult.notificationResult) {
            logger.info(`[Emergency Detection] Notification result:`, alertResult.notificationResult);
          }

          if (alertResult.success) {
            logger.info(`[Emergency Detection] Alert created successfully: ${alertResult.alert._id}`);
            
            // Update session instructions to inform AI that caregiver has been alerted
            // ONLY do this when we've actually sent an alert successfully
            try {
              const emergencyInstruction = `\n\nCRITICAL: An emergency alert has been AUTOMATICALLY sent to the patient's caregiver via text message. In your next response, you MUST inform them: "I've already sent an alert to your caregiver. They'll be notified right away. Please call emergency services right away if you need immediate medical help." Do NOT offer to call emergency services yourself - you cannot make calls. Use "emergency services" (not "911") as it works in all countries. ONLY say this because the system has confirmed an alert was sent.`;
              
              const updatedInstructions = (conn.initialPrompt || '') + emergencyInstruction;
              
              await this.sendJsonMessage(callId, {
                type: 'session.update',
                session: {
                  instructions: updatedInstructions
                }
              });
              
              logger.info(`[Emergency Detection] Updated session instructions for ${callId} to include emergency alert notification`);
            } catch (updateError) {
              logger.error(`[Emergency Detection] Failed to update session instructions: ${updateError.message}`);
              // Don't fail the alert creation if instruction update fails
            }
            
            // For CRITICAL emergencies, log warning for potential intervention
            if (emergencyResult.alertData.severity === 'CRITICAL') {
              logger.warn(`[Emergency Detection] CRITICAL emergency - consider immediate intervention for patient ${conn.patientId}`);
            }
          } else {
            logger.error(`[Emergency Detection] Failed to create alert: ${alertResult.error}`);
            logger.error(`[Emergency Detection] Alert result details:`, alertResult);
          }
        } else {
          logger.debug(`[Emergency Detection] Emergency detected but shouldAlert=false. Reason: ${emergencyResult.reason}`);
          logger.debug(`[Emergency Detection] Processing details:`, emergencyResult.processing);
        }
      } catch (error) {
        logger.error(`[Emergency Detection] Error processing emergency detection for ${callId}:`, error);
        logger.error(`[Emergency Detection] Error stack:`, error.stack);
        // Don't let emergency detection errors break the conversation
      }
    } else {
      if (!conn.patientId) {
        logger.debug(`[Emergency Detection] Skipping - no patientId in connection for ${callId}`);
      }
      if (!message.transcript || message.transcript.trim().length <= 10) {
        logger.debug(`[Emergency Detection] Skipping - transcript too short (${message.transcript?.trim().length || 0} chars) for ${callId}`);
      }
    }

    // Store the transcript for saving when user stops speaking
    conn.pendingUserTranscript = message.transcript.trim();
    logger.info(`[OpenAI Realtime] Stored user transcript for later saving: "${message.transcript}"`);
    
    // CRITICAL: If we're waiting for this transcript (user already stopped speaking), update the placeholder NOW
    if (conn._waitingForUserTranscript && conn.activeUserMessageId && conn.pendingUserTranscript && conn.pendingUserTranscript.trim()) {
      logger.info(`[OpenAI Realtime] Transcript arrived after user stopped speaking - updating placeholder ${conn.activeUserMessageId} now`);
      try {
        const { Message } = require('../models');
        const originalMessage = await Message.findById(conn.activeUserMessageId);
        if (originalMessage) {
          await Message.findByIdAndUpdate(
            conn.activeUserMessageId,
            { 
              content: conn.pendingUserTranscript.trim(),
              messageType: 'user_message',
            },
            { timestamps: false, runValidators: false }
          );
          logger.info(`[OpenAI Realtime] Updated placeholder user message ${conn.activeUserMessageId} with delayed transcript: "${conn.pendingUserTranscript}"`);
          conn.activeUserMessageId = null;
          conn._waitingForUserTranscript = false;
          conn.pendingUserTranscript = '';
          
          // If AI placeholder was deferred, create it now
          if (conn._pendingAiPlaceholder && conn._aiIsSpeaking) {
            logger.info(`[OpenAI Realtime] User message finalized - now creating deferred AI placeholder for ${callId}`);
            await this.createPlaceholderAssistantMessage(callId);
            conn._pendingAiPlaceholder = false;
          }
        }
      } catch (err) {
        logger.error(`[OpenAI Realtime] Failed to update placeholder with delayed transcript: ${err.message}`);
      }
    }
  }

  /**
   * Handle API errors - ENHANCED with recovery mechanisms
   */
  async handleApiError(callId, message) {
    const errorMsg = message.error?.message || 'Unknown OpenAI API error';
    const errorCode = message.error?.code || 'UNKNOWN_CODE';
    // Log the full error object for detailed debugging
    logger.error(`[OpenAI Realtime] API error from OpenAI for ${callId}. Code: ${errorCode}, Message: "${errorMsg}"`, {
      openAIError: message.error,
    });

    const conn = this.connections.get(callId);

    if (errorMsg.includes('buffer too small') && errorMsg.includes('0.00ms')) {
      logger.error(
        `[OpenAI Realtime] CRITICAL DIAGNOSTIC: OpenAI reported 'buffer too small (0.00ms)' for ${callId} on commit. This means audio appends are failing or the data is invalid. Input audio pipeline needs urgent review.`
      );
      if (conn) {
        conn.pendingCommit = false; // The commit was processed (and failed), allow new attempts.

        // CRITICAL: Track consecutive buffer errors
        if (!conn.consecutiveBufferErrors) {
          conn.consecutiveBufferErrors = 0;
        }
        conn.consecutiveBufferErrors++;

        // If we get too many consecutive buffer errors, the session is likely corrupted
        if (conn.consecutiveBufferErrors >= 3) {
          logger.error(`[OpenAI Realtime] Too many consecutive buffer errors (${conn.consecutiveBufferErrors}) for ${callId}. Session likely corrupted. Triggering reconnection.`);

          // Clear the audio buffer to prevent further errors
          conn.audioChunksSent = 0;
          conn.validAudioChunksSent = 0;
          conn.lastCommitTime = 0;

          // Close the connection to force a reconnect
          if (conn.webSocket) {
            conn.webSocket.close(1001, 'Session corrupted - buffer errors');
          }

          // The close handler will trigger reconnection
          return;
        }

        // OpenAI already cleared the buffer, don't clear it again
        logger.warn(`[OpenAI Realtime] Buffer error #${conn.consecutiveBufferErrors} for ${callId}. OpenAI already cleared the buffer, skipping redundant clear.`);

        // Reset counters
        conn.audioChunksSent = 0;
        conn.validAudioChunksSent = 0;
        conn.totalAudioBytesSent = 0;
        conn.lastCommitTime = Date.now();

        // CRITICAL FIX: Also reset the last successful append time to prevent stale commits
        conn.lastSuccessfulAppendTime = 0;

        // OPTIMIZATION: Remove from pending commits
        if (this.pendingCommits.has(callId)) {
          this.pendingCommits.delete(callId);
          logger.info(`[OpenAI Realtime] 🚀 BATCH: Removed ${callId} from pending commits`);
          
          // Stop global timer if no more pending commits
          if (this.pendingCommits.size === 0) {
            this.stopGlobalCommitTimer();
          }
        }

        // OPTIMIZATION: Remove from pending reconnections
        // STRANGLER FIG: Use reconnectionManager to remove pending reconnect
        if (this.pendingReconnections.has(callId)) {
          this.reconnectionManager.removePendingReconnect(callId);
          logger.info(`[OpenAI Realtime] 🚀 BATCH: Removed ${callId} from pending reconnections`);
        }
      }
    } else if (errorMsg.includes('Conversation already has an active response')) {
      logger.warn(
        `[OpenAI Realtime] API Error for ${callId}: "Conversation already has an active response". This often happens if a fallback response.create was sent while OpenAI was already generating. Current pendingCommit: ${conn?.pendingCommit}`
      );
      // No specific action needed here usually, just a diagnostic.
      if (conn) conn.pendingCommit = false; // If this error was related to a commit that also triggered a response.create
    } else if (
      errorCode === 'session_not_found' ||
      errorCode === 'session_expired_error' ||
      errorCode === 'session_internal_error'
    ) {
      logger.warn(
        `[OpenAI Realtime] Session error for ${callId}: ${errorCode}. Message: "${errorMsg}". Triggering session expiry handling.`
      );
      await this.handleSessionExpired(callId); // Treat as expired to force reconnect
      return; // Specific handling done
    } else if (errorCode === 'invalid_request_error' && errorMsg.includes('Invalid audio format')) {
      logger.error(
        `[OpenAI Realtime] OpenAI API Error for ${callId}: "Invalid audio format". Check input_audio_format and output_audio_format in session.update and actual audio data being sent/received.`
      );
      // This might be a critical configuration error.
      if (conn) conn.pendingCommit = false; // If related to a commit.
    } else {
      // For other errors, reset consecutive buffer error counter
      if (conn) {
        conn.consecutiveBufferErrors = 0;
        // CRITICAL: Reset pending commit flag for any error to prevent stuck state
        if (conn.pendingCommit) {
          logger.warn(`[OpenAI Realtime] Resetting pending commit flag for ${callId} due to error: ${errorCode}`);
          conn.pendingCommit = false;
        }
      }
    }

    this.notify(callId, 'openai_api_error', { error: message.error, message: errorMsg, code: errorCode });
  }

  /**
   * Handle session expired
   */
  async handleSessionExpired(callId) {
    logger.warn(
      `[OpenAI Realtime] Session expired or reported as invalid for ${callId}. Initiating reconnect sequence if not already in progress.`
    );
    this.notify(callId, 'openai_session_expired', {});

    const conn = this.connections.get(callId);
    if (conn && !this.isReconnecting.get(callId)) {
      // Check if not already trying to reconnect
      this.isReconnecting.set(callId, true); // Mark that we are starting a reconnect process
      if (conn.webSocket) {
        logger.info(`[OpenAI Realtime] Closing WebSocket for ${callId} due to session expiry to trigger reconnect.`);
        conn.webSocket.close(1000, 'Session expired, client initiating reconnect'); // Normal close to trigger handleClose
      } else {
        // If WS somehow already gone, directly attempt reconnect
        logger.info(
          `[OpenAI Realtime] WebSocket for ${callId} already gone. Directly attempting reconnect after session expiry.`
        );
        const delay = this.calculateBackoffDelay(this.reconnectAttempts.get(callId) || 0);
        this.scheduleReconnect(callId, delay, this.reconnectAttempts.get(callId) || 0);
      }
    } else if (conn && this.isReconnecting.get(callId)) {
      logger.info(
        `[OpenAI Realtime] Session expired for ${callId}, but already in reconnecting state. Reconnect process will continue.`
      );
    } else if (!conn) {
      logger.warn(`[OpenAI Realtime] Session expired for ${callId}, but no connection state found.`);
    }
  }

  /**
   * Process audio response from OpenAI (PCM) -> Resample -> Convert to uLaw -> Notify ARI.
   */
  async processAudioResponse(callId, audioBase64) {
    if (!audioBase64) return;

    try {
      // Simple direct pass-through
      const ulawBuffer = Buffer.from(audioBase64, 'base64');
      if (ulawBuffer.length === 0) return;

      // Record for debugging
      await this.appendToContinuousDebugFile(callId, 'continuous_from_openai_ulaw.ulaw', ulawBuffer);

      // Send to RTP immediately
      this.notify(callId, 'audio_chunk', {
        audio: audioBase64,
        originalSizeBytes: ulawBuffer.length,
        ulawSizeBytes: ulawBuffer.length
      });

    } catch (err) {
      logger.error(`[OpenAI Realtime] Error processing audio for ${callId}: ${err.message}`);
    }
  }

  /**
   * STRANGLER FIG: Conversation item handling now uses MessageHandler
   */
  
  async handleConversationItem(callId, item, dbConversationId) {
    if (!item) return;

    try {
      // Use MessageHandler to process conversation item
      await MessageHandler.handleConversationItem(
        item,
        dbConversationId,
        async (conversationId, role, transcript, messageType) => {
          const conversationService = require('./conversation.service');
          await conversationService.saveRealtimeMessage(
            conversationId,
            role,
            transcript,
            messageType
          );
        }
      );

      // Handle function calls
      if (item.type === 'function_call') {
        logger.info(`[OpenAI Realtime] Function call: ${item.function_call?.name}`);

        if (dbConversationId && item.function_call) {
          try {
            const conversationService = require('./conversation.service');
            const functionContent = `Function call: ${item.function_call.name}(${JSON.stringify(item.function_call.arguments || {})})`;
            await conversationService.saveRealtimeMessage(
              dbConversationId,
              item.role,
              functionContent,
              'function_call'
            );
          } catch (dbErr) {
            logger.error(`[OpenAI Realtime] Failed to save function call: ${dbErr.message}`);
          }
        }

        this.notify(callId, 'function_call', {
          call: item.function_call,
          itemId: item.id,
          timestamp: new Date()
        });
      }
    } catch (err) {
      logger.error(`[OpenAI Realtime] Error in handleConversationItem for ${callId}: ${err.message}`, err);
    }
  }

  /**
   * Send JSON message - ENHANCED with tracking and error recovery
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

    // SIMPLIFIED: Basic validation only
    if (messageObj.type === 'input_audio_buffer.append' && (!messageObj.audio || messageObj.audio.length === 0)) {
      logger.warn(`[OpenAI Realtime] Empty audio append for ${callId}`);
      return Promise.resolve(true);
    }

    // INTERRUPTION LOGIC: Allow commits when AI is generating response if user is speaking
    if (messageObj.type === 'input_audio_buffer.commit' && callId && conn && conn._responseCreated) {
      const hasMeaningfulAudio = this.checkForMeaningfulAudio(callId);
      if (hasMeaningfulAudio) {
        logger.info(`[OpenAI Realtime] ALLOWING interrupt commit for ${callId} - user is speaking over AI`);
      } else {
        logger.debug(`[OpenAI Realtime] Blocking commit for ${callId} - AI is generating response but no meaningful audio`);
        return Promise.resolve(true);
      }
    }

    // Buffer audio appends when session isn't ready
    if (messageObj.type === 'input_audio_buffer.append' && callId && conn && (!conn.sessionReady || conn._sessionSetupInProgress)) {
      const pending = this.pendingAudio.get(callId) || [];
      if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
        const audioData = messageObj.audio;
        if (audioData) {
          pending.push(audioData);
          this.pendingAudio.set(callId, pending);
          logger.debug(`[OpenAI Realtime] Buffered audio chunk for ${callId} (buffer size: ${pending.length})`);
        }
      }
      return Promise.resolve(true);
    }

    if (!wsToSend || wsToSend.readyState !== WebSocket.OPEN) {
      logger.warn(`[OpenAI Realtime] Cannot send - WS not open for ${identifier}`);
      return Promise.reject(new Error(`WebSocket not open for ${identifier}`));
    }

    try {
      const messageStr = JSON.stringify(messageObj);

      // Reduce logging verbosity for audio append messages
      if (messageObj.type === 'input_audio_buffer.append') {
        // Only log every 100th audio append to reduce noise
        const conn = this.connections.get(callId);
        if (!conn || !conn.validAudioChunksSent || conn.validAudioChunksSent % 100 === 0) {
          logger.debug(`[OpenAI Realtime] SENDING: type=${messageObj.type}, audio_length=${messageObj.audio?.length || 0}`);
        }
      } else if (messageObj.type === 'input_audio_buffer.commit') {
        logger.info(`[OpenAI Realtime] SENDING: type=${messageObj.type} - attempting commit`);
      } else {
        // Log all other message types normally
        logger.info(`[OpenAI Realtime] SENDING: type=${messageObj.type}`);
      }

      return new Promise((resolve, reject) => {
        wsToSend.send(messageStr, (error) => {
          if (error) {
            logger.error(`[OpenAI Realtime] Send error: ${error.message}`, error);
            if (conn) conn.lastActivity = Date.now();

            // If it's an audio append that failed, decrement the counter
            if (messageObj.type === 'input_audio_buffer.append' && conn) {
              conn.audioChunksSent = Math.max(0, conn.audioChunksSent - 1);
              conn.validAudioChunksSent = Math.max(0, conn.validAudioChunksSent - 1);
            }

            reject(error);
          } else {
            if (conn) {
              conn.lastActivity = Date.now();

              // Track successful operations
              if (messageObj.type === 'input_audio_buffer.append') {
                // Successfully sent audio
                conn.lastSuccessfulAppendTime = Date.now();
                conn.consecutiveBufferErrors = 0; // Reset error counter on successful append
                // Only log every 100th successful append to reduce noise
                if (!conn.validAudioChunksSent || conn.validAudioChunksSent % 100 === 0) {
                  logger.debug(`[OpenAI Realtime] ✅ Audio append sent successfully for ${callId} (chunk ${conn.audioChunksSent || 0})`);
                }
              } else if (messageObj.type === 'input_audio_buffer.commit') {
                logger.info(`[OpenAI Realtime] ✅ Commit message sent successfully for ${callId}`);
              } else if (messageObj.type === 'input_audio_buffer.clear') {
                // Successfully cleared buffer
                logger.info(`[OpenAI Realtime] Buffer cleared successfully for ${callId}`);
                conn.audioChunksSent = 0;
                conn.validAudioChunksSent = 0;
                conn.consecutiveBufferErrors = 0;
                // Track that we cleared the buffer
                conn._bufferClearedByUs = true;
                conn._bufferClearedTime = Date.now();
              }
            }
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

    logger.info(`[OpenAI Realtime] Flushing ${chunksULawBase64.length} pending uLaw audio chunks for ${callId} (this includes your "hello" if it was buffered).`);

    const chunksToProcess = [...chunksULawBase64];
    this.pendingAudio.set(callId, []);

    let successfullyProcessedAndSentCount = 0;
    let totalULawBytes = 0;

    for (const chunkULawBase64 of chunksToProcess) {
      try {
        // Validate audio chunk before sending
        const validation = this.validateAudioChunk(chunkULawBase64);
        if (!validation.isValid) {
          logger.warn(`[OpenAI Realtime] flushPendingAudio (${callId}): Invalid audio chunk - ${validation.reason}. Skipping.`);
          continue;
        }

        const ulawBuffer = Buffer.from(chunkULawBase64, 'base64');
        totalULawBytes += ulawBuffer.length;

        // Send directly as g711_ulaw - no conversion needed
        await this.sendJsonMessage(callId, {
          type: 'input_audio_buffer.append',
          audio: chunkULawBase64,
        });

        conn.audioChunksSent++;

        // Track valid audio chunks separately
        if (!conn.validAudioChunksSent) {
          conn.validAudioChunksSent = 0;
        }
        conn.validAudioChunksSent++;

        successfullyProcessedAndSentCount++;

      } catch (audioProcessingError) {
        logger.error(
          `[OpenAI Realtime] flushPendingAudio (${callId}): Error processing a pending chunk: ${audioProcessingError.message}`,
          audioProcessingError.stack
        );
      }
    }

    logger.info(
      `[OpenAI Realtime] flushPendingAudio (${callId}): Finished processing. Sent ${successfullyProcessedAndSentCount} of ${chunksToProcess.length} chunks. Total uLaw bytes: ${totalULawBytes}.`
    );

    if (successfullyProcessedAndSentCount > 0) {
      // Check if we have sufficient audio data before committing
      const commitReadiness = this.checkCommitReadiness(callId);
      if (commitReadiness.canCommit && conn.sessionReady && conn.webSocket?.readyState === WebSocket.OPEN && !conn.pendingCommit) {
        logger.info(
          `[OpenAI Realtime] flushPendingAudio (${callId}): Committing ${successfullyProcessedAndSentCount} appended audio chunks (${commitReadiness.totalDuration}ms of audio).`
        );
        try {
          await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
          conn.pendingCommit = true;
        } catch (commitErr) {
          logger.error(
            `[OpenAI Realtime] flushPendingAudio (${callId}): Failed to send commit after flushing: ${commitErr.message}`
          );
          conn.pendingCommit = false;
        }
      } else {
        logger.warn(
          `[OpenAI Realtime] flushPendingAudio (${callId}): Conditions not met for commit. sessionReady: ${conn.sessionReady}, wsState: ${conn.webSocket?.readyState}, pendingCommit: ${conn.pendingCommit}, commitReadiness: ${commitReadiness.reason}`
        );
      }
    } else if (chunksToProcess.length > 0) {
      logger.warn(
        `[OpenAI Realtime] flushPendingAudio (${callId}): No chunks were successfully processed. No commit will be sent.`
      );
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

    // Check if we have sufficient audio data before forcing commit
    const commitReadiness = this.checkCommitReadiness(callId);
    if (!commitReadiness.canCommit) {
      logger.warn(`[OpenAI Realtime] Force commit blocked - insufficient audio for ${callId}: ${commitReadiness.reason}`);
      return false;
    }

    try {
      await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
      logger.info(`[OpenAI Realtime] Force commit sent successfully for ${callId} (${commitReadiness.totalDuration}ms of audio)`);
      conn.pendingCommit = true;
      return true;
    } catch (err) {
      logger.error(`[OpenAI Realtime] Force commit failed for ${callId}: ${err.message}`);
      return false;
    }
  }

  /**
   * OPTIMIZED: Batch commit system - adds call to pending commits instead of creating individual timers
   */
  debounceCommit(callId) {
    // NO-OP when using server VAD
    logger.debug(`[OpenAI Realtime] Manual commit disabled - using server VAD for ${callId}`);
  }

  /**
   * Check if recent audio chunks contain meaningful audio (not just silence)
   */
  checkForMeaningfulAudio(callId) {
    const conn = this.connections.get(callId);
    if (!conn || !conn._recentAudioChunks) {
      return false;
    }

    // Check the last few chunks for non-silence
    const recentChunks = conn._recentAudioChunks.slice(-5); // Last 5 chunks
    let meaningfulChunks = 0;
    let totalBytes = 0;
    let silenceBytes = 0;

    for (const chunk of recentChunks) {
      if (chunk && chunk.length > 0) {
        try {
          const audioBytes = Buffer.from(chunk, 'base64');
          totalBytes += audioBytes.length;
          // Just check if chunk has any data
          const hasNonSilence = audioBytes.length > 0;
          if (hasNonSilence) {
            meaningfulChunks++;
          }
        } catch (err) {
          // If we can't decode, assume it might be meaningful
          meaningfulChunks++;
        }
      }
    }

    // Consider meaningful if at least 2 out of 5 recent chunks have non-silence
    const hasMeaningfulAudio = meaningfulChunks >= 2;
    const silencePercentage = totalBytes > 0 ? (silenceBytes / totalBytes * 100).toFixed(1) : 0;
    logger.debug(`[OpenAI Realtime] Audio analysis for ${callId}: ${meaningfulChunks}/5 chunks have meaningful audio, ${silencePercentage}% silence`);

    return hasMeaningfulAudio;
  }

  async sendAudioChunk(callId, audioChunkBase64ULaw, bypassBuffering = false) {
    // Basic validation
    if (!audioChunkBase64ULaw || audioChunkBase64ULaw.length === 0) {
      logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): Empty audio chunk`);
      return;
    }

    const conn = this.connections.get(callId);
    if (!conn) {
      logger.warn(`[OpenAI Realtime] sendAudioChunk (${callId}): No connection. Skipping.`);
      return;
    }

    // Initialize debug files if needed
    if (!conn._debugFilesInitialized) {
      this.initializeContinuousDebugFiles(callId);
      conn._debugFilesInitialized = true;
    }

    conn.audioChunksReceived++;

    // Track when first audio was received
    if (!conn.firstAudioReceivedTime) {
      conn.firstAudioReceivedTime = Date.now();
      logger.info(`[OpenAI Realtime] First audio received for ${callId} at ${conn.firstAudioReceivedTime} (chunk #${conn.audioChunksReceived})`);
    }

    // Track consecutive silence chunks
    if (this.isAudioSilence(audioChunkBase64ULaw)) {
      conn.consecutiveSilenceChunks = (conn.consecutiveSilenceChunks || 0) + 1;
    } else {
      conn.consecutiveSilenceChunks = 0;
    }

    // Check if we can send immediately
    const canSendImmediately = conn.webSocket && conn.webSocket.readyState === WebSocket.OPEN && conn.sessionReady;

    if (!canSendImmediately) {
      // Session not ready - buffer audio
      const shouldBuffer = !bypassBuffering && conn.status !== 'closed' && conn.status !== 'error_terminal';

      if (shouldBuffer) {
        const pending = this.pendingAudio.get(callId) || [];
        if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
          pending.push(audioChunkBase64ULaw);
          this.pendingAudio.set(callId, pending);

          if (pending.length <= 10) {
            logger.info(`[OpenAI Realtime] Buffered audio chunk #${pending.length} for ${callId}`);
          }
        } else {
          logger.warn(`[OpenAI Realtime] Buffer full for ${callId}, dropping audio chunk`);
        }
      }
      return;
    }

    try {
      // Record audio for debugging
      const ulawBuffer = Buffer.from(audioChunkBase64ULaw, 'base64');
        await this.appendToContinuousDebugFile(callId, 'continuous_from_asterisk_ulaw.ulaw', ulawBuffer);

        // Send uLaw audio directly to OpenAI
        await this.sendJsonMessage(callId, {
            type: 'input_audio_buffer.append',
            audio: audioChunkBase64ULaw,
        });

        // Update tracking
        conn.audioChunksSent++;
        conn.validAudioChunksSent = (conn.validAudioChunksSent || 0) + 1;
        conn.totalAudioBytesSent = (conn.totalAudioBytesSent || 0) + ulawBuffer.length;
        conn.lastSuccessfulAppendTime = Date.now();

        // Log progress occasionally
        if (conn.validAudioChunksSent <= 10 || conn.validAudioChunksSent % 100 === 0) {
            logger.info(`[OpenAI Realtime] Sent audio chunk #${conn.validAudioChunksSent} to OpenAI for ${callId}`);
        }

    } catch (audioProcessingError) {
      logger.error(`[OpenAI Realtime] Audio processing error for ${callId}: ${audioProcessingError.message}`);

      if (audioProcessingError.message.includes('WebSocket not open')) {
        this.updateConnectionStatus(callId, 'error');
        if (!this.isReconnecting.get(callId)) {
          this.handleConnectionError(callId, audioProcessingError);
        }
      }
    }
  }

  // Remove the sendAudioChunkDebug method entirely

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
          content: text,
        };
      } else {
        item = {
          type: 'message',
          role: role,
          content: [{ type: 'input_text', text }],
        };
      }
      await this.sendJsonMessage(callId, { type: 'conversation.item.create', item });
    } catch (err) {
      logger.error(`[OpenAI Realtime] Error sending text message: ${err.message}`, err);
    }
  }

  async diagnoseVoiceDetection(callId) {
    logger.info(`[VOICE DIAGNOSIS] Disabled due to crashes`);
    return { disabled: true };
}


  async detectAndFixLanguageIssue(callId) {
    const conn = this.connections.get(callId);
    if (!conn || !conn.sessionReady) {
      logger.error(`[Language Fix] Cannot fix language - connection not ready for ${callId}`);
      return;
    }

    logger.warn(`[Language Fix] Detecting language issue for ${callId} - resetting conversation to English`);

    try {
      // First, cancel any ongoing AI response
      if (conn._aiIsSpeaking) {
        await this.sendJsonMessage(callId, { type: 'response.cancel' });
        conn._aiIsSpeaking = false;
        logger.info(`[Language Fix] Cancelled ongoing AI response for ${callId}`);
      }

      // Send a system message to reset the conversation in English
      await this.sendJsonMessage(callId, {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'input_text',
            text: 'IMPORTANT: You must respond only in English. The user speaks English. Do not use any other language.'
          }]
        }
      });

      // Force a new response in English
      await this.sendResponseCreate(callId);
      conn._aiIsSpeaking = true;

      logger.info(`[Language Fix] Language reset to English attempted for ${callId}`);
      return true;
    } catch (err) {
      logger.error(`[Language Fix] Failed to reset language for ${callId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Force response generation for testing - NEW METHOD
   */
  async forceResponseGeneration(callId) {
    const conn = this.connections.get(callId);
    if (!conn || !conn.sessionReady) {
      logger.error(`[OpenAI Realtime] Cannot force response - connection not ready for ${callId}`);
      return false;
    }

    // CRITICAL: Force OpenAI to generate a response
    logger.info(`[OpenAI Realtime] Force response generation for ${callId}`);
    try {
      await this.sendResponseCreate(callId);
      return true;
    } catch (err) {
      logger.error(`[OpenAI Realtime] Failed to force response generation for ${callId}: ${err.message}`);
      return false;
    }

    try {
      // Send a user message first to establish context
      await this.sendJsonMessage(callId, {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }]
        }
      });

      // Then immediately request a response
      await this.sendJsonMessage(callId, {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio']
        }
      });

      logger.info(`[OpenAI Realtime] Forced response generation for ${callId}`);
      return true;
    } catch (err) {
      logger.error(`[OpenAI Realtime] Error forcing response: ${err.message}`);
      return false;
    }
  }

  /**
   * Force response generation even with silence (for testing)
   */
  async forceResponseGenerationWithSilence(callId) {
    const conn = this.connections.get(callId);
    if (!conn || !conn.sessionReady) {
      logger.error(`[OpenAI Realtime] Cannot force response - connection not ready for ${callId}`);
      return false;
    }

    try {
      // Temporarily override the response flag to force a new response
      conn._responseCreated = false;

      // Send a user message first to establish context
      await this.sendJsonMessage(callId, {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello, can you hear me?' }]
        }
      });

      // Then immediately request a response
      await this.sendJsonMessage(callId, {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio']
        }
      });

      logger.info(`[OpenAI Realtime] Forced response generation with silence for ${callId}`);
      return true;
    } catch (err) {
      logger.error(`[OpenAI Realtime] Error forcing response with silence: ${err.message}`);
      return false;
    }
  }

  /**
   * Recover from buffer errors by clearing and resetting the audio pipeline
   */
  async recoverFromBufferError(callId) {
    const conn = this.connections.get(callId);
    if (!conn) {
      logger.error(`[OpenAI Realtime] Cannot recover - no connection for ${callId}`);
      return false;
    }

    logger.info(`[OpenAI Realtime] Attempting to recover from buffer error for ${callId}`);

    try {
      // Step 1: Reset all counters (OpenAI already cleared the buffer)
      conn.audioChunksSent = 0;
      conn.validAudioChunksSent = 0;
      conn.pendingCommit = false;
      conn.consecutiveBufferErrors = 0;
      conn.lastCommitTime = Date.now();

      // Step 2: Clear any pending audio
      const pendingAudio = this.pendingAudio.get(callId);
      if (pendingAudio && pendingAudio.length > 0) {
        logger.info(`[OpenAI Realtime] Clearing ${pendingAudio.length} pending audio chunks for ${callId}`);
        this.pendingAudio.set(callId, []);
      }

      // Step 3: OPTIMIZATION: Remove from pending commits
      if (this.pendingCommits.has(callId)) {
        this.pendingCommits.delete(callId);
        logger.info(`[OpenAI Realtime] 🚀 BATCH: Removed ${callId} from pending commits (buffer error recovery)`);
        
        // Stop global timer if no more pending commits
        if (this.pendingCommits.size === 0) {
          this.stopGlobalCommitTimer();
        }
      }

      // STRANGLER FIG: Use reconnectionManager to remove pending reconnect
      if (this.pendingReconnections.has(callId)) {
        this.reconnectionManager.removePendingReconnect(callId);
        logger.info(`[OpenAI Realtime] 🚀 BATCH: Removed ${callId} from pending reconnections (buffer error recovery)`);
      }

      logger.info(`[OpenAI Realtime] Successfully recovered from buffer error for ${callId} (OpenAI already cleared buffer)`);
      return true;

    } catch (err) {
      logger.error(`[OpenAI Realtime] Failed to recover from buffer error for ${callId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Force recovery when OpenAI stops responding - can be called externally
   */
  async forceRecovery(callId, reason = 'External recovery request') {
    const conn = this.connections.get(callId);
    if (!conn) {
      logger.error(`[OpenAI Realtime] Cannot force recovery - no connection for ${callId}`);
      return false;
    }

    logger.warn(`[OpenAI Realtime] Force recovery triggered for ${callId}: ${reason}`);

    try {
      // First try to clear any pending state
      if (conn.pendingCommit) {
        conn.pendingCommit = false;
        logger.info(`[OpenAI Realtime] Cleared pending commit for ${callId}`);
      }

      // Try to clear the audio buffer
      try {
        await this.sendJsonMessage(callId, { type: 'input_audio_buffer.clear' });
        logger.info(`[OpenAI Realtime] Cleared audio buffer for ${callId}`);
      } catch (clearErr) {
        logger.warn(`[OpenAI Realtime] Could not clear buffer for ${callId}: ${clearErr.message}`);
      }

      // Reset counters
      conn.audioChunksSent = 0;
      conn.validAudioChunksSent = 0;
      conn.lastCommitTime = Date.now();
      conn.consecutiveBufferErrors = 0;

      // If the connection is in a bad state, trigger reconnection
      if (conn.status === 'error' || !conn.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
        logger.info(`[OpenAI Realtime] Connection state requires reconnection for ${callId}. Triggering reconnect.`);
        if (!this.isReconnecting.get(callId)) {
          this.isReconnecting.set(callId, true);
          this.handleConnectionError(callId, new Error(`Force recovery: ${reason}`));
        }
      } else {
        // Connection looks healthy, try to flush any buffered audio
        const pendingAudio = this.pendingAudio.get(callId) || [];
        if (pendingAudio.length > 0) {
          logger.info(`[OpenAI Realtime] Flushing ${pendingAudio.length} buffered audio chunks after force recovery for ${callId}`);
          await this.flushPendingAudio(callId);

          // Try to generate a response if we have audio
          if (conn.validAudioChunksSent > 0) {
            // Check grace period to prevent dual responses after initial greeting
            const timeSinceGreeting = conn._initialGreetingCompletedAt 
              ? Date.now() - conn._initialGreetingCompletedAt 
              : Infinity;
            const GRACE_PERIOD_MS = 3000; // 3 seconds to clear lingering audio from connection/transfer

            if (timeSinceGreeting < GRACE_PERIOD_MS) {
              logger.info(
                `[OpenAI Realtime] Skipping force recovery for ${callId} - in grace period ` +
                `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${GRACE_PERIOD_MS}ms)`
              );
            } else {
              logger.info(`[OpenAI Realtime] Auto-triggering response generation after force recovery for ${callId}`);
              await this.sendResponseCreate(callId);
            }
          }
        }
      }

      this.notify(callId, 'openai_force_recovery', { reason });
      logger.info(`[OpenAI Realtime] Force recovery completed for ${callId}`);
      return true;
    } catch (err) {
      logger.error(`[OpenAI Realtime] Force recovery failed for ${callId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Get connection status for a specific call
   */
  async getConnectionStatus(callId) {
    const conn = this.connections.get(callId);
    if (!conn) {
      return {
        exists: false,
        message: 'Connection not found',
      };
    }

    const pendingAudio = this.pendingAudio.get(callId) || [];
    const isReconnecting = this.isReconnecting.get(callId) || false;
    const reconnectAttempts = this.reconnectAttempts.get(callId) || 0;

    return {
      exists: true,
      callId,
      status: conn.status,
      sessionReady: conn.sessionReady,
      webSocketState: conn.webSocket ? conn.webSocket.readyState : 'NO_WEBSOCKET',
      lastActivity: conn.lastActivity,
      startTime: conn.startTime,
      audioChunksReceived: conn.audioChunksReceived,
      audioChunksSent: conn.audioChunksSent,
      validAudioChunksSent: conn.validAudioChunksSent || 0,
      pendingCommit: conn.pendingCommit,
      consecutiveBufferErrors: conn.consecutiveBufferErrors || 0,
      pendingAudioChunks: pendingAudio.length,
      isReconnecting,
      reconnectAttempts,
      conversationId: conn.conversationId,
      asteriskChannelId: conn.asteriskChannelId,
      callSid: conn.callSid,
    };
  }

  /**
   * Get status of all active connections
   */
  async getAllConnectionStatus() {
    const connections = [];

    for (const [callId, conn] of this.connections.entries()) {
      const pendingAudio = this.pendingAudio.get(callId) || [];
      const isReconnecting = this.isReconnecting.get(callId) || false;
      const reconnectAttempts = this.reconnectAttempts.get(callId) || 0;

      connections.push({
        callId,
        status: conn.status,
        sessionReady: conn.sessionReady,
        webSocketState: conn.webSocket ? conn.webSocket.readyState : 'NO_WEBSOCKET',
        lastActivity: conn.lastActivity,
        startTime: conn.startTime,
        audioChunksReceived: conn.audioChunksReceived,
        audioChunksSent: conn.audioChunksSent,
        validAudioChunksSent: conn.validAudioChunksSent || 0,
        pendingCommit: conn.pendingCommit,
        consecutiveBufferErrors: conn.consecutiveBufferErrors || 0,
        pendingAudioChunks: pendingAudio.length,
        isReconnecting,
        reconnectAttempts,
        conversationId: conn.conversationId,
        asteriskChannelId: conn.asteriskChannelId,
        callSid: conn.callSid,
      });
    }

    return connections;
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
        // Check for idle connections
        if (conn.lastActivity && now - conn.lastActivity > idleTimeout) {
          logger.warn(`[OpenAI Realtime] Connection ${callId} idle timeout. Cleaning up.`);
          this.disconnect(callId);
          continue;
        }

        // Check for connections in error state that should be reconnected
        if (conn.status === 'error' && !this.isReconnecting.get(callId)) {
          logger.warn(`[OpenAI Realtime] Connection ${callId} in error state, triggering reconnect`);
          this.handleConnectionError(callId, new Error('Connection in error state'));
        }

        // Check for connections with closed WebSocket that should be reconnected
        if (conn.webSocket && conn.webSocket.readyState === WebSocket.CLOSED &&
          conn.status !== 'closed' && !this.isReconnecting.get(callId)) {
          logger.warn(`[OpenAI Realtime] WebSocket closed for ${callId} but connection not cleaned up, triggering reconnect`);
          this.handleConnectionError(callId, new Error('WebSocket closed unexpectedly'));
        }

        // Check for connections that never became ready
        if (conn.status === 'connected' && !conn.sessionReady &&
          now - conn.startTime > 30000) { // 30 seconds to become ready
          logger.error(`[OpenAI Realtime] Connection ${callId} failed to become ready after 30s`);
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
    
    // OPTIMIZATION: Remove from pending commits
    if (this.pendingCommits.has(callId)) {
      this.pendingCommits.delete(callId);
      logger.info(`[OpenAI Realtime] 🚀 BATCH: Removed ${callId} from pending commits (disconnect)`);
      
      // Stop global timer if no more pending commits
      if (this.pendingCommits.size === 0) {
        this.stopGlobalCommitTimer();
      }
    }

    // STRANGLER FIG: Use reconnectionManager to remove pending reconnect
    if (this.pendingReconnections.has(callId)) {
      this.reconnectionManager.removePendingReconnect(callId);
      logger.info(`[OpenAI Realtime] 🚀 BATCH: Removed ${callId} from pending reconnections (disconnect)`);
    }

    if (conn.webSocket) {
      const ws = conn.webSocket;
      
      // Cancel any active AI response before closing
      if (ws.readyState === WebSocket.OPEN && conn._aiIsSpeaking) {
        try {
          logger.info(`[OpenAI Realtime] Canceling active AI response before disconnect for ${callId}`);
          await this.sendJsonMessage(callId, { type: 'response.cancel' });
          conn._aiIsSpeaking = false;
          // Give a brief moment for the cancel to be processed
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          logger.warn(`[OpenAI Realtime] Error canceling response before disconnect: ${err.message}`);
          // Continue with disconnect even if cancel fails
        }
      }
      
      ws.removeAllListeners();

      try {
        if (ws.readyState === WebSocket.OPEN) {
          logger.info(`[OpenAI Realtime] Closing WebSocket for ${callId}`);
          ws.close(1000, 'Client initiated disconnect');
        } else if (ws.readyState === WebSocket.CONNECTING) {
          logger.info(`[OpenAI Realtime] Terminating connecting WebSocket for ${callId}`);
          try {
            ws.terminate();
          } catch (termErr) {
            logger.debug(`[OpenAI Realtime] WebSocket terminate ignored: ${termErr.message}`);
          }
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
    
    // OPTIMIZATION: Remove from pending commits
    if (this.pendingCommits.has(callId)) {
      this.pendingCommits.delete(callId);
      logger.info(`[OpenAI Realtime] 🚀 BATCH: Removed ${callId} from pending commits (cleanup)`);
      
      // Stop global timer if no more pending commits
      if (this.pendingCommits.size === 0) {
        this.stopGlobalCommitTimer();
      }
    }

    // OPTIMIZATION: Remove from pending reconnections
    // STRANGLER FIG: Use reconnectionManager to remove pending reconnect
    if (this.pendingReconnections.has(callId)) {
      this.reconnectionManager.removePendingReconnect(callId);
      logger.info(`[OpenAI Realtime] 🚀 BATCH: Removed ${callId} from pending reconnections (cleanup)`);
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

    const disconnectPromises = activeCallIds.map((callId) => {
      return this.disconnect(callId).catch((err) => {
        logger.error(`[OpenAI Realtime] Error disconnecting ${callId}: ${err.message}`);
      });
    });

    await Promise.allSettled(disconnectPromises);
    this.stopHealthCheck();
    this.stopTranscriptCleanupInterval();
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
      logger.info(`[AUDIO DEBUG] ${label} first ulaw bytes: ${samples.map((b) => '0x' + b.toString(16)).join(', ')}`);
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
      fs.writeFileSync(
        infoPath,
        JSON.stringify(
          {
            format,
            sampleRate: sampleRate || defaultSampleRate,
            channels: 1,
            bytesPerSample: format === 'pcm16' ? 2 : 1,
            samples: Math.floor(buffer.length / (format === 'pcm16' ? 2 : 1)),
            durationMs: Math.floor(
              buffer.length / (format === 'pcm16' ? 2 : 1) / ((sampleRate || defaultSampleRate) / 1000)
            ),
          },
          null,
          2
        )
      );
    } catch (err) {
      logger.error(`[AUDIO DEBUG] Failed to save debug audio: ${err.message}`);
    }
  }

  async appendToContinuousDebugFile(callId, filename, buffer) {
    if (!buffer || buffer.length === 0) return;

    const filepath = path.join(DEBUG_AUDIO_LOCAL_DIR, callId, filename);
    try {
      fs.appendFileSync(filepath, buffer);

      // Log periodically to confirm recording is working
      const stats = fs.statSync(filepath);
      if (stats.size % (1024 * 1024) < buffer.length) { // Log every ~1MB
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        logger.info(`[AUDIO DEBUG] Recording ${filename} for ${callId}: ${sizeMB} MB`);
      }
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
        'continuous_from_openai_ulaw.ulaw',
      ];

      files.forEach((filename) => {
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
   * Upload continuous audio files to S3 after call ends - ENHANCED VERSION
   * Only uploads 2 files: one combined file from Asterisk and one from OpenAI
   * Now includes timestamps and better organization
   */
  async uploadDebugAudioToS3(callId, conn = null) {
    const S3Service = require('./s3.service');

    try {
      const callAudioDir = path.join(DEBUG_AUDIO_LOCAL_DIR, callId);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dateFolder = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Enhanced S3 key structure with timestamps and better organization
      const filesToUpload = [
        {
          source: 'continuous_from_asterisk_ulaw.ulaw',
          format: 'mulaw',
          sampleRate: 8000,
          channels: 1,
          s3Key: `debug-audio/${dateFolder}/${callId}_${timestamp}/caller_to_openai_8khz.wav`,
          description: 'Complete audio from caller to OpenAI (8kHz)',
        },
        {
          source: 'continuous_from_openai_ulaw.ulaw',
          format: 'mulaw',
          sampleRate: 8000,
          channels: 1,
          s3Key: `debug-audio/${dateFolder}/${callId}_${timestamp}/openai_to_caller_8khz.wav`,
          description: 'Complete audio from OpenAI to caller (8kHz uLaw)',
        },
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

          // Upload to S3 with enhanced metadata
          const fileContent = fs.readFileSync(wavFile);
          const uploadResult = await S3Service.uploadFile(fileContent, file.s3Key, 'audio/wav', {
            callId: callId,
            uploadTimestamp: timestamp,
            uploadDate: dateFolder,
            originalFormat: file.format,
            sampleRate: file.sampleRate.toString(),
            direction: file.source.includes('asterisk') ? 'inbound' : 'outbound',
            originalSize: stats.size.toString(),
            convertedSize: fileContent.length.toString(),
            description: file.description,
            // Add call statistics if available
            ...(conn && {
              audioChunksReceived: (conn.audioChunksReceived || 0).toString(),
              audioChunksSent: (conn.audioChunksSent || 0).toString(),
              validAudioChunksSent: (conn.validAudioChunksSent || 0).toString(),
              sessionReady: (conn.sessionReady || false).toString(),
            })
          });

          // Get presigned URL for easy download
          const downloadUrl = await S3Service.getPresignedUrl(file.s3Key, 3600); // 1 hour expiry

          uploadedFiles.push({
            key: file.s3Key,
            url: downloadUrl,
            description: file.description,
            originalSize: stats.size,
            convertedSize: fileContent.length,
          });

          logger.info(`[AUDIO DEBUG] Successfully uploaded ${file.s3Key} to S3`);

          // Clean up local WAV file
          fs.unlinkSync(wavFile);
        } catch (err) {
          logger.error(`[AUDIO DEBUG] Failed to process ${file.source}: ${err.message}`);
        }
      }

      // Create and upload a summary file with call information
      if (uploadedFiles.length > 0) {
        const summaryData = {
          callId: callId,
          uploadTimestamp: timestamp,
          uploadDate: dateFolder,
          callStatistics: conn ? {
            audioChunksReceived: conn.audioChunksReceived || 0,
            audioChunksSent: conn.audioChunksSent || 0,
            validAudioChunksSent: conn.validAudioChunksSent || 0,
            lastCommitTime: conn.lastCommitTime ? new Date(conn.lastCommitTime).toISOString() : null,
            sessionReady: conn.sessionReady || false,
            debugFilesInitialized: conn._debugFilesInitialized || false,
            conversationId: conn.conversationId || null
          } : null,
          uploadedFiles: uploadedFiles.map(file => ({
            description: file.description,
            sizeMB: (file.originalSize / 1024 / 1024).toFixed(2),
            url: file.url,
            key: file.key
          }))
        };

        const summaryKey = `debug-audio/${dateFolder}/${callId}_${timestamp}/call_summary.json`;
        const summaryContent = JSON.stringify(summaryData, null, 2);

        try {
          await S3Service.uploadFile(Buffer.from(summaryContent), summaryKey, 'application/json', {
            callId: callId,
            uploadTimestamp: timestamp,
            uploadDate: dateFolder,
            type: 'call_summary'
          });
          logger.info(`[AUDIO DEBUG] Uploaded call summary to ${summaryKey}`);
        } catch (summaryErr) {
          logger.error(`[AUDIO DEBUG] Failed to upload call summary: ${summaryErr.message}`);
        }
      }

      // Log the download URLs in a clean format
      if (uploadedFiles.length > 0) {
        logger.info(`[AUDIO DEBUG] ===== DEBUG AUDIO READY FOR CALL ${callId} =====`);
        logger.info(`[AUDIO DEBUG] Upload Date: ${dateFolder} | Timestamp: ${timestamp}`);
        uploadedFiles.forEach((file) => {
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
  /**
 * Call this when a call ends to upload debug audio
 */
  async handleCallEnd(callId) {
    try {
      logger.info(`[OpenAI Call End] Processing call end for ${callId}`);

      // Get connection data before cleanup
      const conn = this.connections.get(callId);
      const conversationId = conn?.conversationId;
      const callType = conn?.callType || 'unknown';

      // SAVE ANY PENDING MESSAGES BEFORE CLEANUP
      if (conn) {
        // Save any pending user message
        if (conn.pendingUserTranscript && conn.pendingUserTranscript.trim()) {
          logger.info(`[OpenAI Call End] Saving pending user message for ${callId}`);
          
          // CRITICAL: If there's an active placeholder, UPDATE it instead of creating a new message
          if (conn.activeUserMessageId) {
            logger.info(`[OpenAI Call End] Updating existing placeholder ${conn.activeUserMessageId} with pending transcript`);
            const { Message } = require('../models');
            await Message.findByIdAndUpdate(
              conn.activeUserMessageId,
              { 
                content: conn.pendingUserTranscript.trim(),
                messageType: 'user_message',
              },
              { timestamps: false, runValidators: false }
            );
            conn.activeUserMessageId = null;
          } else {
            // No placeholder - create new message
            await this.saveCompleteMessage(callId, 'patient', conn.pendingUserTranscript);
          }
          
          conn.pendingUserTranscript = '';
        }

        // Save any pending assistant message
        if (conn.pendingAssistantTranscript) {
          logger.info(`[OpenAI Call End] Saving pending assistant message for ${callId}`);
          await this.saveCompleteMessage(callId, 'assistant', conn.pendingAssistantTranscript);
          conn.pendingAssistantTranscript = '';
        }

        // Clear context window for this patient when call ends
        if (conn.patientId) {
          try {
            const contextWindow = getConversationContextWindow();
            contextWindow.clearPatientContext(conn.patientId);
            logger.debug(`[Context Window] Cleared context for patient ${conn.patientId} at call end`);
          } catch (error) {
            logger.warn(`[Context Window] Failed to clear context: ${error.message}`);
          }
        }
      }

      // Upload debug audio for every call (enhanced functionality)
      logger.info(`[OpenAI Call End] Attempting debug audio upload for ${callId}...`);

      // Log call statistics before upload
      if (conn) {
        const stats = {
          audioChunksReceived: conn.audioChunksReceived || 0,
          audioChunksSent: conn.audioChunksSent || 0,
          validAudioChunksSent: conn.validAudioChunksSent || 0,
          lastCommitTime: conn.lastCommitTime ? new Date(conn.lastCommitTime).toISOString() : 'never',
          sessionReady: conn.sessionReady || false,
          debugFilesInitialized: conn._debugFilesInitialized || false
        };
        logger.info(`[OpenAI Call End] Call statistics for ${callId}:`, stats);
      }

      try {
        const uploadedFiles = await this.uploadDebugAudioToS3(callId, conn);

        // Save debug audio URLs to conversation if available
        if (uploadedFiles.length > 0 && conversationId) {
          try {
            const { Conversation } = require('../models');
            await Conversation.findByIdAndUpdate(conversationId, {
              debugAudioUrls: uploadedFiles.map(file => ({
                description: file.description,
                url: file.url,
                key: file.key
              }))
            });
            logger.info(`[OpenAI Call End] Saved ${uploadedFiles.length} debug audio URLs to conversation ${conversationId}`);
          } catch (updateErr) {
            logger.error(`[OpenAI Call End] Failed to save debug audio URLs: ${updateErr.message}`);
          }
        } else if (uploadedFiles.length === 0) {
          logger.info(`[OpenAI Call End] No debug audio files found to upload for ${callId}`);
        }
      } catch (audioErr) {
        logger.error(`[OpenAI Call End] Error uploading debug audio: ${audioErr.message}`);
      }

      // Finalize conversation with summary generation
      if (conversationId) {
        logger.info(`[OpenAI Call End] Finalizing conversation ${conversationId} (${callType} call)`);

        try {
          const conversationService = require('./conversation.service');
          const finalizationResult = await conversationService.finalizeConversation(
            conversationId,
            true // true = use realtime messages from Message collection
          );

          if (finalizationResult && finalizationResult.summary) {
            logger.info(`[OpenAI Call End] Successfully generated summary for conversation ${conversationId}: "${finalizationResult.summary.substring(0, 100)}..."`);
            
            if (finalizationResult.sentimentAnalysis) {
              logger.info(`[OpenAI Call End] Sentiment analysis completed: ${finalizationResult.sentimentAnalysis.overallSentiment} (score: ${finalizationResult.sentimentAnalysis.sentimentScore})`);
            }
          } else {
            logger.warn(`[OpenAI Call End] No summary generated for conversation ${conversationId}`);
          }

          // Note: Conversation status is already updated by finalizeConversation
          logger.info(`[OpenAI Call End] Conversation ${conversationId} finalized with summary and sentiment analysis`);

        } catch (summaryErr) {
          logger.error(`[OpenAI Call End] Error finalizing conversation ${conversationId}: ${summaryErr.message}`);

          // Still mark as completed even if summary fails
          try {
            const { Conversation } = require('../models');
            await Conversation.findByIdAndUpdate(conversationId, {
              endTime: new Date(),
              status: 'completed',
              callEndReason: 'normal_completion',
              summary: 'Summary generation failed - manual review needed'
            });
          } catch (fallbackErr) {
            logger.error(`[OpenAI Call End] Failed to update conversation status: ${fallbackErr.message}`);
          }
        }
      } else {
        logger.warn(`[OpenAI Call End] No conversation ID found for call ${callId}`);
      }

      logger.info(`[OpenAI Call End] Completed processing for call ${callId}`);

    } catch (err) {
      logger.error(`[OpenAI Call End] Error handling call end for ${callId}: ${err.message}`, err);
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
        { name: 'continuous_from_openai_pcm24k.raw', desc: 'OpenAI to Caller (PCM 24kHz)' },
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
   * Test basic WebSocket connection and session handshake with OpenAI
   */
  async testBasicConnectionAndSession(testId = `test-${Date.now()}`) {
    return new Promise((resolve, reject) => {
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
            message: `Test timed out after ${CONSTANTS.TEST_CONNECTION_TIMEOUT}ms`,
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
            'OpenAI-Beta': 'realtime=v1',
          },
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
              data: message,
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
                output_audio_format: 'g711_ulaw',
              },
              _testWebSocket: wsClient,
              _testId: testId,
            };

            try {
              await this.sendJsonMessage(null, sessionConfig);
            } catch (sendErr) {
              if (wsClient)
                cleanupAndFinish('reject', {
                  status: 'error_sending_session_update',
                  message: sendErr.message,
                });
            }
          } else if (message.type === 'session.updated') {
            sessionUpdatedReceived = true;
            logger.info(`[OpenAI TestConn] Session updated`);
            if (sessionCreatedReceived) {
              if (wsClient)
                cleanupAndFinish('resolve', {
                  status: 'success',
                  message: 'Session created and updated successfully',
                  sessionId: openAIResponseSessionId || message.session?.id,
                  sessionDetails: {
                    session: {
                      input_audio_format: 'g711_ulaw',
                      output_audio_format: 'g711_ulaw',
                      voice: config.openai.realtimeVoice || 'alloy',
                      model: config.openai.realtimeModel || 'gpt-4o-realtime-preview-2024-12-17'
                    }
                  },
                  receivedMessages,
                });
            }
          } else if (message.type === 'error') {
            logger.error(`[OpenAI TestConn] Error: ${JSON.stringify(message.error)}`);
            if (wsClient)
              cleanupAndFinish('reject', {
                status: 'openai_error',
                error: message.error,
                sessionId: openAIResponseSessionId,
              });
          }
        });

        wsClient.on('error', (error) => {
          logger.error(`[OpenAI TestConn] WebSocket error: ${error.message}`);
          if (wsClient)
            cleanupAndFinish('reject', {
              status: 'ws_error',
              message: error.message,
              sessionId: openAIResponseSessionId,
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
              sessionUpdated: sessionUpdatedReceived,
            });
          }
        });
      } catch (err) {
        logger.error(`[OpenAI TestConn] Error creating WebSocket: ${err.message}`, err);
        cleanupAndFinish('reject', {
          status: 'init_error',
          message: err.message,
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
        const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 16383; // Half amplitude
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

  stopTranscriptCleanupInterval() {
    if (this._transcriptCleanupInterval) {
      clearInterval(this._transcriptCleanupInterval);
      this._transcriptCleanupInterval = null;
      logger.info('[OpenAI Realtime] Stopped transcript cleanup interval');
    }
  }
} // End OpenAIRealtimeService Class

// Ensure only one instance is created and exported
let openAIRealtimeServiceInstance = null;

function getOpenAIServiceInstance() {
  if (!openAIRealtimeServiceInstance) {
    openAIRealtimeServiceInstance = new OpenAIRealtimeService();

    // Only start intervals if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      openAIRealtimeServiceInstance.startHealthCheck();
      openAIRealtimeServiceInstance.startTranscriptCleanupInterval();
    }
  }
  return openAIRealtimeServiceInstance;
}

// Export both the singleton instance and the class for testing
module.exports = getOpenAIServiceInstance();
module.exports.OpenAIRealtimeService = OpenAIRealtimeService;
module.exports.getOpenAIServiceInstance = getOpenAIServiceInstance;