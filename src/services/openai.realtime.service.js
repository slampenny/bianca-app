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
  MAX_PENDING_CHUNKS: 150, // Increased buffer size to handle audio bursts
  RECONNECT_MAX_ATTEMPTS: 5, // Maximum number of reconnection attempts
  RECONNECT_BASE_DELAY: 1000, // Base delay for exponential backoff (milliseconds)
  COMMIT_DEBOUNCE_DELAY: 200, // Reduced to 200ms for more responsive audio
  CONNECTION_TIMEOUT: 15000, // WebSocket connection + handshake timeout (milliseconds)
  DEFAULT_SAMPLE_RATE: 24000, // OpenAI Realtime API uses 24kHz for PCM16
  ASTERISK_SAMPLE_RATE: 8000, // Rate of audio FOR Asterisk (uLaw)
  OPENAI_PCM_OUTPUT_RATE: 24000, // Expected rate FROM OpenAI for pcm16 output
  TEST_CONNECTION_TIMEOUT: 20000, // Timeout for the standalone test connection method (milliseconds)
  AUDIO_BATCH_SIZE: 30, // Reduced batch size for more frequent commits
  MIN_AUDIO_DURATION_MS: 50, // Reduced minimum duration for faster response
  MIN_AUDIO_BYTES: 400, // Reduced minimum bytes for 50ms of uLaw audio at 8kHz
  INITIAL_SILENCE_MS: 200, // Add 200ms of silence at start to prevent static burst
  AUDIO_QUALITY_CHECK_INTERVAL: 5000, // Check audio quality every 5 seconds
  MAX_CONSECUTIVE_SILENCE_CHUNKS: 50, // Maximum consecutive silence chunks before warning
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
   * Create initial silence buffer to prevent static burst
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Base64 encoded silence
   */
  createInitialSilence(durationMs = CONSTANTS.INITIAL_SILENCE_MS) {
    const samples = Math.floor((durationMs / 1000) * 8000); // 8kHz sample rate
    const silenceBuffer = Buffer.alloc(samples, 0x7F); // uLaw silence is 0x7F
    return silenceBuffer.toString('base64');
  }

  /**
   * Check if audio chunk is silence
   * @param {string} audioBase64 - Base64 encoded uLaw audio
   * @returns {boolean} True if audio is silence
   */
  isAudioSilence(audioBase64) {
    try {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const silenceValue = 0x7F; // uLaw silence
      const tolerance = 2; // Allow small variations
      
      for (let i = 0; i < audioBuffer.length; i++) {
        if (Math.abs(audioBuffer[i] - silenceValue) > tolerance) {
          return false;
        }
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Monitor audio quality and detect issues
   * @param {string} callId - Call identifier
   */
  monitorAudioQuality(callId) {
    const conn = this.connections.get(callId);
    if (!conn) return;

    const now = Date.now();
    const callDuration = now - conn.startTime;
    
    // Check for issues around 30-second mark
    if (callDuration > 25000 && callDuration < 35000) {
      const audioChunksPerSecond = conn.audioChunksReceived / (callDuration / 1000);
      const expectedChunksPerSecond = 50; // At 8kHz, 20ms chunks = 50 chunks/second
      
      if (audioChunksPerSecond < expectedChunksPerSecond * 0.8) {
        logger.warn(`[OpenAI Realtime] Audio quality issue detected for ${callId} at ${Math.round(callDuration/1000)}s: ${audioChunksPerSecond.toFixed(1)} chunks/sec (expected ~${expectedChunksPerSecond})`);
      }
    }
    
    // Check for excessive silence
    if (conn.consecutiveSilenceChunks > CONSTANTS.MAX_CONSECUTIVE_SILENCE_CHUNKS) {
      logger.warn(`[OpenAI Realtime] Audio quality warning for ${callId}: ${conn.consecutiveSilenceChunks} consecutive silence chunks`);
    }
  }

  /**
   * Validate audio chunk before sending to OpenAI - ENHANCED with better error detection
   * @param {string} audioBase64 - Base64 encoded uLaw audio
   * @returns {Object} Validation result with isValid, size, duration, and reason
   */
  validateAudioChunk(audioBase64) {
    if (!audioBase64 || typeof audioBase64 !== 'string' || audioBase64.length === 0) {
      return { isValid: false, reason: 'Empty or invalid audio data' };
    }

    try {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      
      if (audioBuffer.length === 0) {
        return { isValid: false, reason: 'Decoded audio buffer is empty' };
      }

      // ENHANCED: Check for reasonable audio buffer size
      // At 8kHz, 1 byte per sample, 20ms = 160 bytes
      const minBytes = 80;  // 10ms minimum
      const maxBytes = 3200; // 400ms maximum
      
      if (audioBuffer.length < minBytes) {
        return { 
          isValid: false, 
          reason: `Audio buffer too small: ${audioBuffer.length} bytes (minimum ${minBytes})` 
        };
      }
      
      if (audioBuffer.length > maxBytes) {
        return { 
          isValid: false, 
          reason: `Audio buffer too large: ${audioBuffer.length} bytes (maximum ${maxBytes})` 
        };
      }

      // ENHANCED: Check for valid uLaw audio data
      // uLaw values should be in range 0x00-0xFF
      let validBytes = 0;
      let totalBytes = audioBuffer.length;
      
      for (let i = 0; i < Math.min(100, totalBytes); i++) { // Check first 100 bytes
        const byte = audioBuffer[i];
        if (byte >= 0 && byte <= 255) {
          validBytes++;
        }
      }
      
      const validPercentage = (validBytes / Math.min(100, totalBytes)) * 100;
      if (validPercentage < 90) {
        return { 
          isValid: false, 
          reason: `Invalid audio data: only ${validPercentage.toFixed(1)}% valid bytes` 
        };
      }

      const durationMs = (audioBuffer.length / 8); // 8kHz, 1 byte per sample
      
      // Log validation details for debugging (but only occasionally)
      if (Math.random() < 0.01) { // 1% of the time
        const firstBytes = audioBuffer.slice(0, Math.min(5, audioBuffer.length));
        logger.debug(`[OpenAI Realtime] Audio validation: ${audioBuffer.length} bytes (${durationMs.toFixed(1)}ms), first bytes: [${Array.from(firstBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
      }
      
      return {
        isValid: true,
        size: audioBuffer.length,
        durationMs: Math.round(durationMs),
        reason: 'Valid audio chunk'
      };
    } catch (err) {
      return { isValid: false, reason: `Audio validation error: ${err.message}` };
    }
  }

  /**
   * Check if we have sufficient audio data to commit
   * @param {string} callId - Call identifier
   * @returns {Object} Commit readiness with canCommit, totalBytes, totalDuration, and reason
   */
  checkCommitReadiness(callId) {
    const conn = this.connections.get(callId);
    if (!conn) {
      return { canCommit: false, reason: 'No connection found' };
    }

    // Check if we have any audio chunks sent
    if (conn.audioChunksSent === 0) {
      return { canCommit: false, reason: 'No audio chunks sent yet' };
    }

    // Check if we have any valid audio chunks sent (track this separately)
    if (!conn.validAudioChunksSent) {
      conn.validAudioChunksSent = 0;
    }
    
    if (conn.validAudioChunksSent === 0) {
      return { canCommit: false, reason: 'No valid audio chunks sent yet' };
    }

    // CRITICAL FIX: Calculate total audio duration more precisely
    // Use actual audio bytes sent for more accurate duration calculation
    // At 8kHz uLaw: 1 byte = 0.125ms (8000 samples/sec = 8000 bytes/sec)
    let estimatedDurationMs;
    if (conn.totalAudioBytesSent && conn.totalAudioBytesSent > 0) {
      // Use actual bytes for precise calculation
      estimatedDurationMs = (conn.totalAudioBytesSent / 8); // 8kHz, 1 byte per sample
    } else {
      // Fallback to chunk-based estimation
      estimatedDurationMs = conn.validAudioChunksSent * 20; // Rough estimate
    }
    
    const safetyMarginMs = 50; // Increase safety margin to 50ms
    const adjustedDurationMs = estimatedDurationMs + safetyMarginMs;

    if (adjustedDurationMs < CONSTANTS.MIN_AUDIO_DURATION_MS) {
      // Only log every 50th check to reduce noise
      if (conn.validAudioChunksSent % 50 === 0) {
        logger.debug(`[OpenAI Realtime] Commit readiness check for ${callId}: insufficient duration (${adjustedDurationMs}ms < ${CONSTANTS.MIN_AUDIO_DURATION_MS}ms), chunks sent: ${conn.validAudioChunksSent}, raw estimate: ${estimatedDurationMs}ms, bytes: ${conn.totalAudioBytesSent || 0}`);
      }
      return { 
        canCommit: false, 
        totalDuration: adjustedDurationMs,
        reason: `Insufficient audio duration: ${adjustedDurationMs}ms (minimum ${CONSTANTS.MIN_AUDIO_DURATION_MS}ms)` 
      };
    }

    // Only log every 50th check to reduce noise
    if (conn.validAudioChunksSent % 50 === 0) {
      logger.debug(`[OpenAI Realtime] Commit readiness check for ${callId}: ready to commit (${adjustedDurationMs}ms, ${conn.validAudioChunksSent} chunks, raw estimate: ${estimatedDurationMs}ms, bytes: ${conn.totalAudioBytesSent || 0})`);
    }
    return {
      canCommit: true,
      totalDuration: adjustedDurationMs,
      reason: 'Sufficient audio data for commit'
    };
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
  async initialize(initialAsteriskChannelId, callSid, conversationId, initialPrompt) {
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
    const ready =
      connection &&
      connection.webSocket && // Changed from 'ws' to 'webSocket'
      connection.webSocket.readyState === WebSocket.OPEN &&
      connection.sessionReady === true;

    logger.debug(
      `[OpenAI Realtime] Connection ready check for ${callId}: ${ready ? 'YES' : 'NO'
      } (exists: ${!!connection}, ws: ${!!connection?.webSocket}, wsState: ${connection?.webSocket?.readyState
      }, sessionReady: ${connection?.sessionReady})`
    );

    return ready;
  }

  /**
   * Send response.create to trigger OpenAI to generate responses - ENHANCED with diagnostics
   */
  async sendResponseCreate(callId) {
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
              logger.info(`[OpenAI Realtime] Attempting to generate new response after timeout for ${callId}`);
              await this.sendResponseCreate(callId);
            } catch (err) {
              logger.error(`[OpenAI Realtime] Failed to generate new response after timeout for ${callId}: ${err.message}`);
            }
          }, 1000);
        }
      }, 10000); // 10 second timeout
      
      // Add a more aggressive timeout check every 5 seconds
      const aggressiveTimeout = setInterval(() => {
        const currentConn = this.connections.get(callId);
        if (currentConn && currentConn._responseCreated && currentConn._responseStartTime) {
          const responseAge = Date.now() - currentConn._responseStartTime;
          if (responseAge > 15000) { // 15 seconds
            logger.warn(`[OpenAI Realtime] Aggressive timeout for ${callId} - response stuck for ${responseAge}ms, forcing reset`);
            currentConn._responseCreated = false;
            currentConn._responseStartTime = null;
            clearInterval(aggressiveTimeout);
            
            // Force a new response generation
            setTimeout(async () => {
              try {
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
          'OpenAI-Beta': 'realtime=v1',
        },
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
   * Handle connection errors consistently with enhanced recovery
   */
  handleConnectionError(callId, error) {
    this.clearConnectionTimeout(callId);
    this.updateConnectionStatus(callId, 'error');

    // Enhanced error classification and recovery
    const errorMessage = error.message || error.toString();
    let shouldReconnect = true;
    let recoveryAction = 'reconnect';

    // Classify errors for appropriate recovery
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      logger.warn(`[OpenAI Realtime] Network connectivity issue for ${callId}: ${errorMessage}`);
      recoveryAction = 'network_retry';
    } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      logger.error(`[OpenAI Realtime] Authentication error for ${callId}: ${errorMessage}`);
      shouldReconnect = false; // Don't retry auth errors
      recoveryAction = 'auth_failure';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      logger.warn(`[OpenAI Realtime] Rate limit/quota issue for ${callId}: ${errorMessage}`);
      recoveryAction = 'rate_limit_retry';
    } else {
      logger.error(`[OpenAI Realtime] General connection error for ${callId}: ${errorMessage}`);
      recoveryAction = 'general_retry';
    }

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
      setTimeout(() => this.attemptReconnect(callId), delay);
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
              logger.info(`[OpenAI Realtime] Auto-triggering response generation after recovery for ${callId}`);
              await this.sendResponseCreate(callId);
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
   * Validate connection health with enhanced monitoring
   */
  async checkConnectionHealth(callId) {
    const conn = this.connections.get(callId);
    if (!conn) return false;

    const isHealthy = conn.webSocket?.readyState === WebSocket.OPEN && conn.sessionReady && conn.status === 'connected';
    
    // Enhanced health monitoring
    if (!isHealthy) {
      const timeSinceLastActivity = Date.now() - conn.lastActivity;
      const maxInactivityTime = 30000; // 30 seconds
      
      if (timeSinceLastActivity > maxInactivityTime && conn.status === 'connected') {
        logger.warn(`[OpenAI Realtime] Connection ${callId} appears stuck (${timeSinceLastActivity}ms since last activity). Triggering recovery.`);
        this.handleConnectionError(callId, new Error('Connection timeout - no activity'));
        return false;
      }
    }

    return isHealthy;
  }

  /**
   * Process messages received from the OpenAI WebSocket - Simplified flow
   */
  /**
 * UPDATED: Main message handler with all transcript saving
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
    logger.info(
      `[OpenAI Realtime] RECEIVED from OpenAI (${callId}): type=${message.type}${message.type === 'response.content_part.added' && message.part ? `, part_type=${message.part.type}` : ''
      }${message.type === 'conversation.item.created' ? `, item_type=${message.item?.type}, role=${message.item?.role}` : ''
      }`
    );
    
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
          await this.handleContentPartAdded(callId, message);
          break;

        case 'response.audio.delta':
          logger.info(`[OpenAI Realtime] Switch case 'response.audio.delta' hit for ${callId}`);
          await this.handleResponseAudioDelta(callId, message);
          break;

        case 'conversation.item.created':
          await this.handleConversationItemCreated(callId, message);
          break;

        case 'response.done':
          logger.info(`[OpenAI Realtime] Assistant response done for ${callId}`);
          logger.info(`[OpenAI Realtime] Response lifecycle for ${callId}: done at ${new Date().toISOString()}`);
          if (conn) {
            conn._responseCreated = false; // Reset flag to allow new commits
            logger.info(`[OpenAI Realtime] Reset response flag for ${callId} - commits now allowed`);
          }
          await this.handleResponseDone(callId);
          break;

        // ENHANCED: Save user speech transcripts
        case 'conversation.item.input_audio_transcription.completed':
          await this.handleInputAudioTranscriptionCompleted(callId, message);
          break;

        // ENHANCED: Save assistant speech transcripts
        case 'response.audio_transcript.delta':
          await this.handleResponseAudioTranscriptDelta(callId, message);
          break;

        case 'input_audio_buffer.speech_started':
          logger.info(`[OpenAI Realtime] Speech started detected for ${callId}`);

          // Only trigger AI response on the very first speech of the conversation
          if (conn && !conn._userHasSpoken) {
            conn._userHasSpoken = true;
            logger.info(`[OpenAI Realtime] First user speech detected for ${callId} - will trigger AI response after speech ends`);
          }

          this.notify(callId, 'speech_started', {});
          break;

        /**
         * Handle speech stopped - UPDATED
         */
        case 'input_audio_buffer.speech_stopped':
          logger.info(`[OpenAI Realtime] Speech stopped detected for ${callId}`);

          // User stopped speaking - now we can save their complete message
          if (conn?.pendingUserTranscript) {
            await this.saveCompleteMessage(callId, 'user', conn.pendingUserTranscript);
            conn.pendingUserTranscript = '';
          }

          // Trigger AI response when user finishes speaking (natural conversation flow)
          if (conn && conn._userHasSpoken) {
            logger.info(`[OpenAI Realtime] User finished speaking for ${callId} - triggering AI response`);
            setTimeout(async () => {
              try {
                await this.sendResponseCreate(callId);
                logger.info(`[OpenAI Realtime] Triggered AI response after user finished speaking for ${callId}`);
              } catch (err) {
                logger.error(`[OpenAI Realtime] Failed to trigger AI response after user finished speaking for ${callId}: ${err.message}`);
              }
            }, 300); // Small delay to ensure speech processing is complete
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
            conn.totalAudioBytesSent = 0; // Reset audio bytes counter
            conn.consecutiveBufferErrors = 0; // Reset error counter on successful commit
            logger.info(`[OpenAI Realtime] Reset audio counters for ${callId} after processing ${chunksProcessed} chunks (${validChunksProcessed} valid, ${bytesProcessed} bytes)`);
            
            // Don't automatically trigger responses - let speech detection handle it naturally
            logger.debug(`[OpenAI Realtime] Audio buffer committed for ${callId} - waiting for natural conversation flow`);
          }
          break;

        case 'input_audio_buffer.cleared':
          logger.info(`[OpenAI Realtime] Audio buffer cleared for ${callId}`);
          if (conn) {
            conn._bufferClearedTime = Date.now();
            conn._bufferClearedByOpenAI = true; // Mark that OpenAI cleared it
            logger.info(`[OpenAI Realtime] Tracked buffer clear time for ${callId} - commits blocked for 2 seconds`);
          }
          break;

        case 'input_audio_buffer.appended':
          logger.info(`[OpenAI Realtime] Audio buffer append acknowledged for ${callId}`);
          // Track successful acknowledgments to help debug silent failures
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
            connResponse._responseCreated = true; // Mark that OpenAI acknowledged our response.create
            logger.info(`[OpenAI Realtime] OpenAI acknowledged response.create for ${callId}`);
            logger.info(`[OpenAI Realtime] Response lifecycle for ${callId}: created at ${new Date().toISOString()}`);
          }
          break;

        case 'error':
          await this.handleApiError(callId, message);
          break;

        case 'session.expired':
          await this.handleSessionExpired(callId);
          break;

        default:
          logger.info(`[OpenAI Realtime] Unhandled message type ${message.type} for ${callId} - full message: ${JSON.stringify(message)}`);
          // Track all received messages to help debug silent failures
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
  async handleSessionCreated(callId, message) {
    const conn = this.connections.get(callId);
    if (!conn) return;

    logger.info(`[OpenAI Realtime] Session CREATED for ${callId}, Session ID: ${message.session.id}`);
    conn.sessionId = message.session.id;

    // Send session.update immediately (like test method)
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: conn.initialPrompt || 'You are Bianca, a helpful AI assistant.',
        voice: config.openai.realtimeVoice || 'alloy',
        // USE PCM16 instead of g711_ulaw for better quality and reliability
        input_audio_format: 'g711_ulaw', // Much better speech recognition
        output_audio_format: 'g711_ulaw', // Higher quality output
        // Add input transcription to help with debugging
        input_audio_transcription: {
          model: 'whisper-1',
        }, 
        //...(config.openai.realtimeSessionConfig || {})
      },
    }; 

    logger.info(`[OpenAI Realtime] Sending session.update for ${callId}`);
    logger.debug(`[OpenAI Realtime] Session config for ${callId}: ${JSON.stringify(sessionConfig)}`);
    try {
      await this.sendJsonMessage(callId, sessionConfig);
      logger.info(`[OpenAI Realtime] Session.update sent successfully for ${callId}`);
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
      
      // Reset counters when session becomes ready
      conn.audioChunksReceived = 0;
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
      logger.info(`[OpenAI Realtime] Session ready for ${callId}. Waiting for user input.`);

      try {
        // Don't make OpenAI speak immediately - wait for user to speak first
        logger.info(`[OpenAI Realtime] Session ready for ${callId} - waiting for user input`);
        this.notify(callId, 'openai_session_ready', {});
      } catch (err) {
        logger.error(`[OpenAI Realtime] Error in session setup for ${callId}: ${err.message}`);
        this.cleanup(callId);
      }
    }
  }

  async handleResponseAudioDelta(callId, message) {
    // <<<< NEW HANDLER
    logger.info(`[OpenAI Realtime] handleResponseAudioDelta CALLED for ${callId} with message type: ${message.type}`);
    logger.info(`[OpenAI Realtime] Message delta check for ${callId}: delta exists=${!!message.delta}, type=${typeof message.delta}, length=${message.delta?.length}`);
    
    if (!message.delta || typeof message.delta !== 'string' || message.delta.length === 0) {
      logger.warn(
        `[OpenAI Realtime] Received 'response.audio.delta' for ${callId} but 'message.delta' (audio data) is missing or empty.`
      );
      return;
    }
    
    logger.info(`[OpenAI Realtime] Validation passed for ${callId}, calling processAudioResponse with delta length: ${message.delta.length}`);
    
    const conn = this.connections.get(callId);
    if (conn) {
      if (!conn._openaiChunkCount) conn._openaiChunkCount = 0;
      conn._openaiChunkCount++;
      
      // Log first few chunks for debugging
      if (conn._openaiChunkCount <= 5 || conn._openaiChunkCount % 50 === 0) {
        logger.info(`[OpenAI Realtime] Processing response.audio.delta #${conn._openaiChunkCount} for ${callId}, data length: ${message.delta.length}`);
      }
    }
    
    await this.processAudioResponse(callId, message.delta);
  }

  /**
   * Handle content part added
   */
  async handleContentPartAdded(callId, message) {
    const part = message.part;
    if (!part) {
      logger.warn(`[OpenAI Realtime] No part in content_part.added message for ${callId}`);
      return;
    }

    if (part.type === 'text') {
      logger.info(`[OpenAI Realtime] Received TEXT content part for ${callId}: "${part.text}"`);

      this.notify(callId, 'openai_text_delta', {
        text: part.text,
        sessionId: this.connections.get(callId)?.sessionId
      });

    } else if (part.type === 'audio') {
      logger.info(`[OpenAI Realtime] Received 'response.content_part.added' with part_type=audio for ${callId}.`);
      if (part.audio && typeof part.audio === 'string' && part.audio.length > 0) {
        await this.processAudioResponse(callId, part.audio);
      }
    } else {
      logger.debug(`[OpenAI Realtime] Unhandled part type '${part.type}' in response.content_part.added for ${callId}`);
    }
  }

  /**
   * Handle audio transcript deltas - ENHANCED to save transcripts
   */
  async handleResponseAudioTranscriptDelta(callId, message) {
    if (!message.delta) return;

    const conn = this.connections.get(callId);
    if (!conn) return;

    logger.info(`[OpenAI Realtime] Audio transcript delta for ${callId}: "${message.delta}"`);

    // Just accumulate - don't check who's speaking
    conn.pendingAssistantTranscript += message.delta;
    conn.lastAssistantSpeechTime = Date.now();
  }

  /**
   * Handle response.done - UPDATED to flush any remaining transcripts
   */
  /**
   * Handle response.done - Save complete assistant response
   */
  async handleResponseDone(callId) {
    logger.info(`[OpenAI Realtime] Assistant response done for ${callId}`);

    const conn = this.connections.get(callId);
    if (!conn) {
      this.notify(callId, 'response_done', {});
      return;
    }

    // Save complete assistant message
    if (conn.pendingAssistantTranscript) {
      await this.saveCompleteMessage(callId, 'assistant', conn.pendingAssistantTranscript);
      conn.pendingAssistantTranscript = '';
    }

    // Reset response flag so new commits can trigger new responses
    conn._responseCreated = false;
    conn._responseStartTime = null; // Clear timeout tracking
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
              await this.saveCompleteMessage(callId, 'user', transcriptToSave);
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
          const assistantSilenceTime = now - (conn.lastAssistantSpeechTime || 0);
          if (assistantSilenceTime > STALE_THRESHOLD) {
            // Capture the transcript to save
            const transcriptToSave = conn.pendingAssistantTranscript;
            logger.debug(`[Transcript Cleanup] Saving stale assistant transcript for ${callId} (silent for ${assistantSilenceTime}ms)`);

            try {
              await this.saveCompleteMessage(callId, 'assistant', transcriptToSave);
              // Only clear if it hasn't changed
              if (conn.pendingAssistantTranscript === transcriptToSave) {
                conn.pendingAssistantTranscript = '';
                conn.lastAssistantSpeechTime = null;
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
    if (!conn?.conversationId || !content?.trim()) return;

    try {
      const conversationService = require('./conversation.service');
      await conversationService.saveRealtimeMessage(
        conn.conversationId,
        role,
        content.trim(),
        role === 'assistant' ? 'assistant_response' : 'user_message'
      );
      logger.info(`[OpenAI Realtime] Saved ${role} message (${content.length} chars) to conversation ${conn.conversationId}`);
    } catch (err) {
      logger.error(`[OpenAI Realtime] Failed to save ${role} message: ${err.message}`);
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
   * Handle input audio transcription completed - ENHANCED to save user speech
   */
  /**
   * Handle input audio transcription completed - UPDATED
   */
  async handleInputAudioTranscriptionCompleted(callId, message) {
    if (!message.transcript) return;

    const conn = this.connections.get(callId);
    if (!conn) return;

    logger.info(`[OpenAI Realtime] User audio transcription completed for ${callId}: "${message.transcript}"`);

    // DON'T interrupt the assistant - they can speak simultaneously
    // Just accumulate the user transcript
    conn.pendingUserTranscript += (conn.pendingUserTranscript ? ' ' : '') + message.transcript;
    conn.lastUserSpeechTime = Date.now();

    logger.debug(`[OpenAI Realtime] Accumulated user transcript: "${conn.pendingUserTranscript}"`);
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
        
        // CRITICAL FIX: Clear any pending commit timers
        if (this.commitTimers.has(callId)) {
          clearTimeout(this.commitTimers.get(callId));
          this.commitTimers.delete(callId);
          logger.info(`[OpenAI Realtime] Cleared pending commit timer for ${callId}`);
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
        setTimeout(() => this.attemptReconnect(callId), delay);
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
  /**
 * Process audio response from OpenAI (PCM) -> Resample -> Convert to uLaw -> Notify ARI.
 */
  async processAudioResponse(callId, audioBase64) {
    logger.info(`[OpenAI Realtime] processAudioResponse ENTERED for ${callId} with audio length: ${audioBase64?.length || 0}`);
    
    if (!audioBase64) {
        logger.warn(`[OpenAI Realtime] processAudioResponse: Empty audio for ${callId}`);
        return;
    }
    
    try {
        const useDebugMode = config.openai?.debugAudio !== false;
        const conn = this.connections.get(callId);
        
        // Add timing measurement
        const startTime = process.hrtime.bigint();
        
        if (useDebugMode && conn && !conn._debugFilesInitialized) {
            this.initializeContinuousDebugFiles(callId);
            conn._debugFilesInitialized = true;
        }
        
        // Since OpenAI is sending g711_ulaw at 8kHz, we can use it directly
        const ulawBuffer = Buffer.from(audioBase64, 'base64');
        if (ulawBuffer.length === 0) {
            logger.warn(`[OpenAI Realtime] processAudioResponse: Decoded audio buffer is empty for ${callId}`);
            return;
        }
        
        // Log audio characteristics
        if (!conn._audioStatsLogged || conn._openaiChunkCount % 100 === 0) {
            logger.info(`[AUDIO QUALITY] OpenAI uLaw audio characteristics:`, {
                callId,
                bufferSize: ulawBuffer.length,
                durationMs: (ulawBuffer.length / 8).toFixed(2), // 8kHz, 1 byte per sample
                chunkCount: conn._openaiChunkCount || 0
            });
            conn._audioStatsLogged = true;
        }
        
        // ALWAYS record the raw uLaw for analysis (not just when debug mode is enabled)
        await this.appendToContinuousDebugFile(callId, 'continuous_from_openai_ulaw.ulaw', ulawBuffer);
        
        // Calculate minimal processing time
        const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to ms
        
        // Track timing stats
        if (!conn._timingStats) {
            conn._timingStats = {
                count: 0,
                totalMs: 0,
                maxMs: 0
            };
        }
        
        conn._timingStats.count++;
        conn._timingStats.totalMs += totalTime;
        conn._timingStats.maxMs = Math.max(conn._timingStats.maxMs, totalTime);
        
        // Log timing every 100 chunks
        if (conn._timingStats.count % 100 === 0) {
            logger.info(`[AUDIO TIMING] Direct uLaw pass-through for ${callId}:`, {
                chunks: conn._timingStats.count,
                avgTotalMs: (conn._timingStats.totalMs / conn._timingStats.count).toFixed(2),
                maxMs: conn._timingStats.maxMs.toFixed(2),
                currentChunkMs: totalTime.toFixed(2)
            });
        }
        
        if (useDebugMode && conn) {
            if (!conn._openaiChunkCount) conn._openaiChunkCount = 0;
            conn._openaiChunkCount++;
        }
        
        // CRITICAL: Send to RTP immediately - direct pass-through
        logger.info(`[OpenAI Realtime] About to notify ARI for ${callId} with audio chunk size: ${ulawBuffer.length} bytes`);
        this.notify(callId, 'audio_chunk', { 
            audio: audioBase64, // Already base64 uLaw from OpenAI
            processingTimeMs: totalTime,
            originalSizeBytes: ulawBuffer.length,
            ulawSizeBytes: ulawBuffer.length
        });
        
        // Log first few notifications for debugging
        if (conn && (!conn._notificationsLogged || conn._openaiChunkCount <= 5)) {
            logger.info(`[OpenAI Realtime] Notified ARI of audio chunk #${conn._openaiChunkCount || 1} for ${callId} (size: ${ulawBuffer.length} bytes)`);
            conn._notificationsLogged = true;
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
      // Only save completed messages
      if (item.type === 'message' && item.status === 'completed') {
        const contentArray = item.content || [];
        const contentText = contentArray
          .map(part => (part?.type === 'text' ? part.text : ''))
          .join('')
          .trim();

        if (contentText && dbConversationId) {
          const conversationService = require('./conversation.service');
          await conversationService.saveRealtimeMessage(
            dbConversationId,
            item.role,
            contentText,
            item.role === 'assistant' ? 'assistant_response' : 'user_message'
          );
          logger.info(`[OpenAI Realtime] Saved ${item.role} message to conversation ${dbConversationId}`);
        }
      }

      // Only save completed audio transcripts
      if (item.audio?.transcript && dbConversationId) {
        const conversationService = require('./conversation.service');
        await conversationService.saveRealtimeMessage(
          dbConversationId,
          item.role,
          item.audio.transcript,
          item.role === 'assistant' ? 'assistant_response' : 'user_message'
        );
        logger.info(`[OpenAI Realtime] Saved ${item.role} audio transcript to conversation ${dbConversationId}`);
      }

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
    
    logger.info(`[OpenAI Realtime] Flushing ${chunksULawBase64.length} pending uLaw audio chunks for ${callId}.`);
    
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
   * IMPROVED: Smarter debounce commit logic with validation
   */
  /**
   * SIMPLIFIED: Simple commit logic with minimal conditions
   */
  debounceCommit(callId) {
    const conn = this.connections.get(callId);
    if (!conn?.sessionReady || !conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
      logger.debug(`[OpenAI Realtime] DebounceCommit: Not ready for ${callId}`);
      return;
    }

    // Don't start new timer if one is already active
    if (this.commitTimers.has(callId)) {
      return;
    }

    // CRITICAL FIX: Use much shorter debounce for first few chunks to catch "hello"
    const isFirstFewChunks = (conn.validAudioChunksSent || 0) <= 3;
    const debounceDelay = isFirstFewChunks ? 50 : CONSTANTS.COMMIT_DEBOUNCE_DELAY; // 50ms for first chunks, 200ms for rest
    
    logger.debug(`[OpenAI Realtime] Setting commit timer (${debounceDelay}ms) for ${callId} (chunk #${conn.validAudioChunksSent || 0})`);
    const timer = setTimeout(async () => {
      this.commitTimers.delete(callId);
      const currentConn = this.connections.get(callId);

              if (currentConn?.webSocket?.readyState === WebSocket.OPEN && currentConn.sessionReady) {
          logger.info(`[OpenAI Realtime] Sending commit for ${callId} (${currentConn.validAudioChunksSent || 0} chunks)`);
          try {
            await this.sendJsonMessage(callId, { type: 'input_audio_buffer.commit' });
            currentConn.lastCommitTime = Date.now(); // Track when commit was sent
            logger.info(`[OpenAI Realtime] Commit sent successfully for ${callId} at ${currentConn.lastCommitTime}`);
          } catch (commitErr) {
            logger.error(`[OpenAI Realtime] Failed to send commit: ${commitErr.message}`);
          }
        }
    }, debounceDelay);

    this.commitTimers.set(callId, timer);
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

  /**
   * ENHANCED: Send audio chunk with improved buffering and quality monitoring
   */
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
    
    // Track consecutive silence chunks to detect audio issues
    if (this.isAudioSilence(audioChunkBase64ULaw)) {
        conn.consecutiveSilenceChunks = (conn.consecutiveSilenceChunks || 0) + 1;
        if (conn.consecutiveSilenceChunks > CONSTANTS.MAX_CONSECUTIVE_SILENCE_CHUNKS) {
            logger.warn(`[OpenAI Realtime] Excessive silence detected for ${callId}: ${conn.consecutiveSilenceChunks} consecutive chunks`);
        }
    } else {
        conn.consecutiveSilenceChunks = 0;
    }
    
    // SIMPLIFIED: Only buffer if WebSocket is not open and session not ready
    if (!conn.webSocket || conn.webSocket.readyState !== WebSocket.OPEN) {
        if (!bypassBuffering && conn.status !== 'closed' && conn.status !== 'error_terminal') {
            const pending = this.pendingAudio.get(callId) || [];
            if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
                pending.push(audioChunkBase64ULaw);
                this.pendingAudio.set(callId, pending);
                logger.debug(`[OpenAI Realtime] WebSocket not open for ${callId}, buffered audio chunk (${pending.length}/${CONSTANTS.MAX_PENDING_CHUNKS})`);
            }
        }
        return;
    }
    
    if (!conn.sessionReady) {
        if (!bypassBuffering) {
            const pending = this.pendingAudio.get(callId) || [];
            if (pending.length < CONSTANTS.MAX_PENDING_CHUNKS) {
                pending.push(audioChunkBase64ULaw);
                this.pendingAudio.set(callId, pending);
                logger.debug(`[OpenAI Realtime] Session not ready for ${callId}, buffered audio chunk`);
            }
        }
        return;
    }
    
    try {
        // Record audio for debugging
        const ulawBuffer = Buffer.from(audioChunkBase64ULaw, 'base64');
        await this.appendToContinuousDebugFile(callId, 'continuous_from_asterisk_ulaw.ulaw', ulawBuffer);
        
        // SIMPLIFIED: Send uLaw audio directly to OpenAI
        await this.sendJsonMessage(callId, {
            type: 'input_audio_buffer.append',
            audio: audioChunkBase64ULaw,
        });
        
        // Update tracking
        conn.audioChunksSent++;
        conn.validAudioChunksSent = (conn.validAudioChunksSent || 0) + 1;
        conn.totalAudioBytesSent = (conn.totalAudioBytesSent || 0) + ulawBuffer.length;
        conn.lastSuccessfulAppendTime = Date.now();
        
        // CRITICAL FIX: Track when first audio was received for fallback commit
        if (!conn.firstAudioReceivedTime) {
            conn.firstAudioReceivedTime = Date.now();
            logger.info(`[OpenAI Realtime] First audio received for ${callId} at ${conn.firstAudioReceivedTime}`);
        }
        
        // Log progress every 100 chunks
        if (conn.validAudioChunksSent % 100 === 0) {
            logger.info(`[OpenAI Realtime] Sent ${conn.validAudioChunksSent} audio chunks to OpenAI for ${callId}`);
        }
        
        // Monitor audio quality periodically
        if (conn.validAudioChunksSent % 50 === 0) {
            this.monitorAudioQuality(callId);
        }
        
        // CRITICAL FIX: Much more responsive commit logic for initial speech
        // Commit immediately for first few chunks to catch "hello"
        // Then commit every 8 chunks (~160ms) for faster response
        // OR immediately if AI is generating response (interruption)
        // OR if we have meaningful audio and haven't committed recently
        // OR fallback: force commit if no commit within 1 second of first audio
        const timeSinceFirstAudio = conn.firstAudioReceivedTime ? (Date.now() - conn.firstAudioReceivedTime) : 0;
        const shouldCommit = (
            conn.validAudioChunksSent <= 3 || // CRITICAL: Commit first 3 chunks immediately
            conn.validAudioChunksSent % 8 === 0 || // More frequent commits (was 15)
            conn._responseCreated ||
            (conn.lastCommitTime && (Date.now() - conn.lastCommitTime) > 500) || // Force commit every 500ms (was 1000ms)
            (timeSinceFirstAudio > 1000 && !conn.lastCommitTime) // FALLBACK: Force commit if no commit within 1 second of first audio
        );
        
        if (shouldCommit) {
            // Log commit triggers for debugging
            if (conn.validAudioChunksSent <= 5) {
                logger.info(`[OpenAI Realtime] Triggering commit for ${callId} after ${conn.validAudioChunksSent} chunks (first few chunks)`);
            } else if (conn.validAudioChunksSent % 8 === 0) {
                logger.debug(`[OpenAI Realtime] Triggering commit for ${callId} after ${conn.validAudioChunksSent} chunks (regular interval)`);
            } else if (timeSinceFirstAudio > 1000 && !conn.lastCommitTime) {
                logger.info(`[OpenAI Realtime] Triggering FALLBACK commit for ${callId} after ${timeSinceFirstAudio}ms without any commit`);
            }
            this.debounceCommit(callId);
        }
        
    } catch (audioProcessingError) {
        logger.error(
            `[OpenAI Realtime] sendAudioChunk (${callId}): Audio processing error: ${audioProcessingError.message}`,
            audioProcessingError.stack
        );
        
        if (audioProcessingError.message.includes('WebSocket not open')) {
            this.updateConnectionStatus(callId, 'error');
            if (!this.isReconnecting.get(callId)) {
                this.handleConnectionError(callId, audioProcessingError);
            }
        }
        return;
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
      
      // Step 3: Cancel any pending commit timers
      if (this.commitTimers.has(callId)) {
        clearTimeout(this.commitTimers.get(callId));
        this.commitTimers.delete(callId);
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
            logger.info(`[OpenAI Realtime] Auto-triggering response generation after force recovery for ${callId}`);
            await this.sendResponseCreate(callId);
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
        if (conn.pendingUserTranscript) {
          logger.info(`[OpenAI Call End] Saving pending user message for ${callId}`);
          await this.saveCompleteMessage(callId, 'user', conn.pendingUserTranscript);
          conn.pendingUserTranscript = '';
        }

        // Save any pending assistant message
        if (conn.pendingAssistantTranscript) {
          logger.info(`[OpenAI Call End] Saving pending assistant message for ${callId}`);
          await this.saveCompleteMessage(callId, 'assistant', conn.pendingAssistantTranscript);
          conn.pendingAssistantTranscript = '';
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
          const summary = await conversationService.finalizeConversation(
            conversationId,
            true // true = use realtime messages from Message collection
          );

          if (summary) {
            logger.info(`[OpenAI Call End] Successfully generated summary for conversation ${conversationId}: "${summary.substring(0, 100)}..."`);
          } else {
            logger.warn(`[OpenAI Call End] No summary generated for conversation ${conversationId}`);
          }

          // Update final conversation status
          const { Conversation } = require('../models');
          await Conversation.findByIdAndUpdate(conversationId, {
            endTime: new Date(),
            status: 'completed',
            callEndReason: 'normal_completion'
          });

          logger.info(`[OpenAI Call End] Conversation ${conversationId} marked as completed`);

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