const mongoose = require('mongoose');
const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || error instanceof mongoose.Error ? httpStatus.BAD_REQUEST : httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
    
    // Preserve custom error properties from the original error
    if (err.requiresPasswordLinking !== undefined) {
      error.requiresPasswordLinking = err.requiresPasswordLinking;
    }
    if (err.ssoProvider !== undefined) {
      error.ssoProvider = err.ssoProvider;
    }
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }

  res.locals.errorMessage = err.message;

  // Debug: Log all error properties to see what's available
  if (err.requiresPasswordLinking !== undefined || err.ssoProvider !== undefined) {
    logger.info('[SSO Account Linking] Error object properties:', {
      hasRequiresPasswordLinking: err.requiresPasswordLinking !== undefined,
      requiresPasswordLinking: err.requiresPasswordLinking,
      hasSSOProvider: err.ssoProvider !== undefined,
      ssoProvider: err.ssoProvider,
      errorKeys: Object.keys(err),
      errorType: err.constructor.name
    });
  }

  const response = {
    code: statusCode,
    message,
    ...(['development', 'test'].includes(config.env) && { stack: err.stack }),
    // Preserve custom error properties (e.g., requiresPasswordLinking, ssoProvider)
    // Always include these if they exist (not just truthy check)
    ...(err.requiresPasswordLinking !== undefined && { requiresPasswordLinking: err.requiresPasswordLinking }),
    ...(err.ssoProvider !== undefined && { ssoProvider: err.ssoProvider }),
  };
  
  // Debug logging for SSO account linking errors
  if (err.requiresPasswordLinking) {
    logger.info('[SSO Account Linking] Error response being sent:', {
      requiresPasswordLinking: err.requiresPasswordLinking,
      ssoProvider: err.ssoProvider,
      response: response
    });
  }

  if (['development', 'test'].includes(config.env)) {
    logger.error(err);
  }

  res.status(statusCode).send(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};
