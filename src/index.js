// index.js
const mongoose = require('mongoose');
const http = require('http');
const config = require('./config/config');
const logger = require('./config/logger');
//const { initializeWebSocketServer } = require('./api/websocket.service');
//const { startAriClient } = require('./api/ari.client');
const { startAriClient } = require('./api/ari.client');
const { startRtpListenerService } = require('./api/rtp.listener.service');
//const { startAudioSocketServer } = require('./api/audio.socket.service'); // ADD

/**
 * Starts the application server and initializes all components
 */
async function startServer() {
  try {
    // Load environment variables and secrets
    await config.loadSecrets();
    logger.info(`Environment: ${config.env}`);

    // Import Express app (after config is loaded)
    const app = require('./app');

    // Connect to MongoDB
    try {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('Connected to MongoDB');
    } catch (mongoError) {
      logger.error('MongoDB connection failed. Continuing without database:', mongoError.message);
      logger.warn('Application functionality will be limited without database access');
    }

    // Create HTTP server from Express app
    const server = http.createServer(app);
    
    // Add diagnostic listener for WebSocket upgrade requests
    server.on('upgrade', (request, socket, head) => {
      logger.info(`[Server] WebSocket upgrade request received: ${request.url}`);
      logger.info(`[Server] Headers: ${JSON.stringify(request.headers)}`);
      logger.info(`[Server] Method: ${request.method}`);
    });

    // initializeWebSocketServer(server); // REMOVE
    logger.info('WebSocket server (Twilio Media Streams) is DISABLED.');

    // Initialize Asterisk ARI client (if enabled in config)
    if (config.asterisk && config.asterisk.enabled) {
      logger.info('Asterisk integration enabled, starting ARI client');
      startAriClient().catch(err => {
        logger.error(`Failed to start Asterisk ARI client: ${err.message}`);
        logger.warn('Continue without Asterisk integration');
      });

      // Start RTP Listener
      startRtpListenerService();
    } else {
      logger.info('Asterisk integration disabled in configuration');
    }

    // Start HTTP server
    const port = config.port || 3000;
    server.listen(port, '0.0.0.0', () => {
      logger.info(`Server listening on port ${port}`);
      
      // Log URLs for debugging
      if (config.env === 'production') {
        logger.info(`Production API URL: ${config.twilio.apiUrl}`);
        logger.info(`Production WebSocket URL: ${config.twilio.websocketUrl}`);
      } else {
        logger.info(`Development API URL: ${config.twilio.apiUrl}`);
        logger.info(`Development WebSocket URL: ${config.twilio.websocketUrl}`);
      }
    });

    // Set up graceful shutdown handlers
    setupShutdownHandlers(server);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Set up handlers for graceful shutdown
 * @param {http.Server} server - HTTP server instance
 */
function setupShutdownHandlers(server) {
  // Handler for unexpected errors
  const unexpectedErrorHandler = (error) => {
    logger.error('Unexpected Error:', error);
    gracefulShutdown(server);
  };

  // Handler for graceful shutdown
  const gracefulShutdown = (server) => {
    logger.info('Initiating graceful shutdown...');
    
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Close database connection
        mongoose.connection.close(false, () => {
          logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });
      
      // Force exit after timeout
      setTimeout(() => {
        logger.warn('Forcing exit after timeout');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(1);
    }
  };

  // Register process event handlers
  process.on('uncaughtException', unexpectedErrorHandler);
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit on unhandled rejections, just log them
  });
  
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    gracefulShutdown(server);
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received');
    gracefulShutdown(server);
  });
}

// Start the server
startServer();