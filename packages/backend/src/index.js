// index.js
const mongoose = require('mongoose');
const http = require('http');
const config = require('./config/config');
const logger = require('./config/logger');
const { startAriClient, getAriClientInstance, shutdownAriClient } = require('./services/ari.client'); // Updated path
const { stopAllListeners } = require('./services/rtp.listener.service'); // Updated path

/**
 * Starts the application server and initializes all components
 */
async function startServer() {
  try {
    // Debug: Log actual process.env.NODE_ENV at the very start
    logger.info(`[Startup] ===== ENVIRONMENT DEBUG =====`);
    logger.info(`[Startup] process.env.NODE_ENV: ${process.env.NODE_ENV || 'NOT_SET'}`);
    
    // Check if ecosystem.config.json exists and what it contains
    try {
      const fs = require('fs');
      const path = require('path');
      const ecosystemPath = path.join(__dirname, '../ecosystem.config.json');
      if (fs.existsSync(ecosystemPath)) {
        const ecosystemConfig = JSON.parse(fs.readFileSync(ecosystemPath, 'utf8'));
        logger.info(`[Startup] ecosystem.config.json exists`);
        logger.info(`[Startup] ecosystem.config.json env section: ${JSON.stringify(ecosystemConfig.apps[0].env || 'NOT_SET')}`);
      } else {
        logger.warn(`[Startup] ecosystem.config.json NOT FOUND at ${ecosystemPath}`);
      }
    } catch (err) {
      logger.warn(`[Startup] Error reading ecosystem.config.json: ${err.message}`);
    }
    
    // Load environment variables and secrets
    await config.loadSecrets();
    logger.info(`[Startup] config.env after loadSecrets: ${config.env}`);
    logger.info(`[Startup] process.env.NODE_ENV after loadSecrets: ${process.env.NODE_ENV || 'NOT_SET'}`);
    logger.info(`[Startup] ===== END ENVIRONMENT DEBUG =====`);
    logger.info(`Environment: ${config.env}`);

    // Re-initialize Twilio SMS service after secrets are loaded
    try {
      const { twilioSmsService } = require('./services/twilioSms.service');
      if (twilioSmsService && typeof twilioSmsService.reinitialize === 'function') {
        twilioSmsService.reinitialize();
      }
    } catch (twilioError) {
      logger.warn('Could not re-initialize Twilio SMS service:', twilioError);
    }

    // Import Express app (after config is loaded)
    const app = require('./app');

    // Initialize Email Service
    let emailReady = false;
    try {
      logger.info('Initializing email service...');
      const emailService = require('./services/email.service');
      await emailService.initializeEmailTransport();
      emailReady = true;
      logger.info('✅ Email service initialized successfully');
    } catch (emailError) {
      logger.error('❌ Email service initialization failed:', emailError);
      logger.warn('Continuing without email service. Email features will be unavailable.');
    }

    // Connect to MongoDB (Your existing logic is perfect)
    let mongoConnected = false;
    const maxRetries = 5;
    let retries = 0;
    while (!mongoConnected && retries < maxRetries) {
      try {
        logger.info(`Attempting to connect to MongoDB (attempt ${retries + 1}/${maxRetries})...`);
        await mongoose.connect(config.mongoose.url, config.mongoose.options);
        
        // Verify connection is actually ready
        if (mongoose.connection.readyState === 1) {
          logger.info('Connected to MongoDB');
          mongoConnected = true;

          try {
            const { embeddingAnchorService } = require('./services/ai/embeddingAnchor.service');
            await embeddingAnchorService.ensureInitialized();
          } catch (embErr) {
            logger.warn(`[Startup] Embedding anchor preload skipped or failed: ${embErr.message}`);
          }

          // Set up connection event handlers
          mongoose.connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err.message}`);
          });
          
          mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
            // Mongoose will automatically attempt to reconnect
          });
          
          mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected successfully');
          });
        } else {
          throw new Error(`MongoDB connection not ready. State: ${mongoose.connection.readyState}`);
        }
      } catch (mongoError) {
        retries++;
        logger.error(`MongoDB connection attempt ${retries} failed: ${mongoError.message}`);
        if (retries >= maxRetries) {
          logger.error('Max MongoDB connection retries reached. Server will start but database operations will fail.');
          // Don't exit - let the server start but log warnings
        } else {
          logger.info(`Waiting ${5 * retries} seconds before next MongoDB connection attempt...`);
          await new Promise(resolve => setTimeout(resolve, 5000 * retries));
        }
      }
    }

    // Initialize ARI Client connection (non-blocking)
    let ariReady = false;
    if (config.asterisk) {
      logger.info('Asterisk integration enabled, starting ARI client in background...');

      // Start ARI connection in background - don't block server startup
      const startAriInBackground = async () => {
        const ariMaxRetries = 12; // Try for up to 6 minutes (12 * 30s)
        const ariRetryDelay = 30000; // 30 seconds is a good delay for waiting on an EC2 instance

        for (let attempt = 1; attempt <= ariMaxRetries; attempt++) {
          try {
            logger.info(`[Startup] Attempting to connect to ARI (Attempt ${attempt}/${ariMaxRetries})...`);
            const ariClient = await startAriClient();
            await ariClient.waitForReady();
            
            ariReady = true;
            logger.info('[Startup] ARI client connected and ready.');
            break; // Exit loop on success
          } catch (err) {
            logger.error(`[Startup] ARI connection failed on attempt ${attempt}: ${err.message}`);
            if (attempt < ariMaxRetries) {
              logger.info(`[Startup] Retrying in ${ariRetryDelay / 1000} seconds...`);
              await new Promise(resolve => setTimeout(resolve, ariRetryDelay));
            } else {
              logger.error('[Startup] Max retries reached. ARI client will continue retrying in background.');
            }
          }
        }
      };

      // Start ARI connection in background - don't wait for it
      startAriInBackground().catch(err => {
        logger.error('[Startup] Background ARI connection failed:', err);
      });
    } else {
      logger.info('Asterisk configuration not found.');
    }

    // Initialize Medical Analysis Scheduler
    let schedulerReady = false;
    try {
      logger.info('Initializing medical analysis scheduler...');
      const medicalAnalysisScheduler = require('./services/ai/medicalAnalysisScheduler.service');
      await medicalAnalysisScheduler.initialize();
      schedulerReady = true;
      logger.info('✅ Medical analysis scheduler initialized successfully');
    } catch (schedulerError) {
      logger.error('❌ Medical analysis scheduler initialization failed:', schedulerError);
      logger.warn('Continuing without medical analysis scheduler. Scheduled analysis will be unavailable.');
    }

    // Create and start the HTTP server
    const server = http.createServer(app);
    const port = config.port || 3000;
    server.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Server listening on port ${port}`);
      logger.info('=== Final Service Status ===');
      logger.info(`MongoDB: ${mongoConnected ? '✅ Connected' : '❌ Not connected'}`);
      logger.info(`Email Service: ${emailReady ? '✅ Ready' : '❌ Not ready'}`);
      logger.info(`ARI Client: ${ariReady ? '✅ Ready' : '❌ Not ready'}`);
      logger.info(`Medical Analysis Scheduler: ${schedulerReady ? '✅ Ready' : '❌ Not ready'}`);
      logger.info('=============================');
      logger.info(`📊 Health check: http://localhost:${port}/health`);
      logger.info(`📧 Email test: http://localhost:${port}/v1/test/email`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use. Another instance may be running.`);
        logger.error('Please stop the other instance or use a different port.');
        process.exit(1);
      } else {
        logger.error('Server error:', err);
        process.exit(1);
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
    logger.error('Unexpected Error (not exiting):', error);
    // DON'T exit - let the app continue running and ECS health checks will handle it
    // Only exit on intentional signals like SIGTERM/SIGINT
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
      stopAllListeners();
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

    try {
      // 4. Close email service transport if needed
      logger.info('Shutting down email service...');
      const emailService = require('./services/email.service');
      // Email service cleanup is handled by process.on('exit') in the email service
      logger.info('Email service shutdown completed');
    } catch (err) {
      logger.error('Error shutting down email service:', err);
    }
    
    if (server) {
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Close database connection (returns Promise in newer Mongoose versions)
        try {
          await mongoose.connection.close(false);
          logger.info('MongoDB connection closed');
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (err) {
          logger.error('Error closing MongoDB connection:', err);
          process.exit(1);
        }
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