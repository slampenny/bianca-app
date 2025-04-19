// index.js
// Updated to correctly initialize WebSocket server alongside Express

const mongoose = require('mongoose');
const http = require('http'); // Import the 'http' module
const config = require('./config/config');
const logger = require('./config/logger');
const { initializeWebSocketServer } = require('./api/websocket.service'); // Import the WS initializer

async function startServer() {
  try {
    // Load secrets before initializing other components
    await config.loadSecrets();

    // Now require modules that depend on config
    const app = require('./app'); // Your Express app instance
    const { Conversation } = require('./models'); // If needed here

    // Attempt to connect to MongoDB but do not block server startup on failure
    try {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('Connected to MongoDB');
      // Conversation.ensureIndexes(); // Ensure indexes if connected - uncomment if needed
    } catch (mongoError) {
      console.error('MongoDB connection failed. Continuing without database connection:', mongoError);
      // Consider if the app can truly function without DB. If not, maybe exit here.
    }

    // Log configuration info
    logger.info(`Environment: ${config.env}`);
    if (config.env === 'production') {
      logger.info('Running in production mode');
      // Log key URLs for production diagnostics
      logger.info(`Production API URL: ${config.twilio.apiUrl}`);
      logger.info(`Production WebSocket URL: ${config.twilio.websocketUrl}`);
    } else {
      logger.info(`API URL (Dev/Test): ${config.twilio.apiUrl}`);
      logger.info(`WebSocket URL (Dev/Test): ${config.twilio.websocketUrl}`);
    }

    if (config.stripe && config.stripe.mode) {
      logger.info(`Stripe mode: ${config.stripe.mode}`);
      if (config.env !== 'production' && config.stripe.mode === 'live') {
        logger.warn('⚠️ WARNING: Using Stripe live keys in non-production environment!');
      }
    }

    // --- MODIFICATION START ---
    // Create HTTP server explicitly from the Express app
    const server = http.createServer(app);
    // Add this debugging listener before initializing WebSocket server
    server.on('upgrade', (request, socket, head) => {
      logger.info(`[WebSocket Service] Upgrade request received: ${request.url}, headers: ${JSON.stringify(request.headers)}`);
    });

    // Initialize and attach the WebSocket server to the HTTP server
    initializeWebSocketServer(server);
    logger.info('WebSocket server initialized and attached to HTTP server.');

    // Start the HTTP server (which now also handles WebSocket upgrades)
    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server listening on port ${config.port}`);
    });
    // --- MODIFICATION END ---

    // Graceful shutdown handlers (should still work with the 'server' instance)
    const exitHandler = () => {
      if (server) {
        server.close(() => {
          logger.info('Server closed');
          // Optionally close mongoose connection here if needed
          // mongoose.connection.close(false, () => { ... });
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    };

    const unexpectedErrorHandler = (error) => {
      logger.error('Unexpected Error:', error); // Log the full error
      exitHandler();
    };

    process.on('uncaughtException', unexpectedErrorHandler);
    process.on('unhandledRejection', (reason, promise) => {
        // Log both reason and promise for better debugging
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        // Don't necessarily exit immediately on unhandled rejection, depends on severity
        // exitHandler(); // Uncomment if you want unhandled rejections to stop the server
    });
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      if (server) {
        server.close();
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
