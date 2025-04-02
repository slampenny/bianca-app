// index.js
const mongoose = require('mongoose');
const config = require('./config/config');
const logger = require('./config/logger');

async function startServer() {
  try {
    // Load secrets before initializing other components
    await config.loadSecrets();
    
    // Now require modules that depend on config
    const app = require('./app');
    const { Conversation } = require('./models');
    
    // Attempt to connect to MongoDB but do not block server startup on failure
    try {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('Connected to MongoDB');
      Conversation.ensureIndexes(); // Ensure indexes if connected
    } catch (mongoError) {
      console.error('MongoDB connection failed. Continuing without database connection:', mongoError);
    }
    
    // Log configuration info
    logger.info(`Environment: ${config.env}`);
    if (config.env === 'production') {
      logger.info('Running in production mode');
    } else {
      logger.info(`API URL: ${config.apiUrl}`);
    }
    
    if (config.stripe && config.stripe.mode) {
      logger.info(`Stripe mode: ${config.stripe.mode}`);
      if (config.env !== 'production' && config.stripe.mode === 'live') {
        logger.warn('⚠️ WARNING: Using Stripe live keys in non-production environment!');
      }
    }
    
    // Start the Express server
    const server = app.listen(config.port, () => {
      logger.info(`Listening on port ${config.port}`);
    });
    
    // Graceful shutdown handlers
    const exitHandler = () => {
      if (server) {
        server.close(() => {
          logger.info('Server closed');
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    };
    
    const unexpectedErrorHandler = (error) => {
      logger.error(error);
      exitHandler();
    };
    
    process.on('uncaughtException', unexpectedErrorHandler);
    process.on('unhandledRejection', unexpectedErrorHandler);
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
