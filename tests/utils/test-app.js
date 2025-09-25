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
const config = require('../../src/config/config');
const morgan = require('../../src/config/morgan');
const { jwtStrategy } = require('../../src/config/passport');
const { authLimiter } = require('../../src/middlewares/rateLimiter');
const routes = require('../../src/routes/v1');
const { errorConverter, errorHandler } = require('../../src/middlewares/error');
const ApiError = require('../../src/utils/ApiError');
const logger = require('../../src/config/logger');

const app = express();

// Enhanced health check that includes service status
app.get('/health', (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Check email service status
    let emailStatus = { ready: false, status: 'Service not loaded' };
    try {
      const emailService = require('../../src/services/email.service');
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
      const { getAriClientInstance } = require('../../src/services/ari.client');
      const ariClient = getAriClientInstance();
      ariStatus = {
        ready: ariClient && ariClient.isConnected,
        status: ariClient && ariClient.isConnected ? 'Connected' : 'Not connected'
      };
    } catch (error) {
      ariStatus = { ready: false, status: 'Service not available' };
    }

    // Check SNS service status
    let snsStatus = { ready: false, status: 'Service not loaded' };
    try {
      const snsService = require('../../src/services/sns.service');
      snsStatus = {
        ready: snsService.isInitialized,
        status: snsService.getStatus()
      };
    } catch (error) {
      snsStatus = { ready: false, status: 'Service not available' };
    }

    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          ready: mongoose.connection.readyState === 1,
          status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
        },
        email: emailStatus,
        ari: ariStatus,
        sns: snsStatus
      }
    };

    res.status(httpStatus.OK).json(healthData);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// v1 api routes
app.use('/v1', routes);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
