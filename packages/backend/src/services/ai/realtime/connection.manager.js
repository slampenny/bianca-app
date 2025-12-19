/**
 * Connection Manager
 * Handles WebSocket connection lifecycle and event management
 */

const WebSocket = require('ws');
const logger = require('../../../config/logger');
const CONSTANTS = require('./constants');
const config = require('../../../config/config');

/**
 * Connection Manager
 * Manages WebSocket connections, timeouts, and event handlers
 */
class ConnectionManager {
  constructor() {
    this.connectionTimeouts = new Map(); // callId -> timeout ID
  }

  /**
   * Create and configure WebSocket connection
   * @param {Object} connectionState - Connection state object
   * @param {string} callId - Call identifier
   * @param {Function} attachHandlers - Function to attach event handlers (ws, callId) => void
   * @returns {WebSocket} Created WebSocket instance
   */
  static createConnection(connectionState, callId, attachHandlers) {
    const model = config.openai.realtimeModel || 'gpt-4o-realtime-preview-2024-12-17';
    const voice = config.openai.realtimeVoice || 'alloy';
    const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}&voice=${voice}`;
    logger.info(`[Connection Manager] Connecting to ${wsUrl} for callId: ${callId}`);

    // Create WebSocket with immediate event handler setup
    const ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    // Attach all handlers immediately
    if (attachHandlers) {
      attachHandlers(ws, callId);
    }

    connectionState.webSocket = ws;
    return ws;
  }

  /**
   * Attach all WebSocket event handlers immediately after creation
   * @param {WebSocket} ws - WebSocket instance
   * @param {string} callId - Call identifier
   * @param {Object} handlers - Event handler functions
   * @param {Function} handlers.onOpen - (callId) => void
   * @param {Function} handlers.onMessage - (callId, data) => Promise<void>
   * @param {Function} handlers.onError - (callId, error) => void
   * @param {Function} handlers.onClose - (callId, code, reason) => void
   */
  static attachWebSocketHandlers(ws, callId, handlers) {
    if (handlers.onOpen) {
      ws.on('open', () => handlers.onOpen(callId));
    }

    if (handlers.onMessage) {
      ws.on('message', async (data) => {
        try {
          await handlers.onMessage(callId, data);
        } catch (err) {
          logger.error(`[Connection Manager] Unhandled error in message handler for ${callId}: ${err.message}`, err);
          // Don't crash the connection, just log the error
        }
      });
    }

    if (handlers.onError) {
      ws.on('error', (error) => handlers.onError(callId, error));
    }

    if (handlers.onClose) {
      ws.on('close', (code, reason) => handlers.onClose(callId, code, reason));
    }
  }

  /**
   * Check if connection is ready
   * @param {Object} connection - Connection object
   * @returns {boolean} True if connection is ready
   */
  static isConnectionReady(connection) {
    const ready =
      connection &&
      connection.webSocket &&
      connection.webSocket.readyState === WebSocket.OPEN &&
      connection.sessionReady === true;

    logger.debug(
      `[Connection Manager] Connection ready check: ${ready ? 'YES' : 'NO'
      } (exists: ${!!connection}, ws: ${!!connection?.webSocket}, wsState: ${connection?.webSocket?.readyState
      }, sessionReady: ${connection?.sessionReady})`
    );

    return ready;
  }

  /**
   * Update connection status safely
   * @param {Object} connection - Connection object
   * @param {string} status - New status
   * @returns {boolean} True if status was updated
   */
  static updateConnectionStatus(connection, status) {
    if (!connection) {
      logger.warn(`[Connection Manager] UpdateStatus: Attempted to update non-existent connection to ${status}`);
      return false;
    }
    const oldStatus = connection.status;
    if (oldStatus === status) return false;
    connection.status = status;
    connection.lastActivity = Date.now();
    logger.info(`[Connection Manager] Connection status: ${oldStatus} -> ${status}`);
    return true;
  }

  /**
   * Validate connection health with enhanced monitoring
   * @param {Object} connection - Connection object
   * @param {Function} onUnhealthy - Callback when connection is unhealthy (callId, error) => void
   * @returns {boolean} True if connection is healthy
   */
  static checkConnectionHealth(connection, onUnhealthy) {
    if (!connection) return false;

    const isHealthy = connection.webSocket?.readyState === WebSocket.OPEN && 
                      connection.sessionReady && 
                      connection.status === 'connected';

    // Enhanced health monitoring
    if (!isHealthy) {
      const timeSinceLastActivity = Date.now() - connection.lastActivity;
      const maxInactivityTime = 30000; // 30 seconds

      if (timeSinceLastActivity > maxInactivityTime && connection.status === 'connected') {
        logger.warn(`[Connection Manager] Connection appears stuck (${timeSinceLastActivity}ms since last activity). Triggering recovery.`);
        if (onUnhealthy) {
          onUnhealthy(new Error('Connection timeout - no activity'));
        }
        return false;
      }
    }

    return isHealthy;
  }

  /**
   * Set connection timeout
   * @param {string} callId - Call identifier
   * @param {number} duration - Timeout duration in milliseconds
   * @param {Function} onTimeout - Callback when timeout occurs (callId) => void
   * @returns {NodeJS.Timeout} Timeout ID
   */
  setConnectionTimeout(callId, duration = CONSTANTS.CONNECTION_TIMEOUT, onTimeout) {
    this.clearConnectionTimeout(callId);

    const timeoutId = setTimeout(() => {
      if (onTimeout) {
        onTimeout(callId);
      }
    }, duration);

    this.connectionTimeouts.set(callId, timeoutId);
    return timeoutId;
  }

  /**
   * Clear connection timeout
   * @param {string} callId - Call identifier
   */
  clearConnectionTimeout(callId) {
    if (this.connectionTimeouts.has(callId)) {
      clearTimeout(this.connectionTimeouts.get(callId));
      this.connectionTimeouts.delete(callId);
    }
  }
}

module.exports = ConnectionManager;

