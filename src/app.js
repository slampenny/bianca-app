// app.js
const express = require('express');
const i18n = require('i18n');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const bodyParser = require('body-parser');
const httpStatus = require('http-status');
const path = require('path');
const config = require('./config/config');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
const logger = require('./config/logger');

const app = express();

// Enhanced health check that includes service status
app.get('/health', (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Check email service status
    let emailStatus = { ready: false, status: 'Service not loaded' };
    try {
      const emailService = require('./services/email.service');
      emailStatus = {
        ready: emailService.isReady(),
        status: emailService.getStatus()
      };
    } catch (error) {
      emailStatus = { ready: false, status: 'Service not available' };
    }

    // Check ARI client status
    let ariStatus = { ready: false, status: 'Service not loaded' };
    try {
      const { getAriClientInstance } = require('./services/ari.client');
      const ariClient = getAriClientInstance();
      ariStatus = {
        ready: ariClient && ariClient.isReady(),
        status: ariClient ? 'Connected' : 'Not connected'
      };
    } catch (error) {
      ariStatus = { ready: false, status: 'Service not available' };
    }

    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: config.env,
      services: {
        mongodb: {
          ready: mongoose.connection.readyState === 1,
          status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
        },
        email: emailStatus,
        asterisk: ariStatus
      }
    };

    res.status(200).json(healthData);
    
  } catch (error) {
    // Fallback if something goes wrong
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: config.env,
      error: 'Could not retrieve service status'
    });
  }
});

// Trust proxy headers
app.set('trust proxy', true);

// i18n configuration
i18n.configure({
  locales: ['en', 'es'],
  directory: `${__dirname}/locales`,
  objectNotation: true,
  logWarnFn(msg) {
    // do nothing
  },
});
app.use(i18n.init); // Attach i18n to the request

// Log HTTP requests if not in test mode
// if (config.env !== 'test') {
app.use(morgan.successHandler);
app.use(morgan.errorHandler);
// }

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// Sanitize request data
app.use(xss());
app.use(mongoSanitize());

// Gzip compression
app.use(compression());

// Enable CORS
app.use(cors());
app.options('*', cors());

// JWT authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

app.use(express.json({ limit: '50mb' }));

// Rate limiting for auth endpoints in production
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// Log incoming requests
app.use((req, res, next) => {
  logger.debug(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts
      connectSrc: ["'self'", "wss:"], // Allow WebSocket connections
    }
  }
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// v1 API routes
app.use('/v1', routes);

// 404 handler for unknown routes
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Error conversion and handling
app.use(errorConverter);
app.use(errorHandler);

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start background jobs, etc.
if (process.env.NODE_ENV !== 'test') {
  require('./config/agenda');
}

module.exports = app;