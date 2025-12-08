/**
 * Reconnection Manager
 * Handles reconnection logic with exponential backoff and batch scheduling
 */

const logger = require('../../../config/logger');
const CONSTANTS = require('./constants');

/**
 * Reconnection Manager
 * Manages reconnection attempts with exponential backoff and batch processing
 */
class ReconnectionManager {
  constructor() {
    // Batch reconnection timer system
    this.pendingReconnections = new Map(); // callId -> { executeAt: timestamp, attempt: number }
    this.globalReconnectTimer = null; // Single timer for all reconnections
  }

  /**
   * Calculate backoff delay for reconnection attempts
   * @param {number} attempt - Current attempt number (0-indexed)
   * @returns {number} Delay in milliseconds
   */
  calculateBackoffDelay(attempt) {
    const expBackoff = Math.min(CONSTANTS.RECONNECT_BASE_DELAY * Math.pow(2, attempt), 30000);
    const jitter = expBackoff * 0.2 * (Math.random() * 2 - 1); // +/- 20% jitter
    return Math.floor(expBackoff + jitter);
  }

  /**
   * Schedule a reconnection attempt using batch system
   * @param {string} callId - Call identifier
   * @param {number} delay - Delay in milliseconds
   * @param {number} attempt - Attempt number
   */
  scheduleReconnect(callId, delay, attempt = 0) {
    const executeAt = Date.now() + delay;
    
    // Don't schedule if already pending
    if (this.pendingReconnections.has(callId)) {
      logger.debug(`[Reconnection Manager] 🚀 BATCH: Reconnect already scheduled for ${callId}, skipping`);
      return;
    }
    
    // Add to pending reconnections
    this.pendingReconnections.set(callId, { executeAt, attempt });
    
    // Start global timer if this is the first pending reconnection
    if (this.pendingReconnections.size === 1) {
      this.startGlobalReconnectTimer();
    }
    
    logger.info(`[Reconnection Manager] 🚀 BATCH: Scheduled reconnect for ${callId} in ${delay}ms (attempt: ${attempt}, total pending: ${this.pendingReconnections.size})`);
  }

  /**
   * Start global reconnection timer that processes ALL pending reconnections
   * @param {Function} attemptReconnectCallback - Callback to execute reconnect (callId) => Promise
   */
  startGlobalReconnectTimer(attemptReconnectCallback) {
    if (this.globalReconnectTimer) return; // Already running
    
    this.globalReconnectTimer = setInterval(() => {
      const now = Date.now();
      const reconnectsToProcess = [];
      
      // Find reconnections that are ready (past their executeAt time)
      for (const [callId, reconnectData] of this.pendingReconnections) {
        if (now >= reconnectData.executeAt) {
          reconnectsToProcess.push({ callId, attempt: reconnectData.attempt });
        }
      }
      
      // Process all ready reconnections
      for (const { callId, attempt } of reconnectsToProcess) {
        try {
          this.pendingReconnections.delete(callId);
          if (attemptReconnectCallback) {
            attemptReconnectCallback(callId).catch((err) => {
              logger.error(`[Reconnection Manager] Batch reconnect error for ${callId}: ${err.message}`);
            });
          }
          logger.info(`[Reconnection Manager] 🚀 BATCH: Processed reconnect for ${callId} (attempt: ${attempt})`);
        } catch (err) {
          logger.error(`[Reconnection Manager] Batch reconnect error for ${callId}: ${err.message}`);
          this.pendingReconnections.delete(callId); // Remove failed reconnect
        }
      }
      
      // Stop timer if no more pending reconnections
      if (this.pendingReconnections.size === 0) {
        this.stopGlobalReconnectTimer();
      }
      
    }, 500); // Check every 500ms for reconnections (less frequent than commits)
    
    logger.info(`[Reconnection Manager] 🚀 OPTIMIZATION: Started global batch reconnect timer`);
  }

  /**
   * Stop global reconnect timer when no pending reconnections
   */
  stopGlobalReconnectTimer() {
    if (this.globalReconnectTimer) {
      clearInterval(this.globalReconnectTimer);
      this.globalReconnectTimer = null;
      logger.info('[Reconnection Manager] 🛑 OPTIMIZATION: Stopped global batch reconnect timer');
    }
  }

  /**
   * Remove a callId from pending reconnections
   * @param {string} callId - Call identifier
   */
  removePendingReconnect(callId) {
    if (this.pendingReconnections.has(callId)) {
      this.pendingReconnections.delete(callId);
      
      // Stop timer if no more pending reconnections
      if (this.pendingReconnections.size === 0) {
        this.stopGlobalReconnectTimer();
      }
    }
  }

  /**
   * Classify connection error and determine if should reconnect
   * @param {Error} error - Connection error
   * @returns {Object} { shouldReconnect: boolean, recoveryAction: string }
   */
  classifyError(error) {
    const errorMessage = error.message || error.toString();
    let shouldReconnect = true;
    let recoveryAction = 'reconnect';

    // Classify errors for appropriate recovery
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      logger.warn(`[Reconnection Manager] Network connectivity issue: ${errorMessage}`);
      recoveryAction = 'network_retry';
    } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      logger.error(`[Reconnection Manager] Authentication error: ${errorMessage}`);
      shouldReconnect = false; // Don't retry auth errors
      recoveryAction = 'auth_failure';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      logger.warn(`[Reconnection Manager] Rate limit/quota issue: ${errorMessage}`);
      recoveryAction = 'rate_limit_retry';
    } else {
      logger.error(`[Reconnection Manager] General connection error: ${errorMessage}`);
      recoveryAction = 'general_retry';
    }

    return { shouldReconnect, recoveryAction };
  }
}

module.exports = ReconnectionManager;

