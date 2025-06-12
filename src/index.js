// index.js
const mongoose = require('mongoose');
const http = require('http');
const config = require('./config/config');
const logger = require('./config/logger');
const { startAriClient, getAriClientInstance, shutdownAriClient } = require('./services/ari.client'); // Updated path
const { startRtpListenerService, stopRtpListenerService } = require('./services/rtp.listener.service'); // Updated path

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

    // Connect to MongoDB with retry logic (Your existing code - no changes needed)
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

    // --- START: MODIFIED ASTERISK INITIALIZATION ---
    let ariReady = false;
    let rtpListenerReady = false;

    if (config.asterisk && config.asterisk.enabled) {
      logger.info('Asterisk integration enabled, starting services...');

      const ariMaxRetries = 12; // Try for up to 6 minutes (12 * 30s)
      const ariRetryDelay = 30000; // 30 seconds is a good delay for waiting on an EC2 instance

      for (let attempt = 1; attempt <= ariMaxRetries; attempt++) {
        try {
          logger.info(`Initializing Asterisk services (Attempt ${attempt}/${ariMaxRetries})...`);

          // 1. Start RTP Listener Service
          startRtpListenerService();
          const rtpListenerService = require('./services/rtp.listener.service');
          const rtpReady = await rtpListenerService.ensureReady();
          if (!rtpReady) throw new Error('RTP listener service failed to become ready');
          rtpListenerReady = true;
          logger.info('RTP listener service started successfully.');

          // 2. Start and wait for ARI client
          const ariClient = await startAriClient();
          await ariClient.waitForReady();
          ariReady = true;
          logger.info('ARI client is ready and Stasis app registered.');

          // 3. If we get here, all services started successfully. Break the loop.
          break;

        } catch (err) {
          logger.error(`[Startup] Asterisk services failed on attempt ${attempt}: ${err.message}`);
          
          // Cleanup partially started services before retrying
          if (rtpListenerReady) stopRtpListenerService();
          rtpListenerReady = false;
          ariReady = false;

          if (attempt < ariMaxRetries) {
            logger.info(`[Startup] Retrying in ${ariRetryDelay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, ariRetryDelay));
          } else {
            logger.error('[Startup] Max retries reached. Could not initialize Asterisk services.');
            logger.warn('Continuing without Asterisk integration.');
          }
        }
      }

      // Optional: Final health check on success
      if (ariReady) {
        const ariClient = getAriClientInstance();
        const rtpListenerService = require('./services/rtp.listener.service');
        const ariHealth = await ariClient.healthCheck();
        const rtpHealth = rtpListenerService.healthCheck();
        logger.info('=== Service Health Check ===');
        logger.info(`ARI Client: ${ariHealth.healthy ? 'Healthy' : 'Unhealthy'} - ${ariHealth.status}`);
        logger.info(`RTP Listener: ${rtpHealth.healthy ? 'Healthy' : 'Unhealthy'} - ${rtpHealth.status}`);
        logger.info('============================');
      }

    } else {
      logger.info('Asterisk integration disabled in configuration');
    }
    // --- END: MODIFIED ASTERISK INITIALIZATION ---

    // Create HTTP server from Express app
    const server = http.createServer(app);

    server.on('upgrade', (request, socket, head) => {
      logger.info(`[Server] WebSocket upgrade request received: ${request.url}`);
    });

    // Start HTTP server
    const port = config.port || 3000;
    server.listen(port, '0.0.0.0', () => {
      logger.info(`Server listening on port ${port}`);
      logger.info('=== Final Service Status ===');
      logger.info(`MongoDB: ${mongoConnected ? 'Connected' : 'Not connected'}`);
      logger.info(`ARI Client: ${ariReady ? 'Ready' : 'Not ready'}`);
      logger.info(`RTP Listener: ${rtpListenerReady ? 'Running' : 'Not running'}`);
      logger.info('=============================');
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
    
    try {
      // 1. Shutdown ARI client first (this will cleanup all active calls)
      logger.info('Shutting down ARI client...');
      const shutdownSuccess = await shutdownAriClient();
      if (shutdownSuccess) {
        logger.info('ARI client shutdown completed');
      } else {
        logger.warn('ARI client was not running or already shut down');
      }
    } catch (err) {
      logger.error('Error shutting down ARI client:', err);
    }
    
    try {
      // 2. Stop RTP listener
      logger.info('Stopping RTP listener service...');
      stopRtpListenerService();
      logger.info('RTP listener service stopped');
    } catch (err) {
      logger.error('Error stopping RTP listener:', err);
    }

    try {
      // 3. Stop RTP sender service
      logger.info('Stopping RTP sender service...');
      const rtpSenderService = require('./services/rtp.sender.service');
      rtpSenderService.cleanupAll();
      logger.info('RTP sender service stopped');
    } catch (err) {
      logger.error('Error stopping RTP sender:', err);
    }
    
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Close database connection
        mongoose.connection.close(false, () => {
          logger.info('MongoDB connection closed');
          logger.info('Graceful shutdown completed');
          process.exit(0);
        });
      });
      
      // Force exit after timeout
      setTimeout(() => {
        logger.warn('Forcing exit after shutdown timeout');
        process.exit(1);
      }, 15000); // Increased timeout for proper cleanup
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

  // Add handler for SIGUSR2 (used by nodemon for restarts)
  process.on('SIGUSR2', () => {
    logger.info('SIGUSR2 received (nodemon restart)');
    gracefulShutdown(server);
  });
}

// Start the server
startServer();