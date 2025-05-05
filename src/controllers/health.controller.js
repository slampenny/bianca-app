// controllers/health.controller.js
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const DebugUtils = require('../utils/debug');
const logger = require('../config/logger');
const config = require('../config/config');
const { getAriClient } = require('../api/ari2.client');

// Get service references - update these imports based on your actual file structure
const openAIService = require('../api/openai.realtime.service');
const { twilioConnections } = require('../api/websocket.service');

/**
 * Get basic health status
 */
const getHealth = catchAsync(async (req, res) => {
  res.status(httpStatus.OK).send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.env
  });
});

/**
 * Get detailed health status with service checks
 */
const getDetailedHealth = catchAsync(async (req, res) => {
  const apiKey = req.query.key;
  
  // Simple API key check to prevent unauthorized access to detailed health data
  if (!apiKey || apiKey !== config.healthCheckApiKey) {
    return res.status(httpStatus.UNAUTHORIZED).send({
      status: 'error',
      message: 'Unauthorized access to detailed health check'
    });
  }
  
  // Get system health
  const health = await DebugUtils.getSystemHealth();
  
  // Add connection state
  try {
    // Log connection state (also appears in logs)
    DebugUtils.logConnectionState({
      openAIService,
      twilioConnections,
      ariClient: getAriClient()
    });
    
    // Add active connection counts
    health.connections = {
      openai: openAIService.connections ? openAIService.connections.size : 0,
      twilio: twilioConnections ? twilioConnections.size : 0,
      asterisk: (getAriClient() && getAriClient().channels) ? getAriClient().channels.size : 0
    };
  } catch (err) {
    logger.error(`Error getting connection state: ${err.message}`);
    health.connections = { error: err.message };
  }
  
  res.status(httpStatus.OK).send(health);
});

/**
 * Log connection state (for debugging)
 */
const logConnections = catchAsync(async (req, res) => {
  const apiKey = req.query.key;
  
  // Simple API key check
  if (!apiKey || apiKey !== config.healthCheckApiKey) {
    return res.status(httpStatus.UNAUTHORIZED).send({
      status: 'error',
      message: 'Unauthorized access'
    });
  }
  
  try {
    DebugUtils.logConnectionState({
      openAIService,
      twilioConnections,
      ariClient: getAriClient()
    });
    
    res.status(httpStatus.OK).send({
      status: 'ok',
      message: 'Connection state logged successfully'
    });
  } catch (err) {
    logger.error(`Error logging connection state: ${err.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
      status: 'error',
      message: `Failed to log connection state: ${err.message}`
    });
  }
});

module.exports = {
  getHealth,
  getDetailedHealth,
  logConnections
};