// index.js
const mongoose = require('mongoose');
const config = require('./config/config');
const logger = require('./config/logger');

async function startServer() {
  try {
    // Load secrets before initializing other components
    // This ensures config has all secret values before being used
    await config.loadSecrets();
    
    // Now require modules that depend on config
    const app = require('./app');
    const { Conversation } = require('./models');
    
    // Connect to MongoDB
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');
    
    Conversation.ensureIndexes(); // TODO: Move ensureIndexes() to the build process in production
    
    // Log configuration info
    logger.info(`Environment: ${config.env}`);
    if (config.env === 'production') {
      logger.info('Running in production mode');
    } else {
      logger.info(`API URL: ${config.apiUrl}`);
    }
    
    // Log Stripe mode for verification
    if (config.stripe && config.stripe.mode) {
      logger.info(`Stripe mode: ${config.stripe.mode}`);
      
      // Warn if using live keys in non-production
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