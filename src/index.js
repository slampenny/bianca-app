// index.js
const mongoose = require('mongoose');
const loadConfig = require('./config/config'); // returns a baseline config object with loadSecrets

async function startServer() {
  try {
    // Load the baseline config.
    const config = await loadConfig();
    // In production, enhance the baseline config with secrets.
    await config.loadSecrets();
    // Set the global config so that modules (like logger) can access it.
    global.appConfig = config;
    
    // Now require modules that depend on config.
    const app = require('./app');
    const logger = require('./config/logger');
    const { Conversation } = require('./models');

    // Connect to MongoDB.
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');
    Conversation.ensureIndexes(); // TODO: Move ensureIndexes() to the build process in production

    // Start the Express server.
    const server = app.listen(config.port, () => {
      logger.info(`Listening on port ${config.port}`);
    });

    // Graceful shutdown handlers.
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
