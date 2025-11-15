/**
 * Audio Processor
 * Handles audio validation, silence detection, and quality monitoring
 */

const logger = require('../../../config/logger');
const CONSTANTS = require('./constants');

/**
 * Audio Processor
 * Provides utility functions for audio processing and validation
 */
class AudioProcessor {
  /**
   * Create initial silence buffer to prevent static burst
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Base64 encoded silence
   */
  static createInitialSilence(durationMs = CONSTANTS.INITIAL_SILENCE_MS) {
    const samples = Math.floor((durationMs / 1000) * 8000); // 8kHz sample rate
    const silenceBuffer = Buffer.alloc(samples, 0x7F); // uLaw silence is 0x7F
    return silenceBuffer.toString('base64');
  }

  /**
   * Check if audio chunk is silence
   * @param {string} audioBase64 - Base64 encoded uLaw audio
   * @returns {boolean} True if audio is silence
   */
  static isAudioSilence(audioBase64) {
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
   * Validate audio chunk before sending to OpenAI - ENHANCED with better error detection
   * @param {string} audioBase64 - Base64 encoded uLaw audio
   * @returns {Object} Validation result with isValid, size, duration, and reason
   */
  static validateAudioChunk(audioBase64) {
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
      const totalBytes = audioBuffer.length;

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
        logger.debug(`[Audio Processor] Audio validation: ${audioBuffer.length} bytes (${durationMs.toFixed(1)}ms), first bytes: [${Array.from(firstBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
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
   * @param {Object} connection - Connection object with audio tracking
   * @returns {Object} Commit readiness with canCommit, totalBytes, totalDuration, and reason
   */
  static checkCommitReadiness(connection) {
    if (!connection) {
      return { canCommit: false, reason: 'No connection found' };
    }

    // Check if we have any audio chunks sent
    if (connection.audioChunksSent === 0) {
      return { canCommit: false, reason: 'No audio chunks sent yet' };
    }

    // Check if we have any valid audio chunks sent (track this separately)
    if (!connection.validAudioChunksSent) {
      connection.validAudioChunksSent = 0;
    }

    if (connection.validAudioChunksSent === 0) {
      return { canCommit: false, reason: 'No valid audio chunks sent yet' };
    }

    // CRITICAL FIX: Calculate total audio duration more precisely
    // Use actual audio bytes sent for more accurate duration calculation
    // At 8kHz uLaw: 1 byte = 0.125ms (8000 samples/sec = 8000 bytes/sec)
    let estimatedDurationMs;
    if (connection.totalAudioBytesSent && connection.totalAudioBytesSent > 0) {
      // Use actual bytes for precise calculation
      estimatedDurationMs = (connection.totalAudioBytesSent / 8); // 8kHz, 1 byte per sample
    } else {
      // Fallback to chunk-based estimation
      estimatedDurationMs = connection.validAudioChunksSent * 20; // Rough estimate
    }

    const safetyMarginMs = 50; // Increase safety margin to 50ms
    const adjustedDurationMs = estimatedDurationMs + safetyMarginMs;

    if (adjustedDurationMs < CONSTANTS.MIN_AUDIO_DURATION_MS) {
      // Only log every 50th check to reduce noise
      if (connection.validAudioChunksSent % 50 === 0) {
        logger.debug(`[Audio Processor] Commit readiness check: insufficient duration (${adjustedDurationMs}ms < ${CONSTANTS.MIN_AUDIO_DURATION_MS}ms), chunks sent: ${connection.validAudioChunksSent}, raw estimate: ${estimatedDurationMs}ms, bytes: ${connection.totalAudioBytesSent || 0}`);
      }
      return {
        canCommit: false,
        totalDuration: adjustedDurationMs,
        reason: `Insufficient audio duration: ${adjustedDurationMs}ms (minimum ${CONSTANTS.MIN_AUDIO_DURATION_MS}ms)`
      };
    }

    // Only log every 50th check to reduce noise
    if (connection.validAudioChunksSent % 50 === 0) {
      logger.debug(`[Audio Processor] Commit readiness check: ready to commit (${adjustedDurationMs}ms, ${connection.validAudioChunksSent} chunks, raw estimate: ${estimatedDurationMs}ms, bytes: ${connection.totalAudioBytesSent || 0})`);
    }
    return {
      canCommit: true,
      totalDuration: adjustedDurationMs,
      reason: 'Sufficient audio data for commit'
    };
  }

  /**
   * Monitor audio quality and detect issues
   * @param {Object} connection - Connection object with audio tracking
   * @param {number} startTime - Call start time in milliseconds
   */
  static monitorAudioQuality(connection, startTime) {
    if (!connection) return;

    const now = Date.now();
    const callDuration = now - startTime;

    // Check for issues around 30-second mark
    if (callDuration > 25000 && callDuration < 35000) {
      const audioChunksPerSecond = connection.audioChunksReceived / (callDuration / 1000);
      const expectedChunksPerSecond = 50; // At 8kHz, 20ms chunks = 50 chunks/second

      if (audioChunksPerSecond < expectedChunksPerSecond * 0.8) {
        logger.warn(`[Audio Processor] Audio quality issue detected at ${Math.round(callDuration / 1000)}s: ${audioChunksPerSecond.toFixed(1)} chunks/sec (expected ~${expectedChunksPerSecond})`);
      }
    }

    // Check for excessive silence
    if (connection.consecutiveSilenceChunks > CONSTANTS.MAX_CONSECUTIVE_SILENCE_CHUNKS) {
      logger.warn(`[Audio Processor] Audio quality warning: ${connection.consecutiveSilenceChunks} consecutive silence chunks`);
    }
  }
}

module.exports = AudioProcessor;

