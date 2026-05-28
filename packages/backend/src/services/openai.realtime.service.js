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
 * 1. User speaks → placeholder row created on speech_started (after greeting)
 * 2. OpenAI ASR → conversation.item.input_audio_transcription.delta (debounced) and .completed
 * 3. Transcript text is written to the placeholder immediately (notify → DB), not only on speech_stopped; emergency detection runs after that
 * 4. speech_stopped: filler-only ASR (e.g. "um" alone) gets a final line persisted, no response; not deleted
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
 *
 * LIVE UI ORDER (caregiver polling):
 * User and assistant rows are still created with "[Speaking...]" in the DB and via notify immediately.
 * We only defer replacing the *assistant* row with Bianca's final transcript until the *user* row is no
 * longer "[Speaking...]" (real ASR or placeholder removed). User live text still streams as today.
 *
 * CONCURRENCY: `this.connections` is a Map keyed by callId (Twilio SID / primary call key). Every field
 * involved in ordering — `_deferredAssistantQueue`, active placeholder ids, pending transcripts — lives on
 * that per-call connection object only. Ordered delivery is per-call; concurrent calls never share a queue.
 */

const WebSocket = require('ws');
const mongoose = require('mongoose');
const { Buffer } = require('buffer');
const config = require('../config/config');
const logger = require('../config/logger');
const { Call, Client, Conversation, Message, Org } = require('../models'); // Assuming Message model is used for saving transcripts
const AudioUtils = require('../api/audio.utils'); // Assumes this uses alawmulaw and has resamplePcm
const { emergencyProcessor } = require('./emergencyProcessor.service');
const { getConversationContextWindow } = require('../utils/conversationContextWindow');

/** User/assistant row placeholder while audio is in flight (must match DB content for ordering checks). */
const SPEAKING_PLACEHOLDER_TEXT = '[Speaking...]';

// STRANGLER FIG: Import new modular components (backward compatible)
const { CONVERSATION_STATES: NEW_CONVERSATION_STATES, StateMachine } = require('./ai/realtime/state.machine');
const CONSTANTS = require('./ai/realtime/constants');
const ReconnectionManager = require('./ai/realtime/reconnection.manager');
const AudioProcessor = require('./ai/realtime/audio.processor');
const ConnectionManager = require('./ai/realtime/connection.manager');
const MessageHandler = require('./ai/realtime/message.handler');
const { isFiller } = require('./ai/realtime/filler-words');

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
    const fromState = StateMachine.getCurrentState(conn);
    const ok = StateMachine.transition(conn, newState, reason);
    if (ok && newState === CONVERSATION_STATES.AI_RESPONDING) {
      logger.info(`[RealtimeRC] enter AI_RESPONDING ${callId}`, {
        reason,
        fromState,
        _responseCreateInFlight: conn._responseCreateInFlight,
        _responseCreated: conn._responseCreated,
        _aiIsSpeaking: conn._aiIsSpeaking,
        _pendingUserResponseAfterAiStops: conn._pendingUserResponseAfterAiStops,
        _waitingForUserTranscript: conn._waitingForUserTranscript,
      });
    }
    return ok;
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

  _clearAiAudioCompleteDebounceTimer(conn) {
    if (conn?._aiAudioCompleteDebounceTimer) {
      clearTimeout(conn._aiAudioCompleteDebounceTimer);
      conn._aiAudioCompleteDebounceTimer = null;
    }
  }

  /** Fallback if `response.output_audio.done` is not emitted for this session. */
  _scheduleAiAudioCompleteDebounced(callId, conn) {
    if (!conn) return;
    this._clearAiAudioCompleteDebounceTimer(conn);
    conn._aiAudioCompleteDebounceTimer = setTimeout(() => {
      const c = this.connections.get(callId);
      if (!c || !c._aiIsSpeaking) return;
      if (c._aiAudioComplete) return;
      c._aiAudioComplete = true;
      c._aiAudioCompleteDebounceTimer = null;
      logger.info(
        `[RealtimeRC] ${callId}: _aiAudioComplete=true (150ms debounce after last output_audio.delta)`
      );
    }, 150);
  }

  /** New assistant audio turn: clear completion / delta tracking (per conn). */
  _resetAssistantOutputAudioLifecycle(conn) {
    if (!conn) return;
    conn._aiAudioComplete = false;
    conn._aiOutputAudioDeltaSeen = false;
    this._clearAiAudioCompleteDebounceTimer(conn);
  }

  _markAssistantPlaybackActive(conn) {
    if (!conn) return;
    conn._aiAudioPlaybackComplete = false;
  }

  _syncAiAudioPlaybackCompleteFromRtp(callId, conn) {
    if (!conn) return;
    const rtpSenderService = require('./rtp.sender.service');
    conn._aiAudioPlaybackComplete = rtpSenderService.isPlaybackComplete(callId);
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

  /** Notify subscribers of assistant message content (placeholder "[Speaking...]" or final transcript). Per-callId via notifyCallback. */
  notifyAssistantTranscript(callId, conversationId, messageId, transcript) {
    if (!conversationId || !messageId || transcript == null) return;
    this.notify(callId, 'assistant_transcript_updated', {
      messageId: messageId.toString(),
      conversationId,
      transcript: typeof transcript === 'string' ? transcript : String(transcript),
    });
  }

  async appendAudioToLocalFile(callId, pcmBuffer) {
    const conn = this.connections.get(callId);
    const allow = process.env.OPENAI_DEBUG_AUDIO === 'true' || conn?.debugAudioUploadEnabled;
    if (!allow) return;

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
  async initialize(initialAsteriskChannelId, callSid, conversationId, initialPrompt, clientId = null, realtimeOptions = null) {
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
    logger.info(`[OpenAI Realtime] Using GA API`);
    logger.info(`[OpenAI Realtime] Model: ${config.openai.realtimeModel || 'gpt-realtime'}`);
    logger.info(`[OpenAI Realtime] Transcription: ${config.openai.realtimeTranscriptionModel || 'gpt-4o-mini-transcribe'}`);
    logger.info(`[OpenAI Realtime] Initial prompt: "${initialPrompt?.substring(0, 100)}..."`);
    if (clientId) {
      logger.info(`[OpenAI Realtime] Emergency detection enabled for client: ${clientId}`);
    }

    let preferredLanguage = 'en';
    if (clientId) {
      try {
        const client = await Client.findById(clientId).select('preferredLanguage').lean();
        if (client?.preferredLanguage) {
          preferredLanguage = client.preferredLanguage;
        }
        logger.info(`[OpenAI Realtime] Input transcription language (client preferred): ${preferredLanguage}`);
      } catch (err) {
        logger.warn(`[OpenAI Realtime] Could not load client preferredLanguage for ${clientId}: ${err.message}`);
      }
    }

    // Ensure Conversation exists (for outbound calls, it might not exist yet)
    let finalConversationId = conversationId;
    if (!finalConversationId && callSid) {
      try {
        // Find the Call record
        const call = await Call.findOne({ callSid });
        if (call) {
          // Conversation should already exist (created when call was initiated)
          // But handle the case where it might not exist (backward compatibility)
          let conversation = await Conversation.findOne({ callId: call._id });
          if (!conversation) {
            // Fallback: Create Conversation if it doesn't exist (shouldn't normally happen)
            logger.warn(`[OpenAI Realtime] Conversation not found for call ${call._id}, creating fallback conversation`);
            conversation = await Conversation.create({
              callId: call._id,
              clientId: call.clientId,
            });
            
            // Update Call with conversation reference
            call.conversationId = conversation._id;
            await call.save();
            
            logger.info(`[OpenAI Realtime] Created fallback Conversation ${conversation._id} for call ${call._id}`);
          } else {
            logger.info(`[OpenAI Realtime] Using existing Conversation ${conversation._id} for call ${call._id}`);
          }
          finalConversationId = conversation._id.toString();
        }
      } catch (err) {
        logger.error(`[OpenAI Realtime] Error ensuring Conversation exists: ${err.message}`);
        // Continue with provided conversationId or null
      }
    }

    const onboardingDay =
      realtimeOptions && realtimeOptions.onboardingDay >= 1 && realtimeOptions.onboardingDay <= 4
        ? realtimeOptions.onboardingDay
        : null;
    const onboardingCallMongoId = realtimeOptions?.onboardingCallMongoId || null;

    let orgId = null;
    let debugAudioUploadEnabled = false;
    if (clientId) {
      try {
        const clientRow = await Client.findById(clientId).select('org').lean();
        if (clientRow?.org) {
          orgId = clientRow.org.toString();
          const orgRow = await Org.findById(clientRow.org).select('debugAudioUploadEnabled').lean();
          debugAudioUploadEnabled = orgRow?.debugAudioUploadEnabled === true;
        }
      } catch (orgErr) {
        logger.warn(`[OpenAI Realtime] Could not load org for debug-audio flag (client ${clientId}): ${orgErr.message}`);
      }
    }
    if (process.env.OPENAI_DEBUG_AUDIO === 'true') {
      debugAudioUploadEnabled = true;
    }

    this.connections.set(callId, {
      status: 'initializing',
      conversationId: finalConversationId,
      callSid, // Store the Twilio CallSid if provided
      asteriskChannelId: initialAsteriskChannelId, // Store the Asterisk channel ID
      clientId,
      orgId,
      debugAudioUploadEnabled,
      onboardingDay,
      onboardingCallMongoId,
      preferredLanguage,
      webSocket: null,
      sessionReady: false,
      /** True after first successful session.updated (Realtime usable). Onboarding must not advance if this stays false. */
      realtimeSessionEstablished: false,
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

      // Per-call only: assistant transcripts waiting for user row to leave [Speaking...] (concurrent calls each have their own array)
      _deferredAssistantQueue: [],
      // --- Realtime turn / response guards: all live on this object only (this.connections.get(callId)), never on the service singleton ---
      // Transcript-ordering / dual-talk: user speech_stopped while _aiIsSpeaking — defer response.create until response.done clears the guard
      _pendingUserResponseAfterAiStops: false,
      // True after response.create was sent for the current user utterance (speech_started → speech_stopped cycle). Cleared on speech_started.
      // Prevents handleInputAudioTranscriptionCompleted (_waitingForUserTranscript late path) from scheduling a second send when speech_stopped's 200ms timer already ran at T+200 while _waitingForUserTranscript was set at T+500.
      _userTurnResponseCreateSent: false,
      // True from websocket send of response.create until response.created ack (or cleanup). Unlike _responseCreated, which is set only on that event.
      _responseCreateInFlight: false,
      _responseCreated: false,
      _aiIsSpeaking: false,
      // True after at least one response.output_audio.delta this turn (avoids treating pre-audio "optimistic" _aiIsSpeaking as barge-in).
      _aiOutputAudioDeltaSeen: false,
      // True when output audio stream finished (response.output_audio.done or debounce after last delta); still before response.done.
      _aiAudioComplete: false,
      _aiAudioCompleteDebounceTimer: null,
      // True only when RTP outbound queue is drained (see rtp.sender isPlaybackComplete); used for barge-in cancel.
      _aiAudioPlaybackComplete: true,
      // One 500ms speech_stopped finalize pass per utterance; duplicate VAD speech_stopped must not stack timers.
      _speechStoppedFinalizePending: false,
      _speechStoppedFinalizeTimer: null,
      // True after speech_stopped transitioned to AI_RESPONDING (200ms send pending); duplicate VAD must not re-run main path.
      _speechStoppedCommittedAiResponding: false,
      // Set in speech_stopped 500ms path when placeholder exists but ASR not ready yet; cleared when ASR completes or on cleanup paths.
      _waitingForUserTranscript: false,
      // FIX: Bug 1 — dedup duplicate OpenAI .completed for same item_id; cleared each new user utterance (speech_started) and in cleanup
      _processedTranscriptItemIds: new Set(),
      // Set true after we handle a .completed in this user turn (avoids 500ms fallback + ASR both inserting)
      _asrTranscriptionEventHandledThisTurn: false,
      // Set at speech start of an utterance; at speech_stopped, duration = now - this (and FIX Bug 2 min response gate)
      _turnSpeechStartTime: null,
      _turnSpeechDurationMs: 0,
      // When response.done runs (incl. cancel path); for stale-pending and stuck-recovery guards
      _lastResponseDoneAt: null,
      // Set whenever _pendingUserResponseAfterAiStops becomes true; compared to _lastResponseDoneAt in maybeFlush
      _pendingStopsSetAt: null,

      // Track timing for each speaker
      lastUserSpeechTime: null,
      lastAssistantSpeechTime: null,
      _userHasSpoken: false, // Track if user has spoken to trigger first response
      _waitingForInitialGreeting: true, // Track if we're waiting for Bianca's initial greeting
      _initialGreetingTriggered: false, // Prevent multiple initial greeting triggers
      /** Set true on first response.output_audio.delta; until then, user mic is not sent to input_audio_buffer (no pending queue). */
      _userInputToOpenAIAllowed: false,
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
   * Temporary diagnostic logging for the "two-utterance" / missed response.create investigation.
   * Grep logs with: [RealtimeRC]
   */
  _rcDiagSpeechStopped(callId, conn, phase, extra = {}) {
    if (!conn) return;
    const lang = conn.preferredLanguage || 'en';
    const pending = conn.pendingUserTranscript || '';
    let isFillerResult = null;
    try {
      isFillerResult = pending.trim() ? isFiller(pending, lang) : null;
    } catch (e) {
      isFillerResult = `error:${e.message}`;
    }
    const timeSinceGreeting = conn._initialGreetingCompletedAt
      ? Date.now() - conn._initialGreetingCompletedAt
      : null;
    logger.info(`[RealtimeRC] speech_stopped:${phase} ${callId}`, {
      conversationState: this.getConversationState(callId),
      canAIRespond: this.canAIRespond(callId),
      canUserSpeak: this.canUserSpeak(callId),
      _aiIsSpeaking: conn._aiIsSpeaking,
      _responseCreateInFlight: conn._responseCreateInFlight,
      _responseCreated: conn._responseCreated,
      _responseStartTime: conn._responseStartTime,
      isInGracePeriod: this.isInGracePeriod(callId),
      timeSinceGreetingMs: timeSinceGreeting,
      gracePeriodMs: CONSTANTS.GRACE_PERIOD_MS,
      pendingUserTranscriptLen: pending.length,
      pendingPreview: pending.length > 160 ? `${pending.slice(0, 160)}…` : pending,
      isFiller: isFillerResult,
      preferredLanguage: lang,
      _pendingUserResponseAfterAiStops: conn._pendingUserResponseAfterAiStops,
      _responseCanceled: conn._responseCanceled,
      _waitingForUserTranscript: conn._waitingForUserTranscript,
      ...extra,
    });
  }

  /**
   * @param {string} outcome 'SENT' | 'BLOCKED'
   */
  _rcDiagSendResponseCreate(callId, connection, outcome, reason, extra = {}) {
    logger.info(`[RealtimeRC] sendResponseCreate:${outcome} ${callId}`, {
      reason,
      conversationState: connection ? this.getConversationState(callId) : null,
      canAIRespond: connection ? this.canAIRespond(callId) : null,
      _aiIsSpeaking: connection?._aiIsSpeaking,
      _responseCreateInFlight: connection?._responseCreateInFlight,
      _responseCreated: connection?._responseCreated,
      sessionReady: connection?.sessionReady,
      wsReadyState: connection?.webSocket?.readyState,
      ...extra,
    });
  }

  /**
   * Increase server VAD `silence_duration_ms` for this call when the first assistant audio chunk arrives
   * while OpenAI still considers the user to be in the "speaking" state (turn overlap / premature end-of-utterance).
   */
  async _bumpVadOnAssistantOverUser(callId, conn) {
    if (!callId || !conn) return;
    const { adaptiveSilence, silenceDurationMs: baseMs } = config.audio?.turnDetection || {};
    if (adaptiveSilence?.enabled === false) return;
    if (!conn.sessionReady || !conn._userIsSpeaking) return;

    const stepMs = Math.max(1, adaptiveSilence?.stepMs ?? 200);
    // Ceiling is at least the static base so a high `AUDIO_TURN_DETECTION_SILENCE_DURATION_MS` is never stuck under `maxMs`.
    const maxMs = Math.max(baseMs ?? 500, Math.max(200, adaptiveSilence?.maxMs ?? 2000));
    const current = Number.isFinite(conn.vadSilenceDurationMs)
      ? conn.vadSilenceDurationMs
      : (baseMs ?? 500);
    if (current >= maxMs) return;
    const next = Math.min(maxMs, current + stepMs);
    if (next <= current) return;

    const prev = conn.vadSilenceDurationMs;
    try {
      conn.vadSilenceDurationMs = next;
      await this.sendJsonMessage(callId, MessageHandler.buildSessionUpdateForVad(conn));
      logger.info(
        `[RealtimeRC] adaptive VAD: silence_duration_ms ${current}→${next} (assistant audio while user_speaking) callId=${callId}`
      );
    } catch (e) {
      if (Number.isFinite(prev) && prev > 0) {
        conn.vadSilenceDurationMs = prev;
      } else {
        delete conn.vadSilenceDurationMs;
      }
      logger.error(
        `[OpenAI Realtime] Adaptive VAD session.update failed for ${callId}: ${e?.message || e}`
      );
    }
  }

  _clearResponseStuckRecoveryTimers(conn) {
    if (conn._responseStuckRecoveryTimeout) {
      clearTimeout(conn._responseStuckRecoveryTimeout);
      conn._responseStuckRecoveryTimeout = null;
    }
    if (conn._responseStuckRecoveryInnerTimeout) {
      clearTimeout(conn._responseStuckRecoveryInnerTimeout);
      conn._responseStuckRecoveryInnerTimeout = null;
    }
    if (conn._responseAggressiveInterval) {
      clearInterval(conn._responseAggressiveInterval);
      conn._responseAggressiveInterval = null;
    }
  }

  /**
   * Send response.create to trigger OpenAI to generate responses - ENHANCED with diagnostics
   */
  /**
   * @returns {Promise<boolean>} True if response.create was sent on the wire; false if blocked or send threw.
   */
  async sendResponseCreate(callId) {
    logger.info(`[OpenAI Realtime] DEBUG: sendResponseCreate called for ${callId}`);
    const connection = this.connections.get(callId);
    if (!connection) {
      this._rcDiagSendResponseCreate(callId, null, 'BLOCKED', 'no_connection');
      logger.info(`[RealtimeRC] sendResponseCreate:BLOCKED reason=no_connection callId=${callId}`);
      logger.error(`[OpenAI Realtime] CRITICAL: Cannot send response.create - no connection object for ${callId}`);
      return false;
    }

    if (!connection.webSocket) {
      this._rcDiagSendResponseCreate(callId, connection, 'BLOCKED', 'no_websocket');
      logger.info(`[RealtimeRC] sendResponseCreate:BLOCKED reason=no_websocket callId=${callId}`);
      logger.error(`[OpenAI Realtime] CRITICAL: Cannot send response.create - no WebSocket for ${callId}`);
      return false;
    }

    if (connection.webSocket.readyState !== WebSocket.OPEN) {
      this._rcDiagSendResponseCreate(callId, connection, 'BLOCKED', 'websocket_not_open', {
        readyState: connection.webSocket.readyState,
      });
      logger.info(
        `[RealtimeRC] sendResponseCreate:BLOCKED reason=websocket_not_open callId=${callId} readyState=${connection.webSocket.readyState}`
      );
      logger.error(`[OpenAI Realtime] CRITICAL: Cannot send response.create - WebSocket not open for ${callId} (state: ${connection.webSocket.readyState})`);
      return false;
    }

    if (!connection.sessionReady) {
      this._rcDiagSendResponseCreate(callId, connection, 'BLOCKED', 'session_not_ready');
      logger.info(`[RealtimeRC] sendResponseCreate:BLOCKED reason=not_session_ready callId=${callId}`);
      logger.error(`[OpenAI Realtime] CRITICAL: Cannot send response.create - session not ready for ${callId}`);
      return false;
    }

    // STATE MACHINE: Check if we can create a response in current state
    if (!this.canAIRespond(callId)) {
      const currentState = this.getConversationState(callId);
      this._rcDiagSendResponseCreate(callId, connection, 'BLOCKED', 'canAIRespond_false', { currentState });
      logger.info(
        `[RealtimeRC] sendResponseCreate:BLOCKED reason=canAIRespond_false callId=${callId} state=${currentState}`
      );
      logger.warn(`[OpenAI Realtime] Cannot create response in state ${currentState} for ${callId}`);
      return false;
    }

    // _responseCreated is set when OpenAI emits response.created, not when we send — so it does not close the
    // gap between send and ack (e.g. double speech_stopped + deferred flush within ~200ms). Guard with in-flight.
    if (connection._responseCreateInFlight) {
      this._rcDiagSendResponseCreate(callId, connection, 'BLOCKED', 'response_create_already_in_flight');
      logger.info(
        `[RealtimeRC] sendResponseCreate:BLOCKED reason=response_create_already_in_flight callId=${callId}`
      );
      logger.warn(
        `[OpenAI Realtime] response.create already in flight for ${callId} — skipping duplicate sendResponseCreate`
      );
      return false;
    }
    this._clearResponseStuckRecoveryTimers(connection);
    connection._stuckResponseRecoveryStartSnapshot = null;
    connection._responseCreateInFlight = true;
    this._markAssistantPlaybackActive(connection);

    try {
      const useGA = config.openai.useGA !== undefined ? config.openai.useGA : false;
      // GA Realtime rejects response.modalities; session output_modalities already set in session.update.
      const responseCreateEvent = useGA
        ? { type: 'response.create' }
        : {
            type: 'response.create',
            response: {
              modalities: ['text', 'audio'],
            },
          };

      const messageStr = JSON.stringify(responseCreateEvent);
      connection.webSocket.send(messageStr);
      this._rcDiagSendResponseCreate(callId, connection, 'SENT', 'websocket_send_ok');
      logger.info(`[RealtimeRC] sendResponseCreate:SENT callId=${callId}`);
      // Don't set _responseCreated for initial greeting - allow commits
      connection._responseStartTime = Date.now(); // Track when response was created
      const responseStartSnapshot = connection._responseStartTime;
      logger.info(`[OpenAI Realtime] SUCCESS: Sent response.create for ${callId}`);
      logger.debug(`[OpenAI Realtime] Response.create payload: ${messageStr}`);

      // STATE MACHINE: Transition to appropriate state based on current state
      const currentState = this.getConversationState(callId);
      if (currentState === CONVERSATION_STATES.WAITING_FOR_GREETING) {
        this.transitionState(callId, CONVERSATION_STATES.GREETING_ACTIVE, 'initial_greeting_triggered');
      } else if (currentState === CONVERSATION_STATES.GREETING_COMPLETE || currentState === CONVERSATION_STATES.CONVERSATION_ACTIVE) {
        this.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'ai_response_triggered');
      }

      // Stuck-response recovery: only applies to the same response.create (snapshot of _responseStartTime).
      // A prior bug compared currentConn._responseStartTime to connection._responseStartTime; both are the
      // same object field, so the check was always true and a greeting 20s timer could fire during the next user turn.
      connection._responseStuckRecoveryTimeout = setTimeout(() => {
        const currentConn = this.connections.get(callId);
        if (
          currentConn &&
          currentConn._responseCreated &&
          currentConn._responseStartTime === responseStartSnapshot
        ) {
          logger.warn(`[OpenAI Realtime] Response timeout for ${callId} - resetting response flag after 20 seconds`);
          currentConn._stuckResponseRecoveryStartSnapshot = responseStartSnapshot;
          currentConn._responseCreated = false;
          currentConn._responseCreateInFlight = false;
          currentConn._responseStartTime = null;

          // Force a new response generation after timeout
          currentConn._responseStuckRecoveryInnerTimeout = setTimeout(async () => {
            try {
              const c = this.connections.get(callId);
              if (!c || c._stuckResponseRecoveryStartSnapshot !== responseStartSnapshot) {
                return;
              }
              c._stuckResponseRecoveryStartSnapshot = null;

              // FIX: Bug 3 (stuck 20s path) — response may have completed during the outer timeout window
              if (c._lastResponseDoneAt != null && c._lastResponseDoneAt > responseStartSnapshot) {
                logger.info(`[RealtimeRC] Stuck timer (20s/inner) — response already completed, cancelling for ${callId}`);
                return;
              }

              // Check grace period to prevent dual responses after initial greeting
              const timeSinceGreeting = c._initialGreetingCompletedAt
                ? Date.now() - c._initialGreetingCompletedAt
                : Infinity;
              const GRACE_PERIOD_MS = 3000; // 3 seconds to clear lingering audio from connection/transfer

              if (timeSinceGreeting < GRACE_PERIOD_MS) {
                logger.info(
                  `[OpenAI Realtime] Skipping timeout recovery for ${callId} - in grace period ` +
                    `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${GRACE_PERIOD_MS}ms)`
                );
                return;
              }

              logger.info(`[OpenAI Realtime] Attempting to generate new response after timeout for ${callId}`);
              await this.sendResponseCreate(callId);
            } catch (err) {
              logger.error(`[OpenAI Realtime] Failed to generate new response after timeout for ${callId}: ${err.message}`);
            }
          }, 1000);
        }
      }, 20000); // 20 second timeout

      // A more aggressive timeout check every 5 seconds (same response only)
      connection._responseAggressiveInterval = setInterval(() => {
        const currentConn = this.connections.get(callId);
        if (currentConn && currentConn._responseStartTime !== responseStartSnapshot) {
          if (currentConn._responseAggressiveInterval) {
            clearInterval(currentConn._responseAggressiveInterval);
            currentConn._responseAggressiveInterval = null;
          }
          return;
        }
        if (currentConn && currentConn._responseCreated && currentConn._responseStartTime) {
          const responseAge = Date.now() - currentConn._responseStartTime;
          if (responseAge > 30000) {
            // 30 seconds
            logger.warn(
              `[OpenAI Realtime] Aggressive timeout for ${callId} - response stuck for ${responseAge}ms, forcing reset`
            );
            currentConn._stuckResponseRecoveryStartSnapshot = responseStartSnapshot;
            currentConn._responseCreated = false;
            currentConn._responseCreateInFlight = false;
            currentConn._responseStartTime = null;
            if (currentConn._responseAggressiveInterval) {
              clearInterval(currentConn._responseAggressiveInterval);
              currentConn._responseAggressiveInterval = null;
            }

            // Force a new response generation
            currentConn._responseStuckRecoveryInnerTimeout = setTimeout(async () => {
              try {
                const c = this.connections.get(callId);
                if (!c || c._stuckResponseRecoveryStartSnapshot !== responseStartSnapshot) {
                  return;
                }
                c._stuckResponseRecoveryStartSnapshot = null;

                // FIX: Bug 3 (stuck 30s path) — same as 20s inner: avoid second response if response.done won the race
                if (c._lastResponseDoneAt != null && c._lastResponseDoneAt > responseStartSnapshot) {
                  logger.info(
                    `[RealtimeRC] Stuck timer (aggressive/inner) — response already completed, cancelling for ${callId}`
                  );
                  return;
                }

                const timeSinceGreeting = c._initialGreetingCompletedAt
                  ? Date.now() - c._initialGreetingCompletedAt
                  : Infinity;
                const GRACE_PERIOD_MS = 3000; // 3 seconds to clear lingering audio from connection/transfer

                if (timeSinceGreeting < GRACE_PERIOD_MS) {
                  logger.info(
                    `[OpenAI Realtime] Skipping aggressive timeout recovery for ${callId} - in grace period ` +
                      `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${GRACE_PERIOD_MS}ms)`
                  );
                  return;
                }

                logger.info(`[OpenAI Realtime] Attempting to generate new response after aggressive timeout for ${callId}`);
                await this.sendResponseCreate(callId);
              } catch (err) {
                logger.error(
                  `[OpenAI Realtime] Failed to generate new response after aggressive timeout for ${callId}: ${err.message}`
                );
              }
            }, 1000);
          }
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
      return true;
    } catch (err) {
      connection._responseCreateInFlight = false;
      this._rcDiagSendResponseCreate(callId, connection, 'BLOCKED', 'send_threw', { error: err.message });
      logger.info(
        `[RealtimeRC] sendResponseCreate:BLOCKED reason=send_threw callId=${callId} error=${err.message}`
      );
      logger.error(`[OpenAI Realtime] CRITICAL: Error sending response.create for ${callId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Initial greeting: transition once, then response.create after session is applied (create_response:false relies on us).
   * Retries on a later session.updated if the first send was blocked. Does not set _initialGreetingTriggered until send succeeds.
   */
  async _sendInitialGreetingIfNeeded(callId) {
    const conn = this.connections.get(callId);
    if (!conn || conn._initialGreetingTriggered) {
      return;
    }
    if (conn._initialGreetingSendInProgress) {
      return;
    }

    conn._initialGreetingSendInProgress = true;
    try {
      conn._waitingForInitialGreeting = true;

      const state = this.getConversationState(callId);
      if (state === CONVERSATION_STATES.INITIALIZING) {
        if (!this.transitionState(callId, CONVERSATION_STATES.WAITING_FOR_GREETING, 'session_ready')) {
          logger.warn(
            `[OpenAI Realtime] Cannot transition to WAITING_FOR_GREETING for ${callId} (state=${state}) — greeting deferred for retry`
          );
          return;
        }
      } else if (state !== CONVERSATION_STATES.WAITING_FOR_GREETING) {
        return;
      }

      await new Promise((r) => setTimeout(r, CONSTANTS.INITIAL_GREETING_AFTER_SESSION_READY_MS));

      logger.info(
        `[RealtimeRC] greeting: about to call sendResponseCreate, sessionReady=${conn.sessionReady}, state=${this.getConversationState(callId)}, _waitingForInitialGreeting=${conn._waitingForInitialGreeting} ${callId}`
      );

      const sent = await this.sendResponseCreate(callId);

      logger.info(
        `[RealtimeRC] greeting: sendResponseCreate returned callId=${callId} sent=${sent} state=${this.getConversationState(callId)} _responseCreateInFlight=${conn._responseCreateInFlight}`
      );

      if (sent) {
        conn._initialGreetingTriggered = true;
        logger.info(`[OpenAI Realtime] Initial greeting response.create sent for ${callId}`);
      } else {
        logger.warn(
          `[RealtimeRC] greeting sendResponseCreate did not send (blocked) — will retry on next session.updated if connection still waiting ${callId}`,
          {
            conversationState: this.getConversationState(callId),
            _responseCreateInFlight: conn._responseCreateInFlight,
          }
        );
      }
    } finally {
      conn._initialGreetingSendInProgress = false;
    }
  }

  /**
   * Handle WebSocket open event
   */
  async handleOpen(callId) {
    // Always use GA API
    const apiVersion = 'GA';
    logger.info(`[OpenAI Realtime] WebSocket opened for callId: ${callId} (${apiVersion} API)`);
    const c = this.connections.get(callId);
    if (c) {
      c._realtimeRcLoggedFirstOutputAudioDelta = false;
    }
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
    // Always use GA API
    const apiVersion = 'GA';
    logger.error(`[OpenAI Realtime] WebSocket error for ${callId} (${apiVersion}): ${error.message}`);
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
    // Always use GA API
    const apiVersion = 'GA';
    logger.info(`[OpenAI Realtime] WebSocket closed for ${callId} (${apiVersion}). Code: ${code}, Reason: ${reasonStr}`);

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
      currentConnState._responseCreateInFlight = false;

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
      logger.error(`[OpenAI Realtime] API Version: GA, Raw message (first 500 chars): ${data.toString().substring(0, 500)}`);
      return;
    }

    const conn = this.connections.get(callId);
    if (!conn) {
      logger.warn(`[OpenAI Realtime] Received message for non-existent connection ${callId}. Discarding.`);
      return;
    }
    conn.lastActivity = Date.now();

    // Log all message types for debugging
    // Always use GA API
    const apiVersion = 'GA';
    logger.info(`[OpenAI Realtime] RECEIVED from OpenAI (${callId}, ${apiVersion}): type=${message.type}`);

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

        case 'response.audio.delta':  // Beta event name (legacy, should not occur with GA)
        case 'response.output_audio.delta':  // GA event name
          {
            const eventType = message.type;
            
            // Log that we received the event
            logger.info(`[OpenAI Realtime] Received ${eventType} event for ${callId} (GA), delta length: ${message.delta?.length || 0}`);
            if (conn && !conn._realtimeRcLoggedFirstOutputAudioDelta) {
              conn._realtimeRcLoggedFirstOutputAudioDelta = true;
              logger.info(
                `[RealtimeRC] first response.output_audio.delta callId=${callId} waitingForInitialGreeting=${Boolean(conn._waitingForInitialGreeting)} deltaLen=${message.delta?.length || 0}`
              );
            }

            if (conn && !conn._userInputToOpenAIAllowed) {
              conn._userInputToOpenAIAllowed = true;
              logger.info(
                `[OpenAI Realtime] User mic → OpenAI enabled for ${callId} (first assistant output audio delta received)`
              );
            }
            
            // Track that AI is speaking
            if (conn && !conn._aiIsSpeaking) {
              this._resetAssistantOutputAudioLifecycle(conn);
              this._markAssistantPlaybackActive(conn);
              conn._aiIsSpeaking = true;
              conn._lastAiSpeechStart = Date.now();
              logger.info(`[OpenAI Realtime] AI STARTED SPEAKING for ${callId} (${apiVersion})`);

              // If assistant output begins while VAD still marks the user as speaking, the model is overlapping the caller; increase end-of-utterance patience for this call.
              if (conn._userIsSpeaking) {
                void this._bumpVadOnAssistantOverUser(callId, conn);
              }
              
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

            if (conn) {
              conn._aiOutputAudioDeltaSeen = true;
              conn._aiAudioComplete = false;
              this._scheduleAiAudioCompleteDebounced(callId, conn);
            }

            // STRANGLER FIG: Use MessageHandler for audio delta processing
            const processed = MessageHandler.handleResponseAudioDelta(
              conn,
              message,
              (audioBase64) => this.processAudioResponse(callId, audioBase64)
            );
            
            if (!processed) {
              logger.warn(`[OpenAI Realtime] Failed to process ${eventType} for ${callId}`);
            }
          }
          break;

        case 'response.audio.done': // Beta
        case 'response.output_audio.done': // GA — output audio stream finished (before response.done)
          if (conn) {
            this._clearAiAudioCompleteDebounceTimer(conn);
            conn._aiAudioComplete = true;
            logger.info(`[RealtimeRC] ${callId}: _aiAudioComplete=true (response.output_audio.done)`);
            if (!conn._userInputToOpenAIAllowed) {
              conn._userInputToOpenAIAllowed = true;
              logger.info(
                `[OpenAI Realtime] User mic → OpenAI enabled (fallback: output_audio.done, no output_audio.delta) for ${callId}`
              );
            }
          }
          break;

        case 'conversation.item.created':
          await this.handleConversationItemCreated(callId, message);
          break;

        case 'response.done':
          logger.info(`[OpenAI Realtime] AI FINISHED SPEAKING for ${callId}`);
          await this.handleResponseDone(callId, message);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          await this.handleInputAudioTranscriptionCompleted(callId, message);
          break;

        case 'conversation.item.input_audio_transcription.failed':
          await this.handleInputAudioTranscriptionFailed(callId, message);
          break;

        case 'conversation.item.input_audio_transcription.delta':
          await this.handleInputAudioTranscriptionDelta(callId, message);
          break;

        case 'response.audio_transcript.delta':  // Beta event name
        case 'response.output_audio_transcript.delta':  // GA event name
          // STRANGLER FIG: Use MessageHandler for audio transcript delta
          MessageHandler.handleResponseAudioTranscriptDelta(conn, message);
          break;

        case 'response.audio_transcript.done':  // Beta event name
        case 'response.output_audio_transcript.done':  // GA event name
          // STRANGLER FIG: Use MessageHandler for audio transcript done
          MessageHandler.handleResponseAudioTranscriptDone(conn, message);
          break;

        case 'input_audio_buffer.speech_started':
          logger.info(`[OpenAI Realtime] USER SPEECH STARTED for ${callId}`);

          if (conn) {
            conn._userIsSpeaking = true;
            const stForUserTurnGuards = this.getConversationState(callId);
            const alreadyUserSpeaking = stForUserTurnGuards === CONVERSATION_STATES.USER_SPEAKING;
            // Duplicate speech_started (VAD) while still USER_SPEAKING must not clear defer / sent flags — same utterance.
            if (!alreadyUserSpeaking) {
              conn._pendingUserResponseAfterAiStops = false;
              conn._userTurnResponseCreateSent = false;
              if (conn._processedTranscriptItemIds) {
                // FIX: Bug 1 (next utterance) — new turn; per-call Set also cleared in cleanup
                conn._processedTranscriptItemIds.clear();
              } else {
                conn._processedTranscriptItemIds = new Set();
              }
              conn._asrTranscriptionEventHandledThisTurn = false;
              if (conn._speechStoppedFinalizeTimer) {
                clearTimeout(conn._speechStoppedFinalizeTimer);
                conn._speechStoppedFinalizeTimer = null;
              }
              conn._speechStoppedFinalizePending = false;
              conn._speechStoppedCommittedAiResponding = false;
            }
            conn._lastUserSpeechStart = Date.now();
            if (!alreadyUserSpeaking) {
              // FIX: Bug 2 — utterance start for min speech gating
              conn._turnSpeechStartTime = Date.now();
            }
            conn._userTranscriptLiveBuffer = '';
            if (conn._userTranscriptFlushTimer) {
              clearTimeout(conn._userTranscriptFlushTimer);
              conn._userTranscriptFlushTimer = null;
            }

            if (conn._aiIsSpeaking || conn._responseCreateInFlight || conn._responseCreated) {
              this._markAssistantPlaybackActive(conn);
            } else {
              this._syncAiAudioPlaybackCompleteFromRtp(callId, conn);
            }

            const shouldCancelAiForBargeIn =
              !conn._aiAudioPlaybackComplete &&
              (conn._aiIsSpeaking || conn._responseCreateInFlight || conn._responseCreated);

            if (shouldCancelAiForBargeIn) {
              logger.info(`[OpenAI Realtime] USER INTERRUPTING AI - canceling AI response for ${callId}`);
              try {
                await this.sendJsonMessage(callId, { type: 'response.cancel' });
                const rtpSenderService = require('./rtp.sender.service');
                rtpSenderService.clearBuffer(callId);
                conn._aiAudioPlaybackComplete = true;
                conn._aiIsSpeaking = false;
                this._resetAssistantOutputAudioLifecycle(conn);
                conn._responseCanceled = true;
                conn._responseCanceledAt = Date.now();
                conn.pendingAssistantTranscript = '';
                const st = this.getConversationState(callId);
                if (st === CONVERSATION_STATES.GREETING_ACTIVE) {
                  conn._waitingForInitialGreeting = false;
                  this.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'initial_greeting_interrupted');
                } else {
                  this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'ai_response_canceled');
                }
                logger.info(`[OpenAI Realtime] Response canceled for ${callId} - will wait for user to finish before responding`);
              } catch (err) {
                logger.error(`[OpenAI Realtime] Failed to cancel AI response: ${err.message}`);
              }
            } else {
              logger.info(`[OpenAI Realtime] speech_started barge-in cancel skipped for ${callId}`, {
                _aiIsSpeaking: conn._aiIsSpeaking,
                _responseCreateInFlight: conn._responseCreateInFlight,
                _responseCreated: conn._responseCreated,
                _aiAudioPlaybackComplete: conn._aiAudioPlaybackComplete,
                _aiOutputAudioDeltaSeen: conn._aiOutputAudioDeltaSeen,
                _aiAudioComplete: conn._aiAudioComplete,
                conversationState: this.getConversationState(callId),
              });
            }

            // STATE MACHINE: USER_SPEAKING when allowed. AI_RESPONDING→USER_SPEAKING covers barge-in / post-audio tail.
            // USER_SPEAKING→USER_SPEAKING is invalid — treat duplicate VAD as idempotent (common cause of "blocked" logs).
            const stBeforeUser = this.getConversationState(callId);
            if (stBeforeUser === CONVERSATION_STATES.USER_SPEAKING) {
              logger.info(`[RealtimeRC] speech_started → USER_SPEAKING (idempotent, already user_speaking) ${callId}`, {
                _aiIsSpeaking: conn._aiIsSpeaking,
                _aiAudioComplete: conn._aiAudioComplete,
              });
            } else if (StateMachine.canTransitionTo(conn, CONVERSATION_STATES.USER_SPEAKING)) {
              const ok = this.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'user_started_speaking');
              logger.info(`[RealtimeRC] speech_started → USER_SPEAKING ${callId}`, {
                success: ok,
                stateBefore: stBeforeUser,
                stateAfter: this.getConversationState(callId),
              });
            } else {
              logger.info(`[RealtimeRC] speech_started USER_SPEAKING blocked ${callId}`, {
                state: stBeforeUser,
                allowedNext: STATE_TRANSITIONS[stBeforeUser] ? [...STATE_TRANSITIONS[stBeforeUser]] : [],
                _aiIsSpeaking: conn._aiIsSpeaking,
                _aiAudioComplete: conn._aiAudioComplete,
                _aiOutputAudioDeltaSeen: conn._aiOutputAudioDeltaSeen,
              });
            }

            // Placeholder once the greeting is done — before that, user audio exists but transcripts are ignored,
            // which would otherwise leave permanent "[Speaking...]" rows.
            // Duplicate VAD speech_started while still USER_SPEAKING must not create another row (same utterance).
            if (!conn._waitingForInitialGreeting && !alreadyUserSpeaking) {
              await this.createPlaceholderUserMessage(callId);
            } else if (alreadyUserSpeaking) {
              logger.debug(
                `[OpenAI Realtime] Skipping user placeholder for ${callId} — duplicate speech_started (same utterance)`
              );
            } else {
              logger.debug(
                `[OpenAI Realtime] Skipping user placeholder for ${callId} — waiting for initial greeting (transcripts ignored until then)`
              );
            }
          }

          this.notify(callId, 'speech_started', {});
          break;

        case 'input_audio_buffer.speech_stopped':
          logger.info(`[OpenAI Realtime] USER SPEECH STOPPED for ${callId}`);

          if (conn) {
            conn._userIsSpeaking = false;
            conn._lastUserSpeechEnd = Date.now();
            if (conn._turnSpeechStartTime != null) {
              // FIX: Bug 2 — end-of-utterance duration (used by 200ms sendResponseCreate min gate)
              conn._turnSpeechDurationMs = Date.now() - conn._turnSpeechStartTime;
            } else {
              conn._turnSpeechDurationMs = 0;
            }

            const pendingBefore = conn._pendingUserResponseAfterAiStops;
            this._rcDiagSpeechStopped(callId, conn, 'sync_on_event', {
              note: 'immediate snapshot when speech_stopped fires (before 500ms ASR finalize)',
              _pendingUserResponseAfterAiStops_before: pendingBefore,
            });

            // Recovery: prior turn can leave AI_RESPONDING with _aiIsSpeaking false if sendResponseCreate never
            // produced a response (invalid self-transition AI_RESPONDING→AI_RESPONDING blocks the next speech_stopped).
            //
            // Do NOT run while a user turn is legitimately in flight: after speech_stopped we move to AI_RESPONDING
            // and set _aiIsSpeaking on a 200ms timer — a duplicate VAD speech_stopped in that window looks "stuck"
            // and would clear flags, then a second 200ms fires and we get two assistant messages in a row.
            const stBeforeRecovery = this.getConversationState(callId);
            const inUserTurnPipeline =
              conn._userTurnResponseCreateSent ||
              (conn._speechStoppedCommittedAiResponding && !conn._userTurnResponseCreateSent) ||
              conn._responseCreateInFlight ||
              conn._responseCreated;
            if (stBeforeRecovery === CONVERSATION_STATES.AI_RESPONDING && !conn._aiIsSpeaking && !inUserTurnPipeline) {
              logger.warn(
                `[RealtimeRC] recovery ${callId}: state=ai_responding and _aiIsSpeaking=false → transition to conversation_active (enables next response.create)`
              );
              conn._speechStoppedCommittedAiResponding = false;
              conn._userTurnResponseCreateSent = false;
              this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'recovery_stuck_ai_responding');
              this._rcDiagSpeechStopped(callId, conn, 'after_stuck_ai_responding_recovery', {
                previousState: stBeforeRecovery,
              });
            }

            // Recovery: speech_started may not have run or did not transition (e.g. ordering); speech_stopped must
            // still be able to do USER_SPEAKING → AI_RESPONDING on the next line.
            const stAfterAiRecovery = this.getConversationState(callId);
            if (
              !conn._aiIsSpeaking &&
              (stAfterAiRecovery === CONVERSATION_STATES.CONVERSATION_ACTIVE ||
                stAfterAiRecovery === CONVERSATION_STATES.GREETING_COMPLETE) &&
              StateMachine.canTransitionTo(conn, CONVERSATION_STATES.USER_SPEAKING)
            ) {
              logger.warn(
                `[RealtimeRC] Recovery: speech_stopped arrived in ${stAfterAiRecovery} without prior USER_SPEAKING transition — recovering → user_speaking for ${callId}`
              );
              this.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'recovery_speech_stopped_without_user_speaking');
              this._rcDiagSpeechStopped(callId, conn, 'after_conversation_active_to_user_speaking_recovery', {
                previousState: stAfterAiRecovery,
              });
            }

            const stAfterSpeechStoppedRecovery = this.getConversationState(callId);
            if (
              stAfterSpeechStoppedRecovery === CONVERSATION_STATES.AI_RESPONDING &&
              conn._userTurnResponseCreateSent
            ) {
              logger.info(
                `[RealtimeRC] speech_stopped:idempotent — already AI_RESPONDING with response sent, ignoring duplicate VAD event ${callId}`
              );
            } else {
            // CRITICAL: Wait a moment for transcription to complete (race condition)
            // The transcript might arrive via input_audio_transcription.completed AFTER speech_stopped
            // So we wait a bit, then check again. Duplicate speech_stopped must not stack 500ms passes.
            if (!conn._speechStoppedFinalizePending) {
              conn._speechStoppedFinalizePending = true;
              conn._speechStoppedFinalizeTimer = setTimeout(async () => {
                try {
              const currentConn = this.connections.get(callId);
              if (!currentConn) return;

              // Save user transcript now that user has finished speaking
              // CRITICAL: We MUST update the existing placeholder (not create new) to preserve queue position
              let userMessageFinalized = false;
              if (currentConn.pendingUserTranscript && currentConn.pendingUserTranscript.trim()) {
                const transcript = currentConn.pendingUserTranscript.trim();
                
                // Get client's preferred language for filler word detection (cache in connection)
                let preferredLanguage = currentConn.preferredLanguage || 'en'; // default to English
                if (!currentConn.preferredLanguage && currentConn.clientId) {
                  try {
                    const { Client } = require('../models');
                    const client = await Client.findById(currentConn.clientId).select('preferredLanguage').lean();
                    if (client?.preferredLanguage) {
                      preferredLanguage = client.preferredLanguage;
                      currentConn.preferredLanguage = preferredLanguage; // Cache it
                    } else {
                      currentConn.preferredLanguage = 'en'; // Cache default
                    }
                  } catch (err) {
                    logger.warn(`[OpenAI Realtime] Could not get client language for filler word detection: ${err.message}`);
                    currentConn.preferredLanguage = 'en'; // Cache default on error
                  }
                }
                
                // Check if transcript is only filler words - if so, don't save or respond, just wait
                if (isFiller(transcript, preferredLanguage)) {
                  this._rcDiagSpeechStopped(callId, currentConn, '500ms_block_filler_only_transcript', {
                    outcome: 'keep_row_no_response',
                    transcript: transcript.length > 200 ? `${transcript.slice(0, 200)}…` : transcript,
                  });
                  logger.info(
                    `[OpenAI Realtime] User transcript is filler-only (${preferredLanguage}): "${transcript}" — persisting as final line, no response`
                  );
                  currentConn.pendingUserTranscript = '';
                  if (currentConn.activeUserMessageId) {
                    try {
                      const { Message } = require('../models');
                      await Message.findByIdAndUpdate(
                        currentConn.activeUserMessageId,
                        { content: transcript, messageType: 'user_message' },
                        { timestamps: false, runValidators: false }
                      );
                      this.notify(callId, 'user_transcript_updated', {
                        messageId: currentConn.activeUserMessageId.toString(),
                        conversationId: currentConn.conversationId,
                        transcript,
                      });
                    } catch (err) {
                      logger.error(`[OpenAI Realtime] Failed to persist filler-only user line: ${err.message}`);
                    }
                    currentConn.activeUserMessageId = null;
                    await this.flushDeferredAssistantQueue(callId);
                  }
                  return;
                }
                
                logger.info(`[OpenAI Realtime] Saving user transcript now that user finished speaking: "${transcript}"`);
                
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
                        content: transcript,
                        messageType: 'user_message',
                      },
                      { timestamps: false, runValidators: false } // Disable auto-timestamps
                    );
                    logger.info(`[OpenAI Realtime] Updated placeholder user message ${currentConn.activeUserMessageId} with transcript: "${transcript}" (preserved _id and queue position)`);
                    userMessageFinalized = true;
                    currentConn.activeUserMessageId = null; // Clear the active message ID
                    await this.flushDeferredAssistantQueue(callId);
                  } catch (err) {
                    logger.error(`[OpenAI Realtime] Failed to update placeholder user message: ${err.message}`);
                    // DO NOT create new message - this would break queue order
                    // Instead, log error and keep placeholder as-is
                    logger.error(`[OpenAI Realtime] CRITICAL: Cannot update user placeholder, but not creating new message to preserve queue order`);
                  }
                } else {
                  // No placeholder exists - this shouldn't happen, but create new message as fallback
                  // FIX: Bug 1 — ASR .completed may have finalized this turn; _userTurnResponseCreateSent = late send already won the race
                  if (currentConn._asrTranscriptionEventHandledThisTurn || currentConn._userTurnResponseCreateSent) {
                    logger.info(
                      `[OpenAI Realtime] Skipping fallback saveCompleteMessage for ${callId} — ASR/turn path already applied (Bug 1: duplicate guard)`
                    );
                    currentConn.pendingUserTranscript = '';
                  } else {
                    logger.warn(`[OpenAI Realtime] No active user message ID - creating new message (this may break queue order)`);
                    await this.saveCompleteMessage(callId, 'client', transcript);
                    userMessageFinalized = true;
                    await this.flushDeferredAssistantQueue(callId);
                  }
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
                } finally {
                  const c = this.connections.get(callId);
                  if (c) {
                    c._speechStoppedFinalizePending = false;
                    c._speechStoppedFinalizeTimer = null;
                  }
                }
              }, 500); // Wait 500ms for transcription to complete
            } else {
              logger.info(
                `[RealtimeRC] speech_stopped:idempotent — ASR finalize (500ms) already scheduled, ignoring duplicate VAD ${callId}`
              );
            }

            const stForDupMainPath = this.getConversationState(callId);
            if (
              conn._speechStoppedCommittedAiResponding &&
              stForDupMainPath === CONVERSATION_STATES.AI_RESPONDING &&
              !conn._userTurnResponseCreateSent
            ) {
              logger.info(
                `[RealtimeRC] speech_stopped:idempotent — duplicate VAD while awaiting response.create (200ms), ignoring ${callId}`
              );
            } else {
            // STATE MACHINE: Only trigger AI response if we're in the right state
            // CRITICAL: If we just canceled a response, wait a bit before triggering a new one
            // This prevents race conditions where response.done arrives after we cancel
            const timeSinceCancel = conn._responseCanceledAt ? Date.now() - conn._responseCanceledAt : Infinity;
            const CANCEL_DEBOUNCE_MS = 500; // Wait 500ms after canceling before allowing new response
            
            if (conn._responseCanceled && timeSinceCancel < CANCEL_DEBOUNCE_MS) {
              this._rcDiagSpeechStopped(callId, conn, 'cancel_debounce_wait', {
                outcome: 'defer_response_via_setTimeout',
                timeSinceCancelMs: Math.round(timeSinceCancel),
                cancelDebounceMs: CANCEL_DEBOUNCE_MS,
              });
              logger.info(
                `[OpenAI Realtime] User finished speaking for ${callId} but response was recently canceled ` +
                `(${Math.round(timeSinceCancel)}ms ago) - waiting ${CANCEL_DEBOUNCE_MS}ms before allowing new response`
              );
              
              // Wait for the debounce period, then check again
              setTimeout(async () => {
                const currentConn = this.connections.get(callId);
                if (!currentConn) return;
                
                // Clear the canceled flag after debounce period
                currentConn._responseCanceled = false;
                currentConn._responseCanceledAt = null;
                
                // Now check if we should trigger a response
                if (!currentConn._aiIsSpeaking && this.canAIRespond(callId)) {
                  // Check grace period
                  if (this.isInGracePeriod(callId)) {
                    const timeSinceGreeting = Date.now() - currentConn._initialGreetingCompletedAt;
                    this._rcDiagSpeechStopped(callId, currentConn, 'post_cancel_debounce_grace_skip', {
                      outcome: 'sendResponseCreate_not_scheduled',
                      timeSinceGreetingMs: Math.round(timeSinceGreeting),
                    });
                    logger.info(
                      `[OpenAI Realtime] Ignoring speech_stopped for ${callId} - in grace period ` +
                      `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${CONSTANTS.GRACE_PERIOD_MS}ms).`
                    );
                    return;
                  }

                  // Transition to AI_RESPONDING state
                  if (this.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking_after_cancel')) {
                    const postCancelConn = this.connections.get(callId);
                    if (postCancelConn) postCancelConn._speechStoppedCommittedAiResponding = true;
                    logger.info(`[OpenAI Realtime] User finished speaking (after cancel debounce) - will trigger AI response for ${callId}`);
                    
                    setTimeout(async () => {
                      const finalConn = this.connections.get(callId);
                      if (!finalConn || this.getConversationState(callId) !== CONVERSATION_STATES.AI_RESPONDING) return;
                      if (finalConn._userTurnResponseCreateSent) {
                        logger.info(
                          `[RealtimeRC] post-cancel 200ms timer skipped ${callId} — user-turn response.create already sent`
                        );
                        return;
                      }
                      try {
                        finalConn._userTurnResponseCreateSent = true;
                        const sent = await this.sendResponseCreate(callId);
                        if (!sent) {
                          finalConn._userTurnResponseCreateSent = false;
                          const failConn = this.connections.get(callId);
                          if (failConn) failConn._speechStoppedCommittedAiResponding = false;
                          this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'response_failed');
                          return;
                        }
                        this._resetAssistantOutputAudioLifecycle(finalConn);
                        this._markAssistantPlaybackActive(finalConn);
                        finalConn._aiIsSpeaking = true;
                        logger.info(`[OpenAI Realtime] Triggered AI response after user finished speaking (post-cancel) for ${callId}`);
                      } catch (err) {
                        finalConn._userTurnResponseCreateSent = false;
                        logger.error(`[OpenAI Realtime] Failed to trigger AI response: ${err.message}`);
                        const failConn = this.connections.get(callId);
                        if (failConn) failConn._speechStoppedCommittedAiResponding = false;
                        this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'response_failed');
                      }
                    }, 200);
                  }
                }
              }, CANCEL_DEBOUNCE_MS - timeSinceCancel);
              
              return; // Exit early - we'll handle response after debounce
            }

            const isActiveResponse =
              conn._aiIsSpeaking || conn._responseCreated || conn._responseCreateInFlight;

            if (!isActiveResponse && this.canAIRespond(callId)) {
              const hadPendingFlag = conn._pendingUserResponseAfterAiStops;
              conn._pendingUserResponseAfterAiStops = false;
              this._rcDiagSpeechStopped(callId, conn, 'main_path_enter', {
                outcome: 'evaluate_grace_filler_transition',
                _pendingUserResponseAfterAiStops_beforeClear: hadPendingFlag,
                _pendingUserResponseAfterAiStops_afterClear: conn._pendingUserResponseAfterAiStops,
              });
              // Check if we're in grace period after initial greeting
              if (this.isInGracePeriod(callId)) {
                const timeSinceGreeting = Date.now() - conn._initialGreetingCompletedAt;
                this._rcDiagSpeechStopped(callId, conn, 'main_path_grace_skip', {
                  outcome: 'sendResponseCreate_not_scheduled',
                  timeSinceGreetingMs: Math.round(timeSinceGreeting),
                });
                logger.info(
                  `[OpenAI Realtime] Ignoring speech_stopped for ${callId} - in grace period ` +
                  `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${CONSTANTS.GRACE_PERIOD_MS}ms). ` +
                  `This prevents lingering audio from "hello" or transfer message from triggering response.`
                );
                return; // Don't trigger response - this is likely lingering audio
              }

              // Check if pending transcript is only filler words - if so, wait for more substantial speech
              if (conn.pendingUserTranscript && conn.pendingUserTranscript.trim()) {
                // Get client's preferred language for filler word detection (cache in connection)
                let preferredLanguage = conn.preferredLanguage || 'en'; // default to English
                if (!conn.preferredLanguage && conn.clientId) {
                  try {
                    const { Client } = require('../models');
                    const client = await Client.findById(conn.clientId).select('preferredLanguage').lean();
                    if (client?.preferredLanguage) {
                      preferredLanguage = client.preferredLanguage;
                      conn.preferredLanguage = preferredLanguage; // Cache it
                    } else {
                      conn.preferredLanguage = 'en'; // Cache default
                    }
                  } catch (err) {
                    logger.warn(`[OpenAI Realtime] Could not get client language for filler word detection: ${err.message}`);
                    conn.preferredLanguage = 'en'; // Cache default on error
                  }
                }
                
                if (isFiller(conn.pendingUserTranscript, preferredLanguage)) {
                  this._rcDiagSpeechStopped(callId, conn, 'main_path_filler_skip', {
                    outcome: 'sendResponseCreate_not_scheduled',
                    preferredLanguage,
                    pendingPreview:
                      conn.pendingUserTranscript.length > 160
                        ? `${conn.pendingUserTranscript.slice(0, 160)}…`
                        : conn.pendingUserTranscript,
                  });
                  logger.info(
                    `[OpenAI Realtime] Ignoring speech_stopped for ${callId} - transcript contains only filler words (${preferredLanguage}): "${conn.pendingUserTranscript}"`
                  );
                  return; // Don't trigger response - wait for more substantial speech
                }
              }

              const stStale = this.getConversationState(callId);
              const hasUserTurnEvidence =
                (conn.pendingUserTranscript || '').trim().length > 0 ||
                Boolean(conn.activeUserMessageId) ||
                conn._waitingForUserTranscript ||
                hadPendingFlag;
              const staleVadLikely =
                !conn._waitingForInitialGreeting &&
                (stStale === CONVERSATION_STATES.CONVERSATION_ACTIVE ||
                  stStale === CONVERSATION_STATES.GREETING_COMPLETE);
              if (staleVadLikely && !hasUserTurnEvidence) {
                logger.info(
                  `[RealtimeRC] speech_stopped:stale_vad_event — no active user turn, ignoring ${callId}`
                );
                this._rcDiagSpeechStopped(callId, conn, 'stale_vad_skip', {
                  outcome: 'sendResponseCreate_not_scheduled',
                  conversationState: stStale,
                  _userTurnResponseCreateSent: conn._userTurnResponseCreateSent,
                });
                return;
              }

              // Transition to AI_RESPONDING state
              const stateBeforeAiResponding = this.getConversationState(callId);
              if (this.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_finished_speaking')) {
                conn._speechStoppedCommittedAiResponding = true;
                this._rcDiagSpeechStopped(callId, conn, 'transition_ok_user_to_ai_responding', {
                  outcome: 'schedule_sendResponseCreate_200ms',
                  stateBefore: stateBeforeAiResponding,
                });
                logger.info(`[OpenAI Realtime] User finished speaking - will trigger AI response for ${callId}`);

                // Timer hierarchy (Scenario B — canonical): this 200ms debounce is the primary send for normal turns.
                // OpenAI Realtime already has the user's audio in the server-side buffer; response.create does not wait
                // on our conversation.item.input_audio_transcription.completed. ASR completion handlers are for UI/DB and
                // for recovery paths when speech_stopped never reached AI_RESPONDING+schedule (fallback / _waiting path).
                setTimeout(async () => {
                  const currentConn = this.connections.get(callId);
                  if (!currentConn || this.getConversationState(callId) !== CONVERSATION_STATES.AI_RESPONDING) {
                    const snapConn = this.connections.get(callId);
                    this._rcDiagSpeechStopped(callId, snapConn || conn, 'timer_200ms_skip', {
                      outcome: 'sendResponseCreate_not_called_state_mismatch',
                      stateNow: this.getConversationState(callId),
                    });
                    logger.info(`[OpenAI Realtime] Skipping auto-response trigger for ${callId} - state changed or connection lost`);
                    return;
                  }
                  // FIX: Bug 2 — do not let short noise + 500+200ms silence trigger Bianca; VAD can resume on more speech
                  const minResponseMs = CONSTANTS.MIN_SPEECH_DURATION_FOR_RESPONSE_MS;
                  const spDur = Number.isFinite(currentConn._turnSpeechDurationMs) ? currentConn._turnSpeechDurationMs : 0;
                  if (spDur < minResponseMs) {
                    logger.info(
                      `[RealtimeRC] Skipping response.create — speech too short (${Math.round(spDur)}ms, min ${minResponseMs}ms) ${callId}`
                    );
                    currentConn._speechStoppedCommittedAiResponding = false;
                    this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'speech_too_short_wait_more');
                    return;
                  }
                  if (currentConn._userTurnResponseCreateSent) {
                    logger.info(
                      `[RealtimeRC] speech_stopped 200ms timer skipped ${callId} — user-turn response.create already sent (ASR recovery path won)`
                    );
                    return;
                  }
                  try {
                    this._rcDiagSpeechStopped(callId, currentConn, 'timer_200ms_before_sendResponseCreate', {
                      outcome: 'calling_sendResponseCreate',
                    });
                    logger.info(`[OpenAI Realtime] DEBUG: About to trigger response for ${callId} - _responseCreated: ${currentConn._responseCreated}, _responseStartTime: ${currentConn._responseStartTime}`);
                    currentConn._userTurnResponseCreateSent = true;
                    const sent = await this.sendResponseCreate(callId);
                    if (!sent) {
                      currentConn._userTurnResponseCreateSent = false;
                      const failConn = this.connections.get(callId);
                      if (failConn) failConn._speechStoppedCommittedAiResponding = false;
                      this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'response_failed');
                      return;
                    }
                    this._resetAssistantOutputAudioLifecycle(currentConn);
                    this._markAssistantPlaybackActive(currentConn);
                    currentConn._aiIsSpeaking = true;
                    logger.info(`[OpenAI Realtime] Triggered AI response after user finished speaking for ${callId}`);
                  } catch (err) {
                    currentConn._userTurnResponseCreateSent = false;
                    logger.error(`[OpenAI Realtime] Failed to trigger AI response: ${err.message}`);
                    const failConn = this.connections.get(callId);
                    if (failConn) failConn._speechStoppedCommittedAiResponding = false;
                    this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'response_failed');
                  }
                }, 200);
              } else {
                this._rcDiagSpeechStopped(callId, conn, 'transition_denied_to_ai_responding', {
                  outcome: 'sendResponseCreate_not_scheduled',
                  stateBefore: stateBeforeAiResponding,
                  hint: 'invalid_transition_often_ai_responding_stuck_without_response_done',
                });
                logger.warn(`[OpenAI Realtime] Cannot transition to AI_RESPONDING state for ${callId}`);
                const hasUserTurnTransitionDenied =
                  (conn.pendingUserTranscript || '').trim().length > 0 ||
                  Boolean(conn.activeUserMessageId) ||
                  conn._waitingForUserTranscript;
                if (
                  stateBeforeAiResponding === CONVERSATION_STATES.AI_RESPONDING &&
                  hasUserTurnTransitionDenied &&
                  !conn._userTurnResponseCreateSent &&
                  this.canAIRespond(callId) &&
                  !this.isInGracePeriod(callId)
                ) {
                  // FIX: Bug 3
                  conn._pendingStopsSetAt = Date.now();
                  conn._pendingUserResponseAfterAiStops = true;
                  conn._userTurnResponseCreateSent = false;
                  logger.info(
                    conn._aiAudioComplete
                      ? `[RealtimeRC] speech_stopped:transition_denied — audio complete, deferring to response.done ${callId}`
                      : `[RealtimeRC] speech_stopped:transition_denied — still streaming, deferring to response.done ${callId}`
                  );
                }
              }
            } else if (isActiveResponse) {
              if (this.canAIRespond(callId) && !this.isInGracePeriod(callId)) {
                // FIX: Bug 3
                conn._pendingStopsSetAt = Date.now();
                conn._pendingUserResponseAfterAiStops = true;
                conn._userTurnResponseCreateSent = false;
                this._rcDiagSpeechStopped(callId, conn, 'defer_until_response_done', {
                  outcome: 'set_pendingUserResponseAfterAiStops_true',
                  _pendingUserResponseAfterAiStops: conn._pendingUserResponseAfterAiStops,
                });
                logger.info(
                  `[OpenAI Realtime] Queued deferred user response for ${callId} — speech_stopped while _aiIsSpeaking ` +
                  `(will flush after response.done clears AI guard)`
                );
              } else {
                // Primary defer path requires canAIRespond && !grace. Barge-in during streaming (or grace / !canAIRespond)
                // still needs recovery: user content exists but we cannot schedule now — flush after response.done.
                const hasUserTurnForDefer =
                  (conn.pendingUserTranscript || '').trim().length > 0 ||
                  Boolean(conn.activeUserMessageId) ||
                  conn._waitingForUserTranscript;
                if (hasUserTurnForDefer && !conn._userTurnResponseCreateSent) {
                  // FIX: Bug 3
                  conn._pendingStopsSetAt = Date.now();
                  conn._pendingUserResponseAfterAiStops = true;
                  conn._userTurnResponseCreateSent = false;
                  logger.info(
                    `[RealtimeRC] speech_stopped:while_response_active_no_queue — active response in progress, deferring to response.done ${callId}`
                  );
                }
                this._rcDiagSpeechStopped(callId, conn, 'speech_stopped_while_ai_speaking_no_queue', {
                  outcome: 'sendResponseCreate_not_scheduled',
                  canAIRespond: this.canAIRespond(callId),
                  isInGracePeriod: this.isInGracePeriod(callId),
                  _aiAudioComplete: conn._aiAudioComplete,
                  _pendingUserResponseAfterAiStops: conn._pendingUserResponseAfterAiStops,
                  _responseCreated: conn._responseCreated,
                  _responseCreateInFlight: conn._responseCreateInFlight,
                });
              }
              logger.info(
                `[OpenAI Realtime] User finished speaking but AI is already speaking or a response is in progress for ${callId}`
              );
            } else {
              // !isActiveResponse && !canAIRespond (e.g. GREETING_ACTIVE before any response.create). Any in-flight or
              // ack'd response is handled above via isActiveResponse — including pre–output_audio.delta greeting.
              this._rcDiagSpeechStopped(callId, conn, 'main_path_blocked', {
                outcome: 'sendResponseCreate_not_scheduled',
                reason: '!isActiveResponse && canAIRespond was false',
                _aiIsSpeaking: conn._aiIsSpeaking,
                _responseCreated: conn._responseCreated,
                _responseCreateInFlight: conn._responseCreateInFlight,
                _aiAudioComplete: conn._aiAudioComplete,
                canAIRespond: this.canAIRespond(callId),
                state: this.getConversationState(callId),
              });
              logger.info(`[OpenAI Realtime] User finished speaking but cannot respond in current state: ${this.getConversationState(callId)}`);
            }
            }
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
            connResponse._responseCreateInFlight = false;
            logger.info(
              `[RealtimeRC] response.created ${callId}: cleared _responseCreateInFlight (was blocking duplicate sendResponseCreate)`,
              {
                conversationState: this.getConversationState(callId),
                _responseCreated: true,
              }
            );
            logger.info(`[OpenAI Realtime] OpenAI acknowledged response.create for ${callId}`);
          }
          break;

        case 'error':
          logger.warn(`[RealtimeRC] openai error event callId=${callId}`, {
            type: message.type,
            code: message.error?.code,
            message: message.error?.message,
            param: message.error?.param,
            event_id: message.event_id,
          });
          await this.handleApiError(callId, message);
          break;

        case 'session.expired':
          await this.handleSessionExpired(callId);
          break;

        default: {
          // Unhandled message type - log for debugging and track for migration monitoring
          // Block scope: `const apiVersion` in default must not share the switch lexenv with other cases
          // (else it hoists and shadows outer `const apiVersion`, causing TDZ in response.output_audio.delta).
          const useGA = config.openai.useGA !== undefined ? config.openai.useGA : false;
          const apiVersion = useGA ? 'GA' : 'Beta';
          logger.warn(`[OpenAI Realtime] Unhandled message type ${message.type} for ${callId} (${apiVersion})`);
          const connMsg = this.connections.get(callId);
          if (connMsg) {
            connMsg.lastMessageTime = Date.now();
            connMsg.messageCount = (connMsg.messageCount || 0) + 1;
            logger.debug(`[OpenAI Realtime] Message #${connMsg.messageCount} received for ${callId}: ${message.type}`);
            // Track unexpected events for migration monitoring
            if (!connMsg._unexpectedEvents) connMsg._unexpectedEvents = [];
            connMsg._unexpectedEvents.push({
              type: message.type,
              timestamp: new Date().toISOString(),
              apiVersion,
              messageStructure: JSON.stringify(message).substring(0, 200)
            });
          }
          logger.debug(`[OpenAI Realtime] Unhandled message structure (${apiVersion}): ${JSON.stringify(message, null, 2).substring(0, 500)}`);
        }
      }
    } catch (err) {
      const useGA = config.openai.useGA !== undefined ? config.openai.useGA : false;
      const apiVersion = useGA ? 'GA' : 'Beta';
      logger.error(`[OpenAI Realtime] Error processing message type ${message?.type} for ${callId} (${apiVersion}): ${err.message}`, err);
      logger.error(`[OpenAI Realtime] Message structure that caused error: ${JSON.stringify(message, null, 2).substring(0, 1000)}`);
      this.notify(callId, 'openai_message_processing_error', { messageType: message?.type, error: err.message, apiVersion });
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
    // Always use GA API
    const apiVersion = 'GA';

    logger.info(`[OpenAI Realtime] Sending session.update with turn detection for ${callId} (${apiVersion} format)`);
    logger.debug(`[OpenAI Realtime] Session config (${apiVersion}): ${JSON.stringify(sessionConfig.session, null, 2)}`);

    try {
      await this.sendJsonMessage(callId, sessionConfig);
      logger.info(`[OpenAI Realtime] Session.update with turn detection sent for ${callId}`);
      const td = sessionConfig.session?.audio?.input?.turn_detection;
      logger.info(
        `[RealtimeRC] session.update sent: callId=${callId} turn_detection=${JSON.stringify(td)}`
      );
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

    // Always use GA API
    const apiVersion = 'GA';
    logger.info(`[OpenAI Realtime] Session UPDATED for ${callId} (${apiVersion})`);
    logger.debug(`[OpenAI Realtime] Session update response for ${callId} (${apiVersion}): ${JSON.stringify(message)}`);

    // Track session update timing
    conn.sessionUpdateTime = Date.now();
    logger.info(`[OpenAI Realtime] Session update timestamp for ${callId}: ${new Date().toISOString()}`);

    let sessionBecameReady = false;
    if (!conn.sessionReady) {
      sessionBecameReady = true;
      // Clear the connection timeout since handshake is complete
      this.clearConnectionTimeout(callId);

      conn.sessionReady = true;
      conn.realtimeSessionEstablished = true;
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
      logger.info(`[OpenAI Realtime] Session ready for ${callId}. Will run initial greeting after session is applied.`);
    }

    try {
      // Greeting runs whenever session is ready and not yet successfully sent — including a later
      // session.updated if the first response.create was blocked (create_response:false removes OpenAI auto-reply).
      if (conn.sessionReady) {
        logger.info(
          `[RealtimeRC] greeting: invoking _sendInitialGreetingIfNeeded callId=${callId} sessionBecameReady=${sessionBecameReady} _initialGreetingTriggered=${conn._initialGreetingTriggered}`
        );
        await this._sendInitialGreetingIfNeeded(callId);
      }
      if (sessionBecameReady) {
        this.notify(callId, 'openai_session_ready', {});
      }
    } catch (err) {
      logger.error(`[OpenAI Realtime] Error in session setup for ${callId}: ${err.message}`);
      this.cleanup(callId);
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
   * True when the active user message row is still the in-flight placeholder (no ASR text yet).
   */
  async userPlaceholderShowsSpeakingOnly(conn) {
    if (!conn?.activeUserMessageId) return false;
    try {
      const { Message } = require('../models');
      const m = await Message.findById(conn.activeUserMessageId).select('content').lean();
      return m?.content === SPEAKING_PLACEHOLDER_TEXT;
    } catch (e) {
      logger.warn(`[OpenAI Realtime] userPlaceholderShowsSpeakingOnly: ${e.message}`);
      return false;
    }
  }

  /**
   * Apply queued assistant transcripts for this callId only once the user line is no longer "[Speaking...]".
   * Safe under concurrency: state is on `this.connections.get(callId)`, not shared across calls.
   */
  async flushDeferredAssistantQueue(callId, options = {}) {
    const force = options.force === true;
    const conn = this.connections.get(callId);
    if (!conn?._deferredAssistantQueue?.length) return;
    if (!force && (await this.userPlaceholderShowsSpeakingOnly(conn))) {
      return;
    }

    const pending = conn._deferredAssistantQueue;
    conn._deferredAssistantQueue = []; // new array for this call only; other callIds unaffected

    const { Message } = require('../models');
    for (const item of pending) {
      if (!item?.transcript?.trim()) continue;
      try {
        if (item.assistantMessageId) {
          const originalMessage = await Message.findById(item.assistantMessageId);
          if (!originalMessage) {
            const msg = await this.saveCompleteMessage(callId, 'assistant', item.transcript);
            if (msg?._id) {
              this.notifyAssistantTranscript(callId, conn.conversationId, msg._id, item.transcript.trim());
            }
            continue;
          }
          const originalTimestamp = originalMessage.createdAt;
          await Message.findByIdAndUpdate(
            item.assistantMessageId,
            {
              content: item.transcript.trim(),
              messageType: 'assistant_response',
              createdAt: originalTimestamp,
            },
            { timestamps: false, runValidators: false }
          );
          logger.info(`[OpenAI Realtime] Flushed deferred assistant message ${item.assistantMessageId} for ${callId}`);
          this.notifyAssistantTranscript(callId, conn.conversationId, item.assistantMessageId, item.transcript.trim());
        } else {
          const msg = await this.saveCompleteMessage(callId, 'assistant', item.transcript);
          if (msg?._id) {
            this.notifyAssistantTranscript(callId, conn.conversationId, msg._id, item.transcript.trim());
          }
        }
      } catch (e) {
        logger.error(`[OpenAI Realtime] flushDeferredAssistantQueue failed for ${callId}: ${e.message}`);
        try {
          const msg = await this.saveCompleteMessage(callId, 'assistant', item.transcript);
          if (msg?._id) {
            this.notifyAssistantTranscript(callId, conn.conversationId, msg._id, item.transcript.trim());
          }
        } catch (e2) {
          logger.error(`[OpenAI Realtime] flush fallback saveCompleteMessage failed: ${e2.message}`);
        }
      }
    }

    this.notify(callId, 'deferred_assistant_flushed', { conversationId: conn.conversationId });
  }

  /**
   * Write assistant transcript to DB for this call, or defer onto that call's `_deferredAssistantQueue` only.
   */
  async commitAssistantTranscriptOrDefer(callId, conn, text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const blocked = await this.userPlaceholderShowsSpeakingOnly(conn);
    if (blocked) {
      if (!Array.isArray(conn._deferredAssistantQueue)) {
        conn._deferredAssistantQueue = [];
      }
      conn._deferredAssistantQueue.push({
        assistantMessageId: conn.activeAssistantMessageId,
        transcript: trimmed,
      });
      logger.info(
        `[OpenAI Realtime] Deferred assistant transcript for ${callId} (queue=${conn._deferredAssistantQueue.length}) — user row still ${SPEAKING_PLACEHOLDER_TEXT}`
      );
      conn.activeAssistantMessageId = null;
      return;
    }

    if (conn.activeAssistantMessageId) {
      const assistantMid = conn.activeAssistantMessageId;
      try {
        const { Message } = require('../models');
        const originalMessage = await Message.findById(assistantMid);
        const originalTimestamp = originalMessage?.createdAt;

        await Message.findByIdAndUpdate(
          assistantMid,
          {
            content: trimmed,
            messageType: 'assistant_response',
            createdAt: originalTimestamp,
          },
          { timestamps: false, runValidators: false }
        );
        logger.info(
          `[OpenAI Realtime] Updated placeholder assistant message with transcript: "${trimmed}" (preserved timestamp: ${originalTimestamp?.toISOString()})`
        );
        conn.activeAssistantMessageId = null;
        this.notifyAssistantTranscript(callId, conn.conversationId, assistantMid, trimmed);
      } catch (err) {
        logger.error(`[OpenAI Realtime] Failed to update placeholder assistant message: ${err.message}`);
        const msg = await this.saveCompleteMessage(callId, 'assistant', trimmed);
        if (msg?._id) {
          this.notifyAssistantTranscript(callId, conn.conversationId, msg._id, trimmed);
        }
      }
    } else {
      const msg = await this.saveCompleteMessage(callId, 'assistant', trimmed);
      if (msg?._id) {
        this.notifyAssistantTranscript(callId, conn.conversationId, msg._id, trimmed);
      }
    }
  }

  /**
   * If user speech_stopped fired while _aiIsSpeaking (ordering / streaming tail), we could not call
   * sendResponseCreate. Flush that turn once response.done clears _aiIsSpeaking — no separate
   * output_audio_buffer event in our pipeline.
   */
  async maybeFlushPendingUserResponseAfterAiDone(callId) {
    const conn = this.connections.get(callId);
    if (!conn || !conn._pendingUserResponseAfterAiStops) return;

    // FIX: Bug 3 (stale pending) — pending from an older user turn, before the last response.done
    if (conn._pendingStopsSetAt != null && conn._lastResponseDoneAt != null && conn._pendingStopsSetAt < conn._lastResponseDoneAt) {
      // FIX: Bug 3
      logger.warn(`[RealtimeRC] Discarding stale pending flush for ${callId} — pending set before last response.done`, {
        _pendingStopsSetAt: conn._pendingStopsSetAt,
        _lastResponseDoneAt: conn._lastResponseDoneAt,
      });
      conn._pendingUserResponseAfterAiStops = false;
      return;
    }

    if (conn._userIsSpeaking) {
      logger.info(`[RealtimeRC] maybeFlushDeferredResponse ${callId}: clear pending — user speaking again (premature clear)`, {
        outcome: 'pending_cleared_user_started_speaking',
      });
      conn._pendingUserResponseAfterAiStops = false;
      return;
    }
    if (!this.canAIRespond(callId)) {
      logger.warn(`[RealtimeRC] maybeFlushDeferredResponse ${callId}: clear pending — canAIRespond false`, {
        outcome: 'pending_cleared_cannot_ai_respond',
        state: this.getConversationState(callId),
      });
      conn._pendingUserResponseAfterAiStops = false;
      return;
    }
    if (conn._responseCreated) {
      logger.info(`[RealtimeRC] maybeFlushDeferredResponse ${callId}: clear pending — _responseCreated already true`, {
        outcome: 'pending_cleared_response_already_created',
      });
      conn._pendingUserResponseAfterAiStops = false;
      return;
    }

    if (conn.pendingUserTranscript && conn.pendingUserTranscript.trim()) {
      const preferredLanguage = conn.preferredLanguage || 'en';
      if (isFiller(conn.pendingUserTranscript.trim(), preferredLanguage)) {
        logger.info(`[RealtimeRC] maybeFlushDeferredResponse ${callId}: clear pending — filler-only transcript`, {
          outcome: 'pending_cleared_filler',
        });
        conn._pendingUserResponseAfterAiStops = false;
        return;
      }
    }

    // State machine: AI_RESPONDING is only reachable from USER_SPEAKING (not from GREETING_COMPLETE directly).
    // After greeting, we may be GREETING_COMPLETE with a deferred stop — step into USER_SPEAKING first.
    let st = this.getConversationState(callId);
    if (st === CONVERSATION_STATES.GREETING_COMPLETE) {
      if (!this.transitionState(callId, CONVERSATION_STATES.USER_SPEAKING, 'deferred_user_response_prep')) {
        logger.warn(
          `[OpenAI Realtime] Deferred user response: could not transition GREETING_COMPLETE→USER_SPEAKING for ${callId}`
        );
        logger.warn(`[RealtimeRC] maybeFlushDeferredResponse ${callId}: leave pending — transition fail G→U`, {
          outcome: 'pending_unchanged_transition_failed',
        });
        return;
      }
      st = this.getConversationState(callId);
    }

    if (!this.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_turn_deferred_until_response_done')) {
      logger.warn(`[OpenAI Realtime] Deferred user response: could not transition to AI_RESPONDING for ${callId}`);
      logger.warn(`[RealtimeRC] maybeFlushDeferredResponse ${callId}: leave pending — transition to AI_RESPONDING failed`, {
        outcome: 'pending_unchanged_transition_failed',
        state: this.getConversationState(callId),
      });
      return;
    }

    conn._speechStoppedCommittedAiResponding = true;

    logger.info(`[RealtimeRC] maybeFlushDeferredResponse ${callId}: success — cleared pending after transition to AI_RESPONDING`, {
      outcome: 'pending_cleared_after_successful_transition',
    });
    conn._pendingUserResponseAfterAiStops = false;

    setTimeout(async () => {
      const currentConn = this.connections.get(callId);
      if (!currentConn || this.getConversationState(callId) !== CONVERSATION_STATES.AI_RESPONDING) return;
      if (currentConn._userTurnResponseCreateSent) {
        logger.info(`[RealtimeRC] maybeFlush 200ms timer skipped ${callId} — user-turn response.create already sent`);
        return;
      }
      try {
        currentConn._userTurnResponseCreateSent = true;
        const sent = await this.sendResponseCreate(callId);
        if (!sent) {
          currentConn._userTurnResponseCreateSent = false;
          const failConn = this.connections.get(callId);
          if (failConn) failConn._speechStoppedCommittedAiResponding = false;
          this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'deferred_response_failed');
          return;
        }
        this._resetAssistantOutputAudioLifecycle(currentConn);
        currentConn._aiIsSpeaking = true;
        logger.info(`[OpenAI Realtime] Flushed deferred user response for ${callId} after AI response.done`);
      } catch (err) {
        currentConn._userTurnResponseCreateSent = false;
        logger.error(`[OpenAI Realtime] Deferred user response flush failed for ${callId}: ${err.message}`);
        const failConn = this.connections.get(callId);
        if (failConn) failConn._speechStoppedCommittedAiResponding = false;
        this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'deferred_response_failed');
      }
    }, 200);
  }

  /**
   * Handle response.done - Save complete assistant response
   * 
   * MESSAGE FLOW LOGIC:
   * 1. This is called when the AI finishes speaking (response.done event)
   * 2. We save any accumulated AI text from pendingAssistantTranscript
   * 3. This ensures AI messages are saved with timestamps reflecting when AI actually finished speaking
   * 4. The message gets a timestamp when it's saved to the database, not when text was first generated
   * 
   * INTERRUPTION HANDLING:
   * - If the response was canceled (status: 'cancelled'), we skip processing to avoid saving incomplete responses
   * - If we tracked a cancellation locally, we also skip processing to prevent race conditions
   */
  async handleResponseDone(callId, message) {
    const conn = this.connections.get(callId);
    if (!conn) {
      this.notify(callId, 'response_done', {});
      return;
    }

    // Check if this response was canceled
    const responseStatus = message?.response?.status;
    const wasCanceled = responseStatus === 'cancelled' || conn._responseCanceled;
    
    if (wasCanceled) {
      logger.info(`[OpenAI Realtime] Response done event received for ${callId} but response was canceled (status: ${responseStatus || 'tracked locally'}) - skipping processing`);

      conn._speechStoppedCommittedAiResponding = false;
      conn._responseCanceled = false;
      conn._responseCanceledAt = null;

      // 1) No commitAssistantTranscriptOrDefer on cancel — drop in-flight assistant text and placeholder
      conn.pendingAssistantTranscript = '';
      if (conn.activeAssistantMessageId) {
        try {
          const { Message } = require('../models');
          await Message.findByIdAndDelete(conn.activeAssistantMessageId);
          logger.info(`[OpenAI Realtime] Removed placeholder assistant message for canceled response ${callId}`);
          conn.activeAssistantMessageId = null;
        } catch (err) {
          logger.error(`[OpenAI Realtime] Failed to remove placeholder for canceled response: ${err.message}`);
        }
      }

      conn._aiIsSpeaking = false;
      this._resetAssistantOutputAudioLifecycle(conn);
      this._syncAiAudioPlaybackCompleteFromRtp(callId, conn);
      conn._responseCreated = false;
      conn._responseCreateInFlight = false;
      conn._responseStartTime = null;
      conn._stuckResponseRecoveryStartSnapshot = null;
      this._clearResponseStuckRecoveryTimers(conn);
      logger.info(`[RealtimeRC] response.done(canceled) ${callId}: cleared _responseCreateInFlight and related guards`);

      const currentState = this.getConversationState(callId);
      if (currentState === CONVERSATION_STATES.AI_RESPONDING) {
        this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'ai_response_canceled');
      }

      await this.maybeFlushPendingUserResponseAfterAiDone(callId);
      // After flush: this response is fully completed for ordering / stale-pending
      // FIX: Bug 3
      conn._lastResponseDoneAt = Date.now();
      this.notify(callId, 'response_done', { canceled: true });
      return;
    }

    logger.info(`[OpenAI Realtime] Assistant response done for ${callId} (status: ${responseStatus || 'completed'})`);

    // 1) DB ordering: assistant transcript or placeholder cleanup (must not skip later steps if this throws)
    try {
      if (conn.pendingAssistantTranscript && conn.pendingAssistantTranscript.trim()) {
        logger.info(`[OpenAI Realtime] Saving AI transcript now that AI finished speaking: "${conn.pendingAssistantTranscript}"`);
        const toSave = conn.pendingAssistantTranscript;
        conn.pendingAssistantTranscript = '';
        await this.commitAssistantTranscriptOrDefer(callId, conn, toSave);
      } else if (conn.activeAssistantMessageId) {
        const { Message } = require('../models');
        await Message.findByIdAndDelete(conn.activeAssistantMessageId);
        logger.info(`[OpenAI Realtime] Removed placeholder assistant message with no transcript for ${callId}`);
        conn.activeAssistantMessageId = null;
      }
    } catch (err) {
      logger.error(`[OpenAI Realtime] Assistant transcript/placeholder step failed for ${callId}: ${err.message}`, err);
    }

    const stateBeforeResponseDoneTransition = this.getConversationState(callId);

    // 2) Clear AI-speaking guard before response lifecycle flags (ordering for deferred flush + commits)
    conn._aiIsSpeaking = false;
    conn._speechStoppedCommittedAiResponding = false;
    this._resetAssistantOutputAudioLifecycle(conn);
    this._syncAiAudioPlaybackCompleteFromRtp(callId, conn);
    // 3) OpenAI response.create ack / stuck guards
    conn._responseCreated = false;
    conn._responseCreateInFlight = false;
    conn._responseStartTime = null; // Clear timeout tracking
    conn._stuckResponseRecoveryStartSnapshot = null;
    this._clearResponseStuckRecoveryTimers(conn);
    logger.info(`[RealtimeRC] response.done ${callId}: cleared _aiIsSpeaking, _responseCreated, _responseCreateInFlight`, {
      transitionFrom: stateBeforeResponseDoneTransition,
      willTransitionTo:
        stateBeforeResponseDoneTransition === CONVERSATION_STATES.GREETING_ACTIVE
          ? 'greeting_complete'
          : stateBeforeResponseDoneTransition === CONVERSATION_STATES.AI_RESPONDING
            ? 'conversation_active'
            : '(no state change)',
    });
    // Clear canceled flag if it was set (shouldn't be, but defensive)
    conn._responseCanceled = false;
    conn._responseCanceledAt = null;

    // 4) STATE MACHINE: greeting or regular AI turn completion
    const currentState = this.getConversationState(callId);
    if (currentState === CONVERSATION_STATES.GREETING_ACTIVE) {
      conn._initialGreetingCompletedAt = Date.now();
      conn._waitingForInitialGreeting = false;
      this.transitionState(callId, CONVERSATION_STATES.GREETING_COMPLETE, 'initial_greeting_completed');
      logger.info(`[OpenAI Realtime] Initial greeting completed for ${callId} - entering grace period and allowing user input`);
    } else if (currentState === CONVERSATION_STATES.AI_RESPONDING) {
      this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'ai_response_completed');
      logger.info(`[OpenAI Realtime] AI response completed for ${callId} - ready for user input`);
    }

    logger.info(`[OpenAI Realtime] Reset response flag for ${callId} - ready for new responses`);

    // 5) Last: deferred user response (needs _aiIsSpeaking false + greeting transition if applicable)
    await this.maybeFlushPendingUserResponseAfterAiDone(callId);
    // FIX: Bug 3 — so maybeFlush can compare _pendingStopsSetAt to the *previous* response's completion time
    conn._lastResponseDoneAt = Date.now();

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
                await this.flushDeferredAssistantQueue(callId);
              } else {
                // No placeholder - create new message (shouldn't happen, but fallback)
                logger.warn(`[Transcript Cleanup] No placeholder exists - creating new message (may break queue order)`);
                await this.saveCompleteMessage(callId, 'client', transcriptToSave);
                await this.flushDeferredAssistantQueue(callId);
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
              await this.commitAssistantTranscriptOrDefer(callId, conn, transcriptToSave);
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
      return null;
    }

    // Track utterance in context window for context-aware emergency detection
    if (conn.clientId) {
      try {
        const contextWindow = getConversationContextWindow();
        const contextRole = role === 'assistant' ? 'assistant' : 'user';
        contextWindow.addUtterance(conn.clientId, content.trim(), contextRole, Date.now());
        logger.debug(`[Context Window] Added ${contextRole} utterance for patient ${conn.clientId}`);
      } catch (error) {
        logger.warn(`[Context Window] Failed to track utterance: ${error.message}`);
      }
    }

    try {
      logger.info(`[OpenAI Realtime] Attempting to save ${role} message for ${callId}: "${content}"`);
      const conversationService = require('./conversation.service');
      const message = await conversationService.saveRealtimeMessage(
        conn.conversationId,
        role,
        content.trim(),
        role === 'assistant' ? 'assistant_response' : 
        role === 'debug-user' ? 'debug_user_message' :
        'user_message'
      );
      logger.info(`[OpenAI Realtime] Successfully saved ${role} message (${content.length} chars) to conversation ${conn.conversationId}`);

      // EMERGENCY DETECTION: Post-message analysis for user messages
      if ((role === 'user' || role === 'client') && conn.clientId && content && content.trim().length > 10) {
        try {
          logger.info(`[Emergency Detection] Processing utterance for emergency detection`, {
            clientId: conn.clientId,
            text: content.substring(0, 100),
            callId
          });
          
          const emergencyResult = await emergencyProcessor.processUtterance(
            conn.clientId,
            content,
            Date.now(),
            conn.conversationId || null
          );

          logger.info(`[Emergency Detection] Emergency detection result - shouldAlert: ${emergencyResult.shouldAlert}`, {
            clientId: conn.clientId,
            shouldAlert: emergencyResult.shouldAlert,
            reason: emergencyResult.reason,
            processing: emergencyResult.processing
          });

          if (emergencyResult.shouldAlert && !emergencyResult.processing.falsePositive) {
            logger.warn(`[Emergency Detection] 🚨 EMERGENCY DETECTED for client ${conn.clientId}: ${emergencyResult.reason}`);
            
            const alertResult = await emergencyProcessor.createAlert(
              conn.clientId,
              emergencyResult.alertData,
              content,
              {
                conversationId: conn.conversationId || null,
                detectionSource: emergencyResult.detectionSource || 'phrase_match',
                ...(message?._id ? { messageId: message._id } : {}),
              }
            );

            if (alertResult.success) {
              logger.info(`[Emergency Detection] ✅ Alert created successfully: ${alertResult.alert?.id || alertResult.alert?._id}`);
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

      return message ?? null;
    } catch (err) {
      logger.error(`[OpenAI Realtime] Failed to save ${role} message: ${err.message}`, err);
      return null;
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
  /**
   * Delete in-progress user placeholder (e.g. filler-only turn) so "[Speaking...]" never stays in the transcript.
   */
  async removeUserSpeakingPlaceholder(callId, reason) {
    const conn = this.connections.get(callId);
    if (!conn?.activeUserMessageId) return;

    const id = conn.activeUserMessageId;
    try {
      const { Message } = require('../models');
      await Message.findByIdAndDelete(id);
      logger.info(`[OpenAI Realtime] Removed user placeholder ${id} for ${callId} (${reason})`);
    } catch (err) {
      logger.error(`[OpenAI Realtime] Failed to remove user placeholder for ${callId}: ${err.message}`);
    }

    conn.activeUserMessageId = null;
    conn._waitingForUserTranscript = false;
    await this.flushDeferredAssistantQueue(callId);
  }

  /**
   * Persist user ASR text to the active placeholder as soon as OpenAI sends it (pollers / UI see text without waiting for speech_stopped).
   */
  async persistUserTranscriptToPlaceholder(callId, transcript) {
    const conn = this.connections.get(callId);
    if (!conn?.activeUserMessageId || !transcript?.trim()) return;

    const payload = {
      messageId: conn.activeUserMessageId.toString(),
      conversationId: conn.conversationId,
      transcript: transcript.trim(),
    };
    // Push to frontend first so Live Conversation updates before any slow work (e.g. emergency pipeline).
    this.notify(callId, 'user_transcript_updated', payload);

    try {
      const { Message } = require('../models');
      await Message.findByIdAndUpdate(
        conn.activeUserMessageId,
        {
          content: transcript.trim(),
          messageType: 'user_message',
        },
        { timestamps: false, runValidators: false }
      );
      logger.info(
        `[OpenAI Realtime] Live user transcript persisted for ${callId} (${conn.activeUserMessageId}): "${transcript.length > 100 ? `${transcript.slice(0, 100)}…` : transcript}"`
      );
      await this.flushDeferredAssistantQueue(callId);
    } catch (err) {
      logger.error(`[OpenAI Realtime] Live user transcript persist failed for ${callId}: ${err.message}`);
    }
  }

  async createPlaceholderUserMessage(callId) {
    const conn = this.connections.get(callId);
    if (!conn?.conversationId) return;

    // New speech_started while the last turn never got ASR — drop the stale "[Speaking...]" row so we do not accumulate orphans.
    if (conn.activeUserMessageId) {
      try {
        const { Message } = require('../models');
        const prev = await Message.findById(conn.activeUserMessageId).select('content').lean();
        if (prev?.content === SPEAKING_PLACEHOLDER_TEXT) {
          await this.removeUserSpeakingPlaceholder(callId, 'superseded by new speech_started');
        } else if (prev?.content?.trim()) {
          logger.info(
            `[OpenAI Realtime] Skipping new user placeholder for ${callId} — active row ${conn.activeUserMessageId} already has transcript`
          );
          return;
        }
      } catch (e) {
        logger.warn(`[OpenAI Realtime] Could not supersede prior user placeholder for ${callId}: ${e.message}`);
      }
    }

    try {
      const conversationService = require('./conversation.service');
      const message = await conversationService.saveRealtimeMessage(
        conn.conversationId,
        'client', // Message model enum: 'client', 'assistant', 'system', 'debug-user'
        SPEAKING_PLACEHOLDER_TEXT,
        'user_message'
      );
      
      if (message) {
        conn.activeUserMessageId = message._id;
        logger.info(`[OpenAI Realtime] Created placeholder user message ${message._id} for ${callId}`);
        this.notify(callId, 'user_transcript_updated', {
          messageId: message._id.toString(),
          conversationId: conn.conversationId,
          transcript: SPEAKING_PLACEHOLDER_TEXT,
        });
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
        SPEAKING_PLACEHOLDER_TEXT,
        'assistant_response'
      );
      
      if (message) {
        conn.activeAssistantMessageId = message._id;
        logger.info(`[OpenAI Realtime] Created placeholder assistant message ${message._id} for ${callId}`);
        this.notifyAssistantTranscript(callId, conn.conversationId, message._id, SPEAKING_PLACEHOLDER_TEXT);
      }
    } catch (err) {
      logger.error(`[OpenAI Realtime] Failed to create placeholder assistant message: ${err.message}`);
    }
  }

  /**
   * Streaming ASR deltas — debounce writes so the live transcript updates without waiting for speech_stopped.
   */
  async handleInputAudioTranscriptionDelta(callId, message) {
    const conn = this.connections.get(callId);
    if (!conn || conn._waitingForInitialGreeting || !conn.activeUserMessageId) return;

    const delta = typeof message.delta === 'string' ? message.delta : '';
    if (!delta) return;

    conn._userTranscriptLiveBuffer = (conn._userTranscriptLiveBuffer || '') + delta;

    if (conn._userTranscriptFlushTimer) {
      clearTimeout(conn._userTranscriptFlushTimer);
    }
    conn._userTranscriptFlushTimer = setTimeout(async () => {
      conn._userTranscriptFlushTimer = null;
      const text = (conn._userTranscriptLiveBuffer || '').trim();
      if (!text) return;
      const currentConn = this.connections.get(callId);
      if (!currentConn?.activeUserMessageId) return;
      await this.persistUserTranscriptToPlaceholder(callId, text);
    }, 120);
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
    const transcript = MessageHandler.extractUserInputTranscript(message);
    if (!transcript) return;

    const conn = this.connections.get(callId);
    if (!conn) return;

    // Ignore user input until Bianca has given her initial greeting
    if (conn._waitingForInitialGreeting) {
      logger.info(`[OpenAI Realtime] Ignoring user input for ${callId} - waiting for Bianca's initial greeting`);
      return;
    }

    // FIX: Bug 1 — duplicate .completed for same item_id
    const itemId = message?.item_id ?? message?.item?.id ?? null;
    if (itemId) {
      if (!conn._processedTranscriptItemIds) {
        conn._processedTranscriptItemIds = new Set();
      }
      if (conn._processedTranscriptItemIds.has(String(itemId))) {
        logger.warn(
          `[OpenAI Realtime] Duplicate input_audio_transcription.completed for item_id=${itemId} — ignoring ${callId}`
        );
        return;
      }
      conn._processedTranscriptItemIds.add(String(itemId));
    }
    conn._asrTranscriptionEventHandledThisTurn = true;

    if (conn._userTranscriptFlushTimer) {
      clearTimeout(conn._userTranscriptFlushTimer);
      conn._userTranscriptFlushTimer = null;
    }
    conn._userTranscriptLiveBuffer = '';

    logger.info(`[OpenAI Realtime] User audio transcription completed for ${callId}: "${transcript}"`);

    // Store for speech_stopped (filler filter + turn finalization). Persist + notify UI before any emergency work.
    conn.pendingUserTranscript = transcript;
    logger.info(`[OpenAI Realtime] Stored user transcript for later saving: "${transcript}"`);
    await this.persistUserTranscriptToPlaceholder(callId, transcript);

    const evidenceUserMessageId =
      conn.activeUserMessageId && mongoose.Types.ObjectId.isValid(conn.activeUserMessageId)
        ? conn.activeUserMessageId
        : null;

    // speech_stopped already ran and was waiting on ASR — finalize turn (placeholder already updated above).
    // handledPostSpeechStoppedAsrPath is LOCAL to this handler invocation only: it gates the ASR *fallback* block
    // below vs this _waitingForUserTranscript branch in the same event. It is NOT stored on conn — each
    // transcription.completed is a fresh call, so nothing persists across turns and no speech_stopped/speech_started
    // reset is required for this variable.
    let handledPostSpeechStoppedAsrPath = false;
    if (conn._waitingForUserTranscript && conn.activeUserMessageId && transcript.trim()) {
      handledPostSpeechStoppedAsrPath = true;
      logger.info(`[OpenAI Realtime] Transcript arrived after speech_stopped — finalizing user turn ${conn.activeUserMessageId}`);
      conn.activeUserMessageId = null;
      conn._waitingForUserTranscript = false;
      conn.pendingUserTranscript = '';

      if (conn._pendingAiPlaceholder && conn._aiIsSpeaking) {
        logger.info(`[OpenAI Realtime] User message finalized — creating deferred AI placeholder for ${callId}`);
        await this.createPlaceholderAssistantMessage(callId);
        conn._pendingAiPlaceholder = false;
      }

      // If speech_stopped happened before ASR completed, trigger Bianca's response now.
      // This prevents cases where Bianca appears to wait for a second user utterance.
      const stateForWaitingPath = this.getConversationState(callId);
      if (stateForWaitingPath === CONVERSATION_STATES.AI_RESPONDING) {
        logger.info(
          `[RealtimeRC] ASR _waitingForUserTranscript path skipped — already AI_RESPONDING, speech_stopped path owns this turn`
        );
      } else if (conn._userTurnResponseCreateSent) {
        logger.info(
          `[RealtimeRC] ASR _waitingForUserTranscript path skipped — user-turn response.create already sent (speech_stopped 200ms or other path)`
        );
      } else if (!conn._aiIsSpeaking && !conn._responseCreated && this.canAIRespond(callId)) {
        const postAsrGrace = this.isInGracePeriod(callId);
        const postAsrSubstantive =
          typeof transcript === 'string' && !isFiller(transcript, conn.preferredLanguage || 'en');
        if (postAsrGrace && !postAsrSubstantive) {
          const timeSinceGreeting = Date.now() - (conn._initialGreetingCompletedAt || 0);
          logger.info(
            `[OpenAI Realtime] Skipping post-ASR response for ${callId} - in grace period ` +
            `(${Math.round(timeSinceGreeting)}ms since greeting completed, need ${CONSTANTS.GRACE_PERIOD_MS}ms).`
          );
        } else if (this.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'user_transcript_completed_after_speech_stop')) {
          setTimeout(async () => {
            const currentConn = this.connections.get(callId);
            if (!currentConn || currentConn._aiIsSpeaking || currentConn._responseCreated) return;
            if (this.getConversationState(callId) !== CONVERSATION_STATES.AI_RESPONDING) return;
            if (currentConn._userTurnResponseCreateSent) {
              logger.info(
                `[RealtimeRC] ASR _waitingForUserTranscript 120ms timer skipped ${callId} — user-turn response.create already sent`
              );
              return;
            }
            try {
              currentConn._userTurnResponseCreateSent = true;
              const sent = await this.sendResponseCreate(callId);
              if (!sent) {
                currentConn._userTurnResponseCreateSent = false;
                this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'post_asr_response_failed');
                return;
              }
              this._resetAssistantOutputAudioLifecycle(currentConn);
              currentConn._aiIsSpeaking = true;
              logger.info(`[OpenAI Realtime] Triggered AI response after delayed transcript completion for ${callId}`);
            } catch (err) {
              currentConn._userTurnResponseCreateSent = false;
              logger.error(`[OpenAI Realtime] Failed post-ASR response trigger for ${callId}: ${err.message}`);
              this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'post_asr_response_failed');
            }
          }, 120);
        }
      }
    }

    // Fallback trigger: if ASR completed but speech_stopped path did not trigger a response,
    // kick off the next Bianca turn directly from transcript completion.
    // This fixes "must speak twice" hangs when state/placeholder timing is out of sync.
    //
    // CRITICAL: Do NOT run when already ai_responding — speech_stopped schedules sendResponseCreate on a
    // 200ms timer and _aiIsSpeaking is still false until that fires; treating AI_RESPONDING as "moved=true"
    // here scheduled a second response.create (80ms vs 200ms), causing phantom turns and stuck AI_RESPONDING
    // when OpenAI rejects or coalesces the duplicate.
    // Also skip entirely when the post-speech_stopped ASR path above already handled this completion event.
    const preferredLanguage = conn.preferredLanguage || 'en';
    const transcriptIsFillerOnly = isFiller(transcript, preferredLanguage);
    const inGrace = this.isInGracePeriod(callId);
    // speech_stopped can return early during post-greeting grace while ASR finishes later; allow a
    // substantive (non-filler-only) transcript to recover without a second utterance.
    const substantiveEnoughToBypassGrace =
      typeof transcript === 'string' && !transcriptIsFillerOnly;
    const stateForFallback = this.getConversationState(callId);
    if (
      !handledPostSpeechStoppedAsrPath &&
      stateForFallback !== CONVERSATION_STATES.AI_RESPONDING &&
      !transcriptIsFillerOnly &&
      !conn._aiIsSpeaking &&
      !conn._responseCreated &&
      !conn._responseStartTime &&
      (!inGrace || substantiveEnoughToBypassGrace)
    ) {
      const canMoveToAiResponding =
        stateForFallback === CONVERSATION_STATES.GREETING_COMPLETE ||
        stateForFallback === CONVERSATION_STATES.CONVERSATION_ACTIVE ||
        stateForFallback === CONVERSATION_STATES.USER_SPEAKING;
      const moved = canMoveToAiResponding
        ? this.transitionState(callId, CONVERSATION_STATES.AI_RESPONDING, 'asr_completed_fallback')
        : false;

      if (moved) {
        logger.info(`[RealtimeRC] ASR fallback scheduling sendResponseCreate ${callId}`, {
          stateBeforeTransition: stateForFallback,
        });
        setTimeout(async () => {
          const currentConn = this.connections.get(callId);
          if (!currentConn) return;
          if (currentConn._aiIsSpeaking || currentConn._responseCreated || currentConn._responseStartTime) return;
          if (this.getConversationState(callId) !== CONVERSATION_STATES.AI_RESPONDING) return;
          // FIX: Bug 3 — _userTurnResponseCreateSent alone is cleared on speech_started; 200ms path may have sent
          if (currentConn._responseCreateInFlight) {
            logger.info(`[RealtimeRC] ASR fallback skipped — response already in progress ${callId}`);
            return;
          }
          if (currentConn._userTurnResponseCreateSent) {
            logger.info(`[RealtimeRC] ASR fallback 80ms timer skipped ${callId} — user-turn response.create already sent`);
            return;
          }
          try {
            currentConn._userTurnResponseCreateSent = true;
            const sent = await this.sendResponseCreate(callId);
            if (!sent) {
              currentConn._userTurnResponseCreateSent = false;
              this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'asr_fallback_response_failed');
              return;
            }
            this._resetAssistantOutputAudioLifecycle(currentConn);
            currentConn._aiIsSpeaking = true;
            logger.info(`[OpenAI Realtime] Triggered AI response from ASR fallback for ${callId}`);
          } catch (err) {
            currentConn._userTurnResponseCreateSent = false;
            logger.error(`[OpenAI Realtime] Failed ASR fallback response trigger for ${callId}: ${err.message}`);
            this.transitionState(callId, CONVERSATION_STATES.CONVERSATION_ACTIVE, 'asr_fallback_response_failed');
          }
        }, 80);
      }
    }

    // EMERGENCY DETECTION: runs only after transcript is pushed to the frontend (notify) and DB update started/finished.
    logger.debug(`[Emergency Detection] Checking transcript - clientId: ${conn.clientId}, transcript length: ${transcript.length || 0}`);

    if (conn.clientId && transcript.length > 10) {
      try {
        logger.info(`[Emergency Detection] Processing utterance for emergency detection: "${transcript.substring(0, 100)}..."`);
        const emergencyResult = await emergencyProcessor.processUtterance(
          conn.clientId,
          transcript,
          Date.now(),
          conn.conversationId || null
        );

        logger.info(`[Emergency Detection] Emergency detection result - shouldAlert: ${emergencyResult.shouldAlert}, reason: ${emergencyResult.reason}`);

        if (emergencyResult.shouldAlert) {
          logger.warn(`[Emergency Detection] EMERGENCY DETECTED for client ${conn.clientId}: ${emergencyResult.reason}`);
          logger.warn(`[Emergency Detection] Alert data:`, emergencyResult.alertData);

          logger.info(`[Emergency Detection] Calling createAlert for client ${conn.clientId}`);
          const alertResult = await emergencyProcessor.createAlert(
            conn.clientId,
            emergencyResult.alertData,
            transcript,
            {
              conversationId: conn.conversationId || null,
              detectionSource: emergencyResult.detectionSource || 'phrase_match',
              ...(evidenceUserMessageId ? { messageId: evidenceUserMessageId } : {}),
            }
          );

          logger.info(`[Emergency Detection] createAlert result - success: ${alertResult.success}, error: ${alertResult.error || 'none'}`);
          if (alertResult.notificationResult) {
            logger.info(`[Emergency Detection] Notification result:`, alertResult.notificationResult);
          }

          if (alertResult.success) {
            logger.info(`[Emergency Detection] Alert created successfully: ${alertResult.alert?.id || alertResult.alert?._id}`);

            if (alertResult.smsNotificationSent) {
              try {
                const emergencyInstruction = `\n\nCRITICAL: An emergency alert has been AUTOMATICALLY sent to the patient's caregiver via text message. In your next response, you MUST inform them: "I've already sent an alert to your caregiver. They'll be notified right away. Please call emergency services right away if you need immediate medical help." Do NOT offer to call emergency services yourself - you cannot make calls. Use "emergency services" (not "911") as it works in all countries. ONLY say this because the system has confirmed an alert was sent.`;

                const updatedInstructions = (conn.initialPrompt || '') + emergencyInstruction;

                await this.sendJsonMessage(callId, {
                  type: 'session.update',
                  session: {
                    instructions: updatedInstructions
                  }
                });

                logger.info(
                  `[Emergency Detection] Updated session instructions for ${callId} to include caregiver SMS confirmation`
                );
              } catch (updateError) {
                logger.error(`[Emergency Detection] Failed to update session instructions: ${updateError.message}`);
              }
            } else {
              logger.info(
                `[Emergency Detection] No caregiver SMS for this alert (dashboard-only or SMS not sent) — session instructions unchanged`
              );
            }

            if (emergencyResult.alertData.severity === 'CRITICAL') {
              logger.warn(`[Emergency Detection] CRITICAL emergency - consider immediate intervention for patient ${conn.clientId}`);
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
      }
    } else {
      if (!conn.clientId) {
        logger.debug(`[Emergency Detection] Skipping - no clientId in connection for ${callId}`);
      }
      if (transcript.length <= 10) {
        logger.debug(`[Emergency Detection] Skipping - transcript too short (${transcript.length} chars) for ${callId}`);
      }
    }
  }

  /**
   * Input ASR failed — avoid leaving "[Speaking...]" rows with no text.
   */
  async handleInputAudioTranscriptionFailed(callId, message) {
    const errPayload = message?.error || message;
    logger.error(
      `[OpenAI Realtime] Input audio transcription failed for ${callId}: ${typeof errPayload === 'object' ? JSON.stringify(errPayload) : errPayload}`
    );

    const conn = this.connections.get(callId);
    if (!conn) return;

    if (conn._userTranscriptFlushTimer) {
      clearTimeout(conn._userTranscriptFlushTimer);
      conn._userTranscriptFlushTimer = null;
    }
    conn._userTranscriptLiveBuffer = '';
    conn.pendingUserTranscript = '';
    conn._waitingForUserTranscript = false;
    await this.removeUserSpeakingPlaceholder(callId, 'input_audio_transcription.failed');
  }

  /**
   * Handle API errors - ENHANCED with recovery mechanisms
   */
  async handleApiError(callId, message) {
    const errorMsg = message.error?.message || 'Unknown OpenAI API error';
    const errorCode = message.error?.code || 'UNKNOWN_CODE';
    logger.warn(`[RealtimeRC] handleApiError callId=${callId}`, {
      code: errorCode,
      message: errorMsg,
      param: message.error?.param,
      type: message.error?.type,
    });
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
      if (conn) {
        conn.pendingCommit = false; // If this error was related to a commit that also triggered a response.create
        conn._responseCreateInFlight = false;
      }
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
    if (!audioBase64) {
      logger.warn(`[OpenAI Realtime] processAudioResponse called with empty audioBase64 for ${callId}`);
      return;
    }

    const rtpSenderService = require('./rtp.sender.service');
    if (rtpSenderService.isFlushInProgress(callId)) {
      return;
    }

    const conn = this.connections.get(callId);
    if (conn) {
      this._markAssistantPlaybackActive(conn);
    }

    try {
      // Track audio processing
      if (!this._audioProcessCount) this._audioProcessCount = new Map();
      const count = (this._audioProcessCount.get(callId) || 0) + 1;
      this._audioProcessCount.set(callId, count);
      
      // Log first few chunks and periodically
      if (count <= 10 || count % 50 === 0) {
        const useGA = config.openai.useGA !== undefined ? config.openai.useGA : false;
        const apiVersion = useGA ? 'GA' : 'Beta';
        logger.info(`[OpenAI Realtime] Processing audio chunk #${count} for ${callId} (${apiVersion}), base64 length: ${audioBase64.length}`);
      }

      // Simple direct pass-through
      const ulawBuffer = Buffer.from(audioBase64, 'base64');
      if (ulawBuffer.length === 0) {
        logger.warn(`[OpenAI Realtime] Decoded audio buffer is empty for ${callId}`);
        return;
      }

      // Record for debugging
      await this.appendToContinuousDebugFile(callId, 'continuous_from_openai_ulaw.ulaw', ulawBuffer);

      // Send to RTP immediately
      if (count <= 10 || count % 50 === 0) {
        logger.info(`[OpenAI Realtime] Sending audio chunk #${count} to ARI for ${callId}, buffer size: ${ulawBuffer.length} bytes`);
      }
      
      this.notify(callId, 'audio_chunk', {
        audio: audioBase64,
        originalSizeBytes: ulawBuffer.length,
        ulawSizeBytes: ulawBuffer.length
      });

    } catch (err) {
      logger.error(`[OpenAI Realtime] Error processing audio for ${callId}: ${err.message}`, err);
    }
  }

  /**
   * Submit tool result to OpenAI Realtime (GA function_call_output).
   */
  async submitFunctionCallOutput(callId, openaiCallId, outputObj) {
    if (!openaiCallId) return;
    const output = typeof outputObj === 'string' ? outputObj : JSON.stringify(outputObj);
    try {
      await this.sendJsonMessage(callId, {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: openaiCallId,
          output,
        },
      });
    } catch (err) {
      logger.error(`[OpenAI Realtime] submitFunctionCallOutput failed: ${err.message}`);
    }
  }

  /**
   * Legacy: onboarding no longer uses Realtime tools; kept for any in-flight sessions still exposing tools.
   */
  async processOnboardingToolInvocation(callId, item, dbConversationId) {
    const conn = this.connections.get(callId);
    if (!conn?.onboardingDay) return;

    let name;
    let argsRaw;
    let openaiCallId;

    if (item.type === 'function_call') {
      name = item.name;
      argsRaw = item.arguments;
      openaiCallId = item.call_id || item.id;
    } else if (item.function_call) {
      name = item.function_call.name;
      argsRaw = item.function_call.arguments;
      openaiCallId = item.function_call.call_id || item.function_call.id || item.id;
    } else {
      return;
    }

    if (!name || !openaiCallId) return;

    if (name !== 'capture_onboarding_response' && name !== 'complete_onboarding_session') {
      await this.submitFunctionCallOutput(callId, openaiCallId, { ok: false, error: 'unsupported_tool', name });
      try {
        await this.sendResponseCreate(callId);
      } catch (e) {
        logger.warn(`[Onboarding Tool] sendResponseCreate after unknown tool: ${e.message}`);
      }
      return;
    }

    let args = {};
    try {
      args = typeof argsRaw === 'string' ? JSON.parse(argsRaw || '{}') : argsRaw || {};
    } catch (e) {
      logger.error(`[Onboarding Tool] Bad JSON arguments: ${e.message}`);
    }

    const onboardingService = require('./onboarding.service');

    try {
      if (name === 'capture_onboarding_response' && args.question_id) {
        await onboardingService.recordCapture({
          clientId: conn.clientId,
          dayNumber: conn.onboardingDay,
          questionId: String(args.question_id),
          responseType: args.response_type || 'text',
          responseValue: args.response_value,
          verbatimTranscript: args.verbatim_transcript,
          callId: conn.onboardingCallMongoId
            ? new mongoose.Types.ObjectId(String(conn.onboardingCallMongoId))
            : undefined,
          conversationId:
            dbConversationId && mongoose.Types.ObjectId.isValid(String(dbConversationId))
              ? new mongoose.Types.ObjectId(String(dbConversationId))
              : undefined,
          safety_flag: args.safety_flag,
          memory_flag: args.memory_flag,
          mood_flag: args.mood_flag,
          distress_flag: args.distress_flag,
          confusion_flag: args.confusion_flag,
          notes: args.notes,
        });
      } else if (name === 'complete_onboarding_session') {
        await onboardingService.completeSession({
          callMongoId: conn.onboardingCallMongoId,
          endedEarlyReason: args.ended_early_reason || 'completed',
          summaryNotes: args.summary_notes,
        });
      }
    } catch (err) {
      logger.error(`[Onboarding Tool] ${err.message}`);
    }

    await this.submitFunctionCallOutput(callId, openaiCallId, { ok: true, tool: name });
    try {
      await this.sendResponseCreate(callId);
    } catch (e) {
      logger.warn(`[Onboarding Tool] sendResponseCreate after tool: ${e.message}`);
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
        const fcName = item.function_call?.name || item.name;
        logger.info(`[OpenAI Realtime] Function call: ${fcName}`);

        if (dbConversationId && (item.function_call || item.name)) {
          try {
            const conversationService = require('./conversation.service');
            const fn = item.function_call || { name: item.name, arguments: item.arguments };
            const argStr =
              typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments || {});
            const functionContent = `Function call: ${fn.name}(${argStr})`;
            await conversationService.saveRealtimeMessage(
              dbConversationId,
              item.role || 'assistant',
              functionContent,
              'function_call'
            );
          } catch (dbErr) {
            logger.error(`[OpenAI Realtime] Failed to save function call: ${dbErr.message}`);
          }
        }

        this.notify(callId, 'function_call', {
          call: item.function_call || { name: item.name, arguments: item.arguments },
          itemId: item.id,
          timestamp: new Date()
        });

        await this.processOnboardingToolInvocation(callId, item, dbConversationId);
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

    // Pre-session: do not buffer appends (see sendAudioChunk; flush-before-greeting caused overlap)
    if (messageObj.type === 'input_audio_buffer.append' && callId && conn && (!conn.sessionReady || conn._sessionSetupInProgress)) {
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
      // Do not buffer pre-session audio: it all landed in one flush before the greeting and caused overlap/extra turns.
      const nPre = (conn._dropPreSessionAudioLogged = (conn._dropPreSessionAudioLogged || 0) + 1);
      if (nPre <= 3) {
        logger.debug(
          `[OpenAI Realtime] Dropping user audio chunk (session not ready) for ${callId} — no pendingAudio buffer`
        );
      }
      return;
    }

    if (!bypassBuffering && !conn._userInputToOpenAIAllowed) {
      const nGate = (conn._dropUntilAssistantAudioLogged = (conn._dropUntilAssistantAudioLogged || 0) + 1);
      if (nGate <= 3) {
        logger.debug(
          `[OpenAI Realtime] Dropping user audio until first assistant output audio for ${callId} (bypass only for test/noise pipelines)`
        );
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
      this._resetAssistantOutputAudioLifecycle(conn);
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
      conn._responseCreateInFlight = false;

      // Send a user message first to establish context
      await this.sendJsonMessage(callId, {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello, can you hear me?' }]
        }
      });

      // Use sendResponseCreate (not raw response.create) so canAIRespond, _responseCreateInFlight, and
      // session checks run — raw send would bypass guards and could double with event-driven paths.
      await this.sendResponseCreate(callId);

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
      // OPENAI_IDLE_TIMEOUT: 0 = disabled (no max call length from this health check)
      const idleTimeout = config.openai?.idleTimeout ?? 0;

      for (const [callId, conn] of this.connections.entries()) {
        // Check for idle connections (only when idleTimeout > 0)
        if (
          idleTimeout > 0 &&
          conn.lastActivity &&
          now - conn.lastActivity > idleTimeout
        ) {
          logger.warn(`[OpenAI Realtime] Connection ${callId} idle timeout (${idleTimeout}ms). Cleaning up.`);
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

    const connPreDelete = this.connections.get(callId);
    if (connPreDelete) {
      connPreDelete._responseCreateInFlight = false;
      this._clearResponseStuckRecoveryTimers(connPreDelete);
      this._clearAiAudioCompleteDebounceTimer(connPreDelete);
      if (connPreDelete._speechStoppedFinalizeTimer) {
        clearTimeout(connPreDelete._speechStoppedFinalizeTimer);
        connPreDelete._speechStoppedFinalizeTimer = null;
      }
      connPreDelete._speechStoppedFinalizePending = false;
      connPreDelete._speechStoppedCommittedAiResponding = false;
      connPreDelete._userTurnResponseCreateSent = false;
      if (connPreDelete._processedTranscriptItemIds) {
        // FIX: Bug 1 — not only per speech_started; release Set on teardown
        connPreDelete._processedTranscriptItemIds.clear();
      }
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

    const conn = this.connections.get(callId);
    const allow = process.env.OPENAI_DEBUG_AUDIO === 'true' || conn?.debugAudioUploadEnabled;
    if (!allow) return;

    const callAudioDir = path.join(DEBUG_AUDIO_LOCAL_DIR, callId);
    if (!fs.existsSync(callAudioDir) || !conn?._debugFilesInitialized) {
      this.initializeContinuousDebugFiles(callId);
      if (conn) conn._debugFilesInitialized = true;
    }

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
      const allow =
        process.env.OPENAI_DEBUG_AUDIO === 'true' || (conn && conn.debugAudioUploadEnabled);
      if (!allow) {
        logger.info(
          `[AUDIO DEBUG] Skipping S3 debug upload (disabled; enable per-org in admin or set OPENAI_DEBUG_AUDIO=true) for ${callId}`
        );
        return [];
      }

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
      let conversationId = conn?.conversationId;
      const callType = conn?.callType || 'unknown';

      // If connection had no conversationId (e.g. race or init path), resolve from Call so we still finalize + sentiment
      if (!conversationId && callId) {
        try {
          const { Call } = require('../models');
          const call = await Call.findOne({
            $or: [{ callSid: callId }, { asteriskChannelId: callId }],
          }).select('conversationId');
          if (call?.conversationId) {
            conversationId = call.conversationId.toString();
            logger.info(`[OpenAI Call End] Resolved conversationId ${conversationId} from Call for ${callId}`);
          }
        } catch (resolveErr) {
          logger.warn(`[OpenAI Call End] Could not resolve conversationId for ${callId}: ${resolveErr.message}`);
        }
      }

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
            await this.flushDeferredAssistantQueue(callId);
          } else {
            // No placeholder - create new message
            await this.saveCompleteMessage(callId, 'client', conn.pendingUserTranscript);
            await this.flushDeferredAssistantQueue(callId);
          }
          
          conn.pendingUserTranscript = '';
        }

        // Never persist bare "[Speaking...]" if the call ended before transcript/placeholder flow completed
        if (conn.activeUserMessageId) {
          const orphanUser = await Message.findById(conn.activeUserMessageId).select('content').lean();
          if (orphanUser?.content === SPEAKING_PLACEHOLDER_TEXT) {
            await Message.findByIdAndDelete(conn.activeUserMessageId);
            logger.info(`[OpenAI Call End] Removed orphan user [Speaking...] placeholder for ${callId}`);
          } else if (orphanUser) {
            logger.warn(
              `[OpenAI Call End] User placeholder ${conn.activeUserMessageId} still active at hangup — leaving message in DB`
            );
          }
          conn.activeUserMessageId = null;
          conn._waitingForUserTranscript = false;
        }

        await this.flushDeferredAssistantQueue(callId, { force: true });

        if (conn.activeAssistantMessageId) {
          const orphanAi = await Message.findById(conn.activeAssistantMessageId).select('content').lean();
          if (orphanAi?.content === SPEAKING_PLACEHOLDER_TEXT) {
            await Message.findByIdAndDelete(conn.activeAssistantMessageId);
            logger.info(`[OpenAI Call End] Removed orphan assistant [Speaking...] placeholder for ${callId}`);
          } else if (orphanAi) {
            logger.warn(
              `[OpenAI Call End] Assistant placeholder ${conn.activeAssistantMessageId} still active at hangup — leaving message in DB`
            );
          }
          conn.activeAssistantMessageId = null;
        }

        // Save any pending assistant message
        if (conn.pendingAssistantTranscript) {
          logger.info(`[OpenAI Call End] Saving pending assistant message for ${callId}`);
          const pendingAi = conn.pendingAssistantTranscript;
          conn.pendingAssistantTranscript = '';
          await this.commitAssistantTranscriptOrDefer(callId, conn, pendingAi);
          await this.flushDeferredAssistantQueue(callId, { force: true });
        }

        // Clear context window for this patient when call ends
        if (conn.clientId) {
          try {
            const contextWindow = getConversationContextWindow();
            contextWindow.clearClientContext(conn.clientId);
            logger.debug(`[Context Window] Cleared context for patient ${conn.clientId} at call end`);
          } catch (error) {
            logger.warn(`[Context Window] Failed to clear context: ${error.message}`);
          }
        }

        // Onboarding: derive structured answers from saved transcripts (no Realtime tools)
        if (conn.onboardingDay >= 1 && conn.onboardingDay <= 4 && conversationId && conn.clientId) {
          if (!conn.realtimeSessionEstablished) {
            logger.info(
              `[Onboarding] Skipping transcript capture for ${callId} day ${conn.onboardingDay}: Realtime session never became ready`
            );
          } else {
            try {
              const onboardingTranscriptCaptureService = require('./onboardingTranscriptCapture.service');
              await onboardingTranscriptCaptureService.captureFromConversation({
                conversationId,
                clientId: conn.clientId,
                dayNumber: conn.onboardingDay,
                callMongoId: conn.onboardingCallMongoId,
              });
            } catch (capErr) {
              logger.warn(`[Onboarding] Transcript capture failed: ${capErr.message}`);
            }
          }
        }

        // Onboarding: mark the onboarding Call complete when the voice session ends — only if Realtime actually connected.
        // Otherwise a failed WS/handshake still ends the phone leg but must not advance journey to the next day.
        if (conn.onboardingDay >= 1 && conn.onboardingDay <= 4 && conn.onboardingCallMongoId) {
          try {
            const { Call } = require('../models');
            const onboardingService = require('./onboarding.service');
            const existing = await Call.findById(conn.onboardingCallMongoId).select('onboardingCompletedAt').lean();
            if (existing && !existing.onboardingCompletedAt) {
              if (!conn.realtimeSessionEstablished) {
                logger.warn(
                  `[Onboarding] Not marking onboarding complete for call ${conn.onboardingCallMongoId} (day ${conn.onboardingDay}): OpenAI Realtime session never became ready — next outbound will retry the same day`
                );
              } else {
                await onboardingService.completeSession({
                  callMongoId: conn.onboardingCallMongoId,
                  endedEarlyReason: 'completed',
                });
                logger.info(
                  `[Onboarding] Marked call ${conn.onboardingCallMongoId} complete at voice session end (day ${conn.onboardingDay})`
                );
              }
            }
          } catch (obErr) {
            logger.warn(`[Onboarding] Could not auto-complete session on call end: ${obErr.message}`);
          }
        }
      }

      // Upload debug audio when per-org (or env) allows it
      logger.info(`[OpenAI Call End] Debug audio upload path for ${callId} (if enabled for org or OPENAI_DEBUG_AUDIO)...`);

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
        // Always use GA API - model is 'gpt-realtime'
        const model = config.openai.realtimeModel || 'gpt-realtime';
        const voice = config.openai.realtimeVoice || 'alloy';
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;
        logger.info(`[OpenAI TestConn] Connecting to ${wsUrl}`);

        // Build headers - GA API does not use beta header
        const headers = {
          Authorization: `Bearer ${config.openai.apiKey}`,
        };
        
        logger.info(`[OpenAI TestConn] Using GA API`);
        
        wsClient = new WebSocket(wsUrl, { headers });

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

            // Use MessageHandler to build session config (supports both Beta and GA)
            const testConnection = { initialPrompt: `Test connection prompt for ${testId}` };
            const sessionConfig = MessageHandler.buildSessionConfig(testConnection);
            // Add test-specific metadata (not sent to OpenAI)
            sessionConfig._testWebSocket = wsClient;
            sessionConfig._testId = testId;

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
                      model: config.openai.realtimeModel || 'gpt-realtime-2025-08-28'
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