// utils/debug.js
const logger = require('../config/logger');
const config = require('../config/config');
const OpenAI = require('openai'); // Updated import for OpenAI client

/**
 * Debugging utilities for the wellness check application
 */
class DebugUtils {
  /**
   * Logs the state of all active connections
   * @param {Object} services - Object containing service references
   */
  static logConnectionState(services) {
    const { openAIService, twilioConnections, ariClient } = services;
    
    logger.info('=== CONNECTION STATE REPORT ===');
    
    // OpenAI Connections
    if (openAIService && openAIService.connections) {
      const openAIConnCount = openAIService.connections.size;
      logger.info(`OpenAI Connections: ${openAIConnCount}`);
      
      if (openAIConnCount > 0) {
        openAIService.connections.forEach((conn, callSid) => {
          const duration = conn.startTime ? Math.floor((Date.now() - conn.startTime) / 1000) : 'unknown';
          logger.info(`- CallSID ${callSid}: status=${conn.status}, duration=${duration}s`);
        });
      }
    } else {
      logger.info('OpenAI Service not available or has no connections map');
    }
    
    // Twilio Connections
    if (twilioConnections && twilioConnections.size) {
      logger.info(`Twilio WebSocket Connections: ${twilioConnections.size}`);
      twilioConnections.forEach((_, callSid) => {
        logger.info(`- CallSID ${callSid}`);
      });
    } else {
      logger.info('No active Twilio WebSocket connections');
    }
    
    // Asterisk Connections
    if (ariClient && ariClient.channels) {
      const channelCount = ariClient.channels.size;
      logger.info(`Asterisk Channels: ${channelCount}`);
      
      if (channelCount > 0) {
        ariClient.channels.forEach((data, callSid) => {
          logger.info(`- CallSID ${callSid}: state=${data.state}`);
        });
      }
      
      logger.info(`Asterisk Client Connected: ${ariClient.isConnected ? 'Yes' : 'No'}`);
    } else {
      logger.info('Asterisk Client not available or has no channels map');
    }
    
    logger.info('==============================');
  }
  
  /**
   * Verifies OpenAI API connectivity using the current library structure
   * @returns {Promise<Object>} - Status information
   */
  static async checkOpenAIConnectivity() {
    try {
      // Instantiate the OpenAI client directly with the API key
      const openai = new OpenAI({ // <--- Changed Instantiation
        apiKey: config.openai.apiKey
      });

      logger.info('Attempting OpenAI connectivity test...');

      // Make a simple test call using the updated API structure
      // Note: Use `completions.create` for completion models like 'gpt-3.5-turbo-instruct'
      // If you were using a chat model like 'gpt-3.5-turbo' or 'gpt-4', you'd use `chat.completions.create`
      const response = await openai.completions.create({ // <--- Changed API Call Method
        model: 'gpt-3.5-turbo-instruct', // Correct model for the completions endpoint
        prompt: 'Hello, this is a test.',
        max_tokens: 5
      });

      logger.info('OpenAI connectivity test successful.');
      // You might want to log response details for debugging:
      // logger.debug('OpenAI test response:', response);

      return {
        status: 'connected',
        message: 'Successfully connected to OpenAI API'
      };
    } catch (error) {
      // Log the detailed error for better debugging
      logger.error(`OpenAI connectivity test failed: ${error.message}`);
      logger.error('Full OpenAI error:', error); // Log the full error object

      return {
        status: 'error',
        message: `Failed to connect to OpenAI: ${error.message}`,
        // Include stack trace or more details if available
        error: error.stack || error.toString()
      };
    }
  }
  
  /**
   * Verifies Twilio API connectivity
   * @returns {Promise<Object>} - Status information
   */
  static async checkTwilioConnectivity() {
    try {
      const twilio = require('twilio');
      const config = require('../config/config');
      
      // Check if credentials are available
      if (!config.twilio?.accountSid || !config.twilio?.authToken) {
        return {
          status: 'disabled',
          message: 'Twilio credentials not configured (expected on localhost)',
          error: null
        };
      }
      
      const client = twilio(config.twilio.accountSid, config.twilio.authToken);
      
      // Fetch account info as a simple test
      const account = await client.api.accounts(config.twilio.accountSid).fetch();
      
      return {
        status: 'connected',
        message: 'Successfully connected to Twilio API',
        accountName: account.friendlyName,
        accountStatus: account.status
      };
    } catch (error) {
      // Handle authentication errors gracefully (common on localhost/development)
      const isAuthError = error.code === 20003 || error.status === 401;
      
      if (isAuthError) {
        logger.warn(`Twilio connectivity test skipped: Authentication failed (credentials not available). This is expected on localhost.`);
        return {
          status: 'disabled',
          message: 'Twilio authentication failed - credentials not available (expected on localhost)',
          error: null
        };
      }
      
      logger.error(`Twilio connectivity test failed: ${error.message}`);
      return {
        status: 'error',
        message: `Failed to connect to Twilio: ${error.message}`,
        error: error.toString()
      };
    }
  }
  
  /**
   * Gets current memory usage statistics
   * @returns {Object} - Memory usage info
   */
  static getMemoryUsage() {
    const memUsage = process.memoryUsage();
    
    return {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
    };
  }
  
  /**
   * Reports system health
   * @returns {Promise<Object>} - Health status
   */
  static async getSystemHealth() {
    const mongoose = require('mongoose');
    const os = require('os');
    
    const systemInfo = {
      uptime: Math.floor(process.uptime()),
      memory: this.getMemoryUsage(),
      cpuUsage: process.cpuUsage(),
      loadAverage: os.loadavg(),
      timestamp: new Date().toISOString()
    };
    
    // Check database connectivity
    let dbStatus = 'disconnected';
    if (mongoose.connection.readyState) {
      switch (mongoose.connection.readyState) {
        case 0:
          dbStatus = 'disconnected';
          break;
        case 1:
          dbStatus = 'connected';
          break;
        case 2:
          dbStatus = 'connecting';
          break;
        case 3:
          dbStatus = 'disconnecting';
          break;
        default:
          dbStatus = 'unknown';
      }
    }
    
    return {
      status: 'ok',
      systemInfo,
      services: {
        database: {
          status: dbStatus
        },
        openai: await this.checkOpenAIConnectivity().catch(err => ({ 
          status: 'error', 
          message: err.message 
        })),
        twilio: await this.checkTwilioConnectivity().catch(err => ({ 
          status: 'error', 
          message: err.message 
        }))
      }
    };
  }
}

module.exports = DebugUtils;