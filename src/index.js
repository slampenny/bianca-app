// index.js
const mongoose = require('mongoose');
const http = require('http');
const config = require('./config/config');
const logger = require('./config/logger');
const { startAriClient, getAriClientInstance } = require('./api/ari.client');
const { startRtpListenerService } = require('./api/rtp.listener.service');

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
    let mongoConnected = false;
    const maxRetries = 5;
    let retries = 0;

    while (!mongoConnected && retries < maxRetries) {
      try {
        logger.info(`Attempting to connect to MongoDB (attempt ${retries + 1}/${maxRetries})... URL: ${config.mongoose.url}`);
        await mongoose.connect(config.mongoose.url, {
          ...config.mongoose.options,
          connectTimeoutMS: config.mongoose.options.connectTimeoutMS || 30000,
        });
        logger.info('Connected to MongoDB');
        mongoConnected = true;
      } catch (mongoError) {
        retries++;
        logger.error(`MongoDB connection attempt ${retries} failed: ${mongoError.message}`);
        if (retries >= maxRetries) {
          logger.error('Max MongoDB connection retries reached. Continuing without database.');
          logger.warn('Application functionality will be limited without database access');
        } else {
          logger.info(`Waiting ${5 * retries} seconds before next MongoDB connection attempt...`);
          await new Promise(resolve => setTimeout(resolve, 5000 * retries));
        }
      }
    }

    // Initialize Asterisk ARI client BEFORE starting HTTP server
    let ariReady = false;
    if (config.asterisk && config.asterisk.enabled) {
      logger.info('Asterisk integration enabled, starting ARI client');
      try {
        // Start ARI client
        const ariClient = await startAriClient();
        
        // IMPORTANT: Wait for ARI to be fully ready
        logger.info('Waiting for ARI client to be ready...');
        await ariClient.waitForReady();
        ariReady = true;
        logger.info('ARI client is ready and Stasis app registered');
        
        // Start RTP Listener after ARI is ready
        logger.info('Starting RTP listener service...');
        startRtpListenerService();
        logger.info('RTP listener service started');
        
      } catch (err) {
        logger.error(`Failed to start Asterisk ARI client: ${err.message}`);
        logger.warn('Continuing without Asterisk integration');
        // Optionally exit if ARI is critical
        // process.exit(1);
      }
    } else {
      logger.info('Asterisk integration disabled in configuration');
    }

    // Create HTTP server from Express app
    const server = http.createServer(app);
    
    // Add diagnostic listener for WebSocket upgrade requests
    server.on('upgrade', (request, socket, head) => {
      logger.info(`[Server] WebSocket upgrade request received: ${request.url}`);
      logger.info(`[Server] Headers: ${JSON.stringify(request.headers)}`);
      logger.info(`[Server] Method: ${request.method}`);
    });

    logger.info('WebSocket server (Twilio Media Streams) is DISABLED.');

    // Start HTTP server
    const port = config.port || 3000;
    server.listen(port, '0.0.0.0', () => {
      logger.info(`Server listening on port ${port}`);
      
      // Log service status
      logger.info('=== Service Status ===');
      logger.info(`MongoDB: ${mongoConnected ? 'Connected' : 'Not connected'}`);
      logger.info(`ARI Client: ${ariReady ? 'Ready' : 'Not ready'}`);
      logger.info(`RTP Listener: ${config.asterisk?.enabled && ariReady ? 'Running' : 'Not running'}`);
      logger.info('====================');
      
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
  const gracefulShutdown = async (server) => {
    logger.info('Initiating graceful shutdown...');
    
    // Shutdown ARI client first
    try {
      const ariClient = getAriClientInstance();
      if (ariClient && ariClient.isConnected) {
        logger.info('Shutting down ARI client...');
        await ariClient.shutdown();
      }
    } catch (err) {
      logger.error('Error shutting down ARI client:', err);
    }
    
    // Stop RTP listener
    try {
      const rtpListener = require('./api/rtp.listener.service');
      rtpListener.stopRtpListenerService();
    } catch (err) {
      logger.error('Error stopping RTP listener:', err);
    }
    
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